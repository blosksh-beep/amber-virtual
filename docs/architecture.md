# 琥珀虚颜 - 系统架构

## 整体流程

```
用户语音
   |
   v
[Unity 前端] --语音--> [AI Service] --文本--> [小智AI]
     ^                      |
     |                      v
     |               [意图识别]
     |                /       \
     v               v         v
[虚拟形象]    [对话响应]   [设备控制]
   |              |            |
   v              v            v
口型/表情     语音合成     MQTT/HTTP
```

## 通信协议

### Unity ↔ AI Service
- WebSocket 长连接
- JSON 消息格式
- 支持流式响应

### Unity ↔ Device Service  
- REST API
- 设备状态通过 WebSocket 实时推送

### AI Service ↔ 小智AI
- HTTP REST API
- 支持流式(SSE)响应

### Device Service ↔ 设备
- MQTT 发布/订阅
- HTTP 直连(部分设备)

## 依赖

- Unity 2022.3 LTS
- Node.js 18+
- MQTT Broker (Mosquitto)
- 小智AI API Key