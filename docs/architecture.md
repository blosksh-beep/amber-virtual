# 琥珀虚颜 - 系统架构

## 双模式 AI 后端

系统支持两种 AI 后端，通过 `AI_MODE` 环境变量切换：

### 模式一：小智AI（默认）
通过 WebSocket 连接小智AI服务器，获得完整的实时语音对话流水线。
服务器端完成 ASR → LLM → TTS 全链路处理，设备端只需收发 OPUS 音频流。

```
用户语音(OPUS) → [Unity] → WebSocket → [小智AI Server]
                                            ↓
                                    ASR(SenseVoice)
                                            ↓
                                    LLM(Qwen/DeepSeek)
                                            ↓
                                    TTS(火山引擎/CosyVoice)
                                            ↓
AI语音(OPUS) ← [Unity] ← WebSocket ← [小智AI Server]
设备控制 ← MCP(JSON-RPC 2.0) ← [小智AI Server]
```

**优点**：开箱即用、低延迟、支持MCP设备控制、声纹识别
**缺点**：依赖小智服务器（可自建）、协议版本需匹配

### 模式二：直连LLM API
直接调用 OpenAI 兼容的 LLM API，需要自建 ASR/TTS 服务。

```
用户语音 → [Unity] → HTTP → [AI Service] → ASR → 文本
                                                  ↓
                                            LLM API(DeepSeek/Qwen)
                                                  ↓
                                            TTS → 音频 → [Unity] → 播放
```

**优点**：完全可控、可自由选择模型、无第三方依赖
**缺点**：需要自建ASR/TTS、延迟较高、无MCP设备控制

## 通信协议详解

### 小智AI WebSocket 协议

#### 连接头
```
Authorization: Bearer <token>
Protocol-Version: 3
Device-Id: <MAC地址>
Client-Id: <UUID>
```

#### Hello握手
设备→服务器：
```json
{"type":"hello","version":3,"features":{"mcp":true},"transport":"websocket",
 "audio_params":{"format":"opus","sample_rate":16000,"channels":1,"frame_duration":60}}
```

服务器→设备：
```json
{"type":"hello","transport":"websocket","session_id":"xxx",
 "audio_params":{"format":"opus","sample_rate":24000,"frame_duration":60}}
```

#### 音频传输（BinaryProtocol3）
```
uint8_t type(0=OPUS) | uint8_t reserved | uint16_t payload_size | uint8_t payload[]
```

#### 控制消息
| 方向 | type | 说明 |
|------|------|------|
| 设备→服务器 | listen | start/stop/detect + mode(auto/manual/realtime) |
| 设备→服务器 | abort | 中断TTS |
| 服务器→设备 | stt | 语音识别文本 |
| 服务器→设备 | tts | start/stop/sentence_start |
| 服务器→设备 | llm | 情绪/表情指令 |
| 服务器→设备 | mcp | MCP设备控制(JSON-RPC 2.0) |
| 服务器→设备 | system | 系统命令(reboot等) |

#### MCP设备控制
```json
// 服务器→设备：调用工具
{"session_id":"xxx","type":"mcp","payload":{
  "jsonrpc":"2.0","method":"tools/call",
  "params":{"name":"self.light.set_rgb","arguments":{"r":255,"g":0,"b":0}},"id":1}}

// 设备→服务器：返回结果
{"session_id":"xxx","type":"mcp","payload":{
  "jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"true"}],"isError":false}}}
```

### Unity ↔ AI Service（LLM模式）
- WebSocket 长连接
- JSON 消息格式
- 流式响应(SSE)

### Unity ↔ Device Service  
- REST API
- 设备状态 WebSocket 实时推送

## 目录结构

```
amber-virtual/
├── config/
│   └── dev.env.example          # 环境配置模板（双模式）
├── docs/
│   └── architecture.md          # 本文档
├── server/
│   ├── ai-service/
│   │   ├── index.ts             # AI服务入口（路由双模式）
│   │   ├── xiaozhi-client.ts    # 小智AI WebSocket客户端
│   │   ├── llm-client.ts        # LLM API直连客户端
│   │   └── audio-codec.ts       # OPUS编解码工具
│   └── device-service/
│       └── index.ts             # 设备控制服务
└── unity-app/Assets/Scripts/
    ├── AI/
    │   ├── AIBridgeBase.cs       # AI桥接基类
    │   ├── XiaoZhiAIBridge.cs    # 小智AI模式桥接
    │   └── LLMAIBridge.cs        # LLM直连模式桥接
    ├── Avatar/
    │   └── AvatarLipSync.cs      # 口型同步
    └── Device/
        └── DeviceControlBridge.cs # 设备控制桥接
```

## 依赖

- Unity 2022.3 LTS
- Node.js 18+
- MQTT Broker (Mosquitto)
- 小智AI：xiaozhi.me账号 或 自建xiaozhi-esp32-server
- LLM模式：DeepSeek/Qwen API Key + SenseVoice + CosyVoice