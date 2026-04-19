// LLM API直连客户端
// 需要自建ASR/TTS，适合定制化场景

import fetch from 'node-fetch';

export interface LLMConfig {
  apiKey: string;
  endpoint: string;
  model: string;
  asrEndpoint: string;
  ttsEndpoint: string;
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

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `你是琥珀虚颜，一个温暖、智能的虚拟形象助手。你可以：
1. 与用户自然对话，提供有帮助的回答
2. 通过设备控制帮助用户操作智能设备
3. 用表情和语气表达情感

回复要求：
- 语气亲切自然，像一个朋友
- 回复简洁，避免冗长
- 需要控制设备时，在回复中说明`;

export class LLMClient {
  private config: LLMConfig;
  private history: ChatMessage[] = [];
  private responseCallback: ((response: AIResponse) => void) | null = null;

  constructor(config: LLMConfig) {
    this.config = config;
    this.history.push({ role: 'system', content: SYSTEM_PROMPT });
  }

  async connect(): Promise<void> {
    // LLM模式无需持久连接，验证API可用性即可
    try {
      const resp = await fetch(`${this.config.endpoint}/models`, {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      });
      if (!resp.ok) throw new Error(`LLM API check failed: ${resp.status}`);
    } catch (e: any) {
      this.emitResponse({ type: 'error', error: e.message });
    }
  }

  async sendAudio(audio: AudioPacket): Promise<void> {
    // Step 1: ASR 语音转文本
    this.emitResponse({ type: 'tts_start' }); // 标记开始处理

    try {
      const asrResp = await fetch(this.config.asrEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: audio.data,
      });
      const asrResult = await asrResp.json() as { text: string };
      const userText = asrResult.text;

      if (!userText) return;

      this.emitResponse({ type: 'stt', text: userText });

      // Step 2: LLM 对话
      this.history.push({ role: 'user', content: userText });
      const llmResp = await this.callLLM();
      this.history.push({ role: 'assistant', content: llmResp });

      this.emitResponse({ type: 'llm_emotion', emotion: 'happy' });

      // Step 3: TTS 文本转语音
      this.emitResponse({ type: 'tts_start' });
      const ttsResp = await fetch(this.config.ttsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: llmResp, speaker: 'default' }),
      });
      const ttsBuffer = Buffer.from(await ttsResp.arrayBuffer());

      this.emitResponse({
        type: 'tts_audio',
        audio: {
          data: ttsBuffer,
          sampleRate: 24000,
          frameDuration: 60,
          timestamp: 0,
        },
      });
      this.emitResponse({ type: 'tts_stop' });
    } catch (e: any) {
      this.emitResponse({ type: 'error', error: e.message });
    }
  }

  async startListening(mode: 'auto' | 'manual' | 'realtime' = 'auto'): Promise<void> {
    // LLM模式无需发送listen消息
  }

  async stopListening(): Promise<void> {
    // LLM模式无需发送stop消息
  }

  async abortSpeaking(): Promise<void> {
    // 取消当前TTS播放
  }

  onResponse(callback: (response: AIResponse) => void): void {
    this.responseCallback = callback;
  }

  async disconnect(): Promise<void> {
    this.history = [{ role: 'system', content: SYSTEM_PROMPT }];
  }

  private async callLLM(): Promise<string> {
    const resp = await fetch(`${this.config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: this.history,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    const data = await resp.json() as any;
    return data.choices?.[0]?.message?.content || '';
  }

  private emitResponse(resp: AIResponse): void {
    this.responseCallback?.(resp);
  }
}
