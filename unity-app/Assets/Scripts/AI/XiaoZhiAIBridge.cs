using UnityEngine;
using System;
using System.Collections;

/// <summary>
/// 小智AI对话桥接 - Unity端
/// 连接Unity前端与小智AI后端服务
/// </summary>
public class XiaoZhiAIBridge : MonoBehaviour
{
    [Header("AI Service Config")]
    [SerializeField] private string serviceUrl = "http://localhost:3000";
    [SerializeField] private float requestTimeout = 10f;

    public event Action<string> OnAIResponse;
    public event Action<string> OnError;

    public void SendUserMessage(string message)
    {
        StartCoroutine(SendMessageCoroutine(message));
    }

    private IEnumerator SendMessageCoroutine(string message)
    {
        // TODO: HTTP POST to ai-service
        // var request = UnityEngine.Networking.UnityWebRequest.Post(...)
        yield return null;
        OnAIResponse?.Invoke("响应占位");
    }
}