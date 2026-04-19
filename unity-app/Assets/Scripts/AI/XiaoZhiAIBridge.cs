using UnityEngine;
using System;
using System.Collections;
using System.Text;
using NativeWebSocket;

/// <summary>
/// AI桥接基类 - 统一两种AI模式的接口
/// </summary>
public abstract class AIBridgeBase : MonoBehaviour
{
    [Header("通用配置")]
    [SerializeField] protected string aiMode = "xiaozhi"; // xiaozhi | llm
    
    public event Action<string> OnSTT;           // 语音识别结果
    public event Action OnTTSStart;              // 开始播放
    public event Action OnTTSStop;               // 停止播放
    public event Action<byte[]> OnTTSAudio;      // TTS音频数据
    public event Action<string> OnEmotion;       // 情绪变化
    public event Action<string> OnMCPMessage;    // MCP设备控制消息
    public event Action<string> OnError;         // 错误

    public abstract IEnumerator Connect();
    public abstract void SendAudio(byte[] opusData);
    public abstract void StartListening(string mode = "auto");
    public abstract void StopListening();
    public abstract void AbortSpeaking();
    public abstract void Disconnect();
}

/// <summary>
/// 小智AI模式桥接 - WebSocket实时语音流
/// 协议: hello握手 + OPUS音频 + JSON控制消息 + MCP
/// </summary>
public class XiaoZhiAIBridge : AIBridgeBase
{
    [Header("小智AI配置")]
    [SerializeField] private string wsUrl = "ws://localhost:8000/xiaozhi/v1/";
    [SerializeField] private string token = "";
    [SerializeField] private int protocolVersion = 3;
    [SerializeField] private string deviceId = "c6:38:a3:4f:f6:df";
    [SerializeField] private string clientId = "";

    private WebSocket ws;
    private string sessionId = "";
    private int serverSampleRate = 24000;
    private int serverFrameDuration = 60;

    private void Awake()
    {
        if (string.IsNullOrEmpty(clientId))
            clientId = Guid.NewGuid().ToString();
    }

    public override IEnumerator Connect()
    {
        ws = new WebSocket(wsUrl);
        
        // 设置请求头
        ws.SetHeader("Protocol-Version", protocolVersion.ToString());
        ws.SetHeader("Device-Id", deviceId);
        ws.SetHeader("Client-Id", clientId);
        if (!string.IsNullOrEmpty(token))
        {
            var auth = token.Contains(" ") ? token : $"Bearer {token}";
            ws.SetHeader("Authorization", auth);
        }

        ws.OnMessage += OnMessage;
        ws.OnError += (e) => OnError?.Invoke(e);
        ws.OnClose += (e) => OnError?.Invoke("WebSocket closed");

        yield return ws.Connect();
        
        // 发送hello握手
        var hello = new {
            type = "hello",
            version = protocolVersion,
            features = new { mcp = true },
            transport = "websocket",
            audio_params = new {
                format = "opus",
                sample_rate = 16000,
                channels = 1,
                frame_duration = 60
            }
        };
        ws.SendText(JsonUtility.ToJson(hello));
    }

    public override void SendAudio(byte[] opusData)
    {
        if (ws == null || ws.State != WebSocketState.Open) return;

        if (protocolVersion == 3)
        {
            // BinaryProtocol3: type(1) + reserved(1) + payload_size(2) + payload
            var header = new byte[4];
            header[0] = 0; // type = OPUS
            header[1] = 0; // reserved
            header[2] = (byte)((opusData.Length >> 8) & 0xFF);
            header[3] = (byte)(opusData.Length & 0xFF);
            var packet = new byte[4 + opusData.Length];
            Buffer.BlockCopy(header, 0, packet, 0, 4);
            Buffer.BlockCopy(opusData, 0, packet, 4, opusData.Length);
            ws.Send(packet);
        }
        else
        {
            ws.Send(opusData); // Version 1: 直接发
        }
    }

    public override void StartListening(string mode = "auto")
    {
        SendJson(new { session_id = sessionId, type = "listen", state = "start", mode });
    }

    public override void StopListening()
    {
        SendJson(new { session_id = sessionId, type = "listen", state = "stop" });
    }

    public override void AbortSpeaking()
    {
        SendJson(new { session_id = sessionId, type = "abort" });
    }

    public override void Disconnect()
    {
        ws?.Close();
    }

    private void OnMessage(byte[] data)
    {
        // 区分文本/二进制：二进制首字节 < 32 视为协议头
        if (data.Length > 0 && data[0] < 32)
        {
            HandleBinary(data);
        }
        else
        {
            HandleText(Encoding.UTF8.GetString(data));
        }
    }

    private void HandleText(string text)
    {
        var msg = JsonUtility.FromJson<XiaoZhiMessage>(text);
        switch (msg.type)
        {
            case "hello":
                sessionId = msg.session_id ?? "";
                break;
            case "stt":
                OnSTT?.Invoke(msg.text);
                break;
            case "tts":
                if (msg.state == "start") OnTTSStart?.Invoke();
                else if (msg.state == "stop") OnTTSStop?.Invoke();
                break;
            case "llm":
                OnEmotion?.Invoke(msg.emotion ?? "neutral");
                break;
            case "mcp":
                OnMCPMessage?.Invoke(JsonUtility.ToJson(msg.payload));
                break;
        }
    }

    private void HandleBinary(byte[] data)
    {
        if (protocolVersion == 3 && data.Length > 4)
        {
            // BinaryProtocol3
            var payloadSize = (data[2] << 8) | data[3];
            var payload = new byte[payloadSize];
            Buffer.BlockCopy(data, 4, payload, 0, payloadSize);
            OnTTSAudio?.Invoke(payload);
        }
        else
        {
            OnTTSAudio?.Invoke(data);
        }
    }

    private void SendJson(object obj)
    {
        if (ws != null && ws.State == WebSocketState.Open)
            ws.SendText(JsonUtility.ToJson(obj));
    }

    [Serializable]
    private class XiaoZhiMessage
    {
        public string type;
        public string session_id;
        public string state;
        public string text;
        public string emotion;
        public string mode;
        public object payload;
    }
}

/// <summary>
/// LLM直连模式桥接 - HTTP API
/// 需自建ASR/TTS
/// </summary>
public class LLMAIBridge : AIBridgeBase
{
    [Header("LLM配置")]
    [SerializeField] private string apiKey = "";
    [SerializeField] private string endpoint = "https://api.deepseek.com/v1";
    [SerializeField] private string model = "deepseek-chat";
    [SerializeField] private string asrEndpoint = "http://localhost:8001/asr";
    [SerializeField] private string ttsEndpoint = "http://localhost:8002/tts";

    public override IEnumerator Connect()
    {
        // 验证API可用性
        yield return null;
    }

    public override void SendAudio(byte[] opusData)
    {
        StartCoroutine(ProcessAudio(opusData));
    }

    private IEnumerator ProcessAudio(byte[] audioData)
    {
        // 1. ASR
        // TODO: HTTP POST to asrEndpoint with audioData
        yield return null;
        var userText = ""; // ASR result
        OnSTT?.Invoke(userText);

        // 2. LLM
        // TODO: HTTP POST to endpoint/chat/completions
        yield return null;
        var aiText = ""; // LLM result
        OnEmotion?.Invoke("happy");

        // 3. TTS
        OnTTSStart?.Invoke();
        // TODO: HTTP POST to ttsEndpoint
        yield return null;
        OnTTSAudio?.Invoke(new byte[0]); // TTS audio
        OnTTSStop?.Invoke();
    }

    public override void StartListening(string mode = "auto") { }
    public override void StopListening() { }
    public override void AbortSpeaking() { }
    public override void Disconnect() { }
}
