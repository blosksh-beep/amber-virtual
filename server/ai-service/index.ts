// AI Service - 双模式入口
// 默认: 小智AI WebSocket (实时语音流)
// 可选: 直连LLM API (需自建ASR/TTS)

import { XiaoZhiClient } from './xiaozhi-client';
import { LLMClient } from './llm-client';

export type AIMode = 'xiaozhi' | 'llm';

export interface AIServiceConfig {
  mode: AIMode;
  // 小智AI配置
  xiaozhi: {
    wsUrl: string;
    token: string;
    protocolVersion: 1 | 2 | 3;
  };
  // LLM直连配置
  llm: {
    apiKey: string;
    endpoint: string;
    model: string;
    asrEndpoint: string;
    ttsEndpoint: string;
  };
}

export interface AudioPacket {
  data: Buffer;       // OPUS编码音频
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

export class AIService {
  private client: XiaoZhiClient | LLMClient;

  constructor(config: AIServiceConfig) {
    if (config.mode === 'xiaozhi') {
      this.client = new XiaoZhiClient(config.xiaozhi);
    } else {
      this.client = new LLMClient(config.llm);
    }
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async sendAudio(audio: AudioPacket): Promise<void> {
    await this.client.sendAudio(audio);
  }

  async startListening(mode: 'auto' | 'manual' | 'realtime'): Promise<void> {
    await this.client.startListening(mode);
  }

  async stopListening(): Promise<void> {
    await this.client.stopListening();
  }

  async abortSpeaking(): Promise<void> {
    await this.client.abortSpeaking();
  }

  onResponse(callback: (response: AIResponse) => void): void {
    this.client.onResponse(callback);
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}

// 从环境变量创建配置
export function createConfigFromEnv(): AIServiceConfig {
  const mode = (process.env.AI_MODE || 'xiaozhi') as AIMode;
  return {
    mode,
    xiaozhi: {
      wsUrl: process.env.XIAOZHI_WS_URL || 'ws://localhost:8000/xiaozhi/v1/',
      token: process.env.XIAOZHI_TOKEN || '',
      protocolVersion: parseInt(process.env.XIAOZHI_PROTOCOL_VERSION || '3') as 1 | 2 | 3,
    },
    llm: {
      apiKey: process.env.LLM_API_KEY || '',
      endpoint: process.env.LLM_ENDPOINT || 'https://api.deepseek.com/v1',
      model: process.env.LLM_MODEL || 'deepseek-chat',
      asrEndpoint: process.env.ASR_ENDPOINT || 'http://localhost:8001/asr',
      ttsEndpoint: process.env.TTS_ENDPOINT || 'http://localhost:8002/tts',
    },
  };
}
