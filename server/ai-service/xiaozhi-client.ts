// 小智AI WebSocket客户端
// 实现xiaozhi-esp32固件的WebSocket协议
// 协议文档: https://github.com/78/xiaozhi-esp32/blob/main/docs/websocket_zh.md

import WebSocket from 'ws';

export interface XiaoZhiConfig {
  wsUrl: string;
  token: string;
  protocolVersion: 1 | 2 | 3;
}

export interface AudioPacket {
  data: Buffer;
  sampleRate: number;
  frameDuration: number;
  timestamp: number;
}

export interface AIResponse {
  type: 'stt' | 'tts_start' | 'tts_audio' | 'tts_stop' | 'llm_emotion' | 'mcp' | 'error';
  text?: string;
  audio?: AudioPacket;
  emotion?: string;
  mcpPayload?: any;
  error?: string;
}

// BinaryProtocol3: uint8 type | uint8 reserved | uint16 payload_size | uint8[] payload
const BIN_HEADER_SIZE = 4;
const BIN_TYPE_OPUS = 0;

export class XiaoZhiClient {
  private ws: WebSocket | null = null;
  private config: XiaoZhiConfig;
  private sessionId: string = '';
  private serverSampleRate: number = 24000;
  private serverFrameDuration: number = 60;
  private responseCallback: ((response: AIResponse) => void) | null = null;
  private macAddress: string = '';
  private clientId: string = '';

  constructor(config: XiaoZhiConfig) {
    this.config = config;
    // 生成设备标识（琥珀虚颜的实际MAC和UUID）
    this.macAddress = process.env.DEVICE_MAC || 'c6:38:a3:4f:f6:df';
    this.clientId = process.env.DEVICE_UUID || this.generateUUID();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'Protocol-Version': this.config.protocolVersion.toString(),
        'Device-Id': this.macAddress,
        'Client-Id': this.clientId,
      };

      if (this.config.token) {
        const token = this.config.token.includes(' ')
          ? this.config.token
          : `Bearer ${this.config.token}`;
        headers['Authorization'] = token;
      }

      this.ws = new WebSocket(this.config.wsUrl, { headers });

      this.ws.on('open', () => {
        // 发送hello握手
        const hello = {
          type: 'hello',
          version: this.config.protocolVersion,
          features: { mcp: true },
          transport: 'websocket',
          audio_params: {
            format: 'opus',
            sample_rate: 16000,
            channels: 1,
            frame_duration: 60,
          },
        };
        this.ws!.send(JSON.stringify(hello));
      });

      this.ws.on('message', (data: WebSocket.Data, isBinary: boolean) => {
        if (isBinary) {
          this.handleBinaryMessage(data as Buffer);
        } else {
          this.handleTextMessage(data.toString());
        }
      });

      this.ws.on('error', (err) => {
        this.emitResponse({ type: 'error', error: err.message });
        reject(err);
      });

      this.ws.on('close', () => {
        this.emitResponse({ type: 'error', error: 'WebSocket disconnected' });
      });

      // 等待server hello（超时10秒）
      const timeout = setTimeout(() => {
        reject(new Error('Server hello timeout'));
      }, 10000);

      const originalCallback = this.responseCallback;
      this.responseCallback = (resp) => {
        if (resp.type === 'tts_start') {
          // 收到server hello时session_id已设置，标记连接成功
          clearTimeout(timeout);
          resolve();
        }
        originalCallback?.(resp);
      };
    });
  }

  private handleTextMessage(text: string): void {
    try {
      const json = JSON.parse(text);
      const msgType = json.type;

      switch (msgType) {
        case 'hello':
          // 服务器握手响应
          this.sessionId = json.session_id || '';
          if (json.audio_params) {
            this.serverSampleRate = json.audio_params.sample_rate || 24000;
            this.serverFrameDuration = json.audio_params.frame_duration || 60;
          }
          // hello完成后触发连接成功
          this.emitResponse({ type: 'tts_start', text: 'connected' });
          break;

        case 'stt':
          this.emitResponse({ type: 'stt', text: json.text });
          break;

        case 'tts':
          if (json.state === 'start') {
            this.emitResponse({ type: 'tts_start' });
          } else if (json.state === 'stop') {
            this.emitResponse({ type: 'tts_stop' });
          } else if (json.state === 'sentence_start') {
            this.emitResponse({ type: 'stt', text: json.text });
          }
          break;

        case 'llm':
          this.emitResponse({ type: 'llm_emotion', emotion: json.emotion, text: json.text });
          break;

        case 'mcp':
          this.emitResponse({ type: 'mcp', mcpPayload: json.payload });
          break;

        case 'system':
          if (json.command === 'reboot') {
            console.log('System reboot command received');
          }
          break;

        default:
          console.log('Unknown message type:', msgType);
      }
    } catch (e) {
      console.error('Failed to parse JSON:', e);
    }
  }

  private handleBinaryMessage(data: Buffer): void {
    if (this.config.protocolVersion === 3) {
      // BinaryProtocol3: type(1) + reserved(1) + payload_size(2) + payload
      if (data.length < BIN_HEADER_SIZE) return;
      const msgType = data.readUInt8(0);
      const payloadSize = data.readUInt16BE(2);
      const payload = data.slice(BIN_HEADER_SIZE, BIN_HEADER_SIZE + payloadSize);

      if (msgType === BIN_TYPE_OPUS) {
        this.emitResponse({
          type: 'tts_audio',
          audio: {
            data: payload,
            sampleRate: this.serverSampleRate,
            frameDuration: this.serverFrameDuration,
            timestamp: 0,
          },
        });
      }
    } else if (this.config.protocolVersion === 2) {
      // BinaryProtocol2: version(2) + type(2) + reserved(4) + timestamp(4) + payload_size(4) + payload
      if (data.length < 16) return;
      const msgType = data.readUInt16BE(2);
      const timestamp = data.readUInt32BE(8);
      const payloadSize = data.readUInt32BE(12);
      const payload = data.slice(16, 16 + payloadSize);

      if (msgType === BIN_TYPE_OPUS) {
        this.emitResponse({
          type: 'tts_audio',
          audio: {
            data: payload,
            sampleRate: this.serverSampleRate,
            frameDuration: this.serverFrameDuration,
            timestamp,
          },
        });
      }
    } else {
      // Version 1: 直接OPUS数据
      this.emitResponse({
        type: 'tts_audio',
        audio: {
          data,
          sampleRate: this.serverSampleRate,
          frameDuration: this.serverFrameDuration,
          timestamp: 0,
        },
      });
    }
  }

  async sendAudio(audio: AudioPacket): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    if (this.config.protocolVersion === 3) {
      const header = Buffer.alloc(BIN_HEADER_SIZE);
      header.writeUInt8(0, 0); // type = OPUS
      header.writeUInt8(0, 1); // reserved
      header.writeUInt16BE(audio.data.length, 2); // payload_size
      this.ws.send(Buffer.concat([header, audio.data]));
    } else if (this.config.protocolVersion === 2) {
      const header = Buffer.alloc(16);
      header.writeUInt16BE(this.config.protocolVersion, 0);
      header.writeUInt16BE(0, 2); // type = OPUS
      header.writeUInt32BE(0, 4); // reserved
      header.writeUInt32BE(audio.timestamp, 8);
      header.writeUInt32BE(audio.data.length, 12);
      this.ws.send(Buffer.concat([header, audio.data]));
    } else {
      // Version 1: 直接发
      this.ws.send(audio.data);
    }
  }

  async startListening(mode: 'auto' | 'manual' | 'realtime' = 'auto'): Promise<void> {
    this.sendJson({
      session_id: this.sessionId,
      type: 'listen',
      state: 'start',
      mode,
    });
  }

  async stopListening(): Promise<void> {
    this.sendJson({
      session_id: this.sessionId,
      type: 'listen',
      state: 'stop',
    });
  }

  async abortSpeaking(): Promise<void> {
    this.sendJson({
      session_id: this.sessionId,
      type: 'abort',
    });
  }

  onResponse(callback: (response: AIResponse) => void): void {
    this.responseCallback = callback;
  }

  async disconnect(): Promise<void> {
    this.ws?.close();
    this.ws = null;
  }

  private sendJson(obj: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  private emitResponse(resp: AIResponse): void {
    this.responseCallback?.(resp);
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
