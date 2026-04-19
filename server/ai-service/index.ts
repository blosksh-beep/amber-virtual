// AI Service - 小智AI对话服务
// 负责: 语音识别 → 小智AI → 语音合成

export interface AIConfig {
    apiKey: string;
    endpoint: string;
    model: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export class XiaoZhiAIService {
    private config: AIConfig;
    private history: ChatMessage[] = [];

    constructor(config: AIConfig) {
        this.config = config;
    }

    async chat(userMessage: string): Promise<string> {
        this.history.push({ role: 'user', content: userMessage });
        // TODO: 调用小智AI API
        // const response = await fetch(...)
        // this.history.push({ role: 'assistant', content: response });
        return '';
    }

    clearHistory(): void {
        this.history = [];
    }
}