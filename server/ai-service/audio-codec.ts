// OPUS音频编解码工具
// 统一处理音频格式转换

export interface AudioFormat {
  format: 'opus' | 'pcm';
  sampleRate: number;
  channels: number;
  frameDuration: number;
}

export const DEFAULT_INPUT_FORMAT: AudioFormat = {
  format: 'opus',
  sampleRate: 16000,
  channels: 1,
  frameDuration: 60,
};

export const DEFAULT_OUTPUT_FORMAT: AudioFormat = {
  format: 'opus',
  sampleRate: 24000,
  channels: 1,
  frameDuration: 60,
};

export class AudioCodec {
  private inputFormat: AudioFormat;
  private outputFormat: AudioFormat;

  constructor(input?: Partial<AudioFormat>, output?: Partial<AudioFormat>) {
    this.inputFormat = { ...DEFAULT_INPUT_FORMAT, ...input };
    this.outputFormat = { ...DEFAULT_OUTPUT_FORMAT, ...output };
  }

  get input(): AudioFormat { return this.inputFormat; }
  get output(): AudioFormat { return this.outputFormat; }

  // OPUS帧大小计算
  getOpusFrameSize(): number {
    return (this.inputFormat.sampleRate * this.inputFormat.frameDuration) / 1000;
  }

  // 计算BinaryProtocol3包头大小
  static getBinHeaderSize(version: number): number {
    switch (version) {
      case 1: return 0;
      case 2: return 16; // version(2)+type(2)+reserved(4)+timestamp(4)+payload_size(4)
      case 3: return 4;  // type(1)+reserved(1)+payload_size(2)
      default: return 0;
    }
  }
}