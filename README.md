# 琥珀虚颜 (Amber Virtual)

Unity 虚拟形象应用，集成小智AI对话能力与智能家居设备控制。

## 架构

```
amber-virtual/
+-- unity-app/              # Unity 前端项目
|   +-- Assets/
|   |   +-- Scripts/
|   |   |   +-- AI/         # 小智AI对话模块
|   |   |   +-- Device/     # 设备控制模块
|   |   |   +-- Avatar/     # 虚拟形象控制
|   |   |   +-- Core/       # 核心框架
|   |   +-- Plugins/
|   +-- Packages/
+-- server/                 # 后端服务
|   +-- ai-service/         # 小智AI对接服务
|   +-- device-service/     # 设备控制网关
+-- docs/                   # 文档
+-- config/                 # 配置文件
```

## 模块说明

### 小智AI对话
- 语音识别 - 小智AI - 语音合成
- 支持多轮上下文对话
- 流式响应，低延迟

### 设备控制
- 支持主流智能家居协议(MQTT/HTTP)
- 语音指令 - 意图识别 - 设备操作
- 设备状态实时反馈

### 虚拟形象
- 基于 Unity 的3D/2D角色渲染
- 口型同步(Lip Sync)
- 表情驱动

## 开发计划

- [ ] Phase 1: 小智AI对话接入
- [ ] Phase 2: 语音交互闭环
- [ ] Phase 3: 设备控制集成
- [ ] Phase 4: 虚拟形象联动

## 技术栈

- 前端: Unity 2022 LTS
- AI: 小智AI OpenAPI
- 设备: MQTT / Home Assistant
- 后端: Node.js / Python