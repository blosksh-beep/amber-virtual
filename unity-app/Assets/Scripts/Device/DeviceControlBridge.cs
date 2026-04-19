using UnityEngine;
using System;
using System.Collections;

/// <summary>
/// 设备控制桥接 - Unity端
/// 语音指令 → 意图识别 → 设备操作
/// </summary>
public class DeviceControlBridge : MonoBehaviour
{
    [Header("Device Service Config")]
    [SerializeField] private string serviceUrl = "http://localhost:3001";

    public event Action<string, bool> OnDeviceResponse;

    public void ControlDevice(string deviceId, string action)
    {
        StartCoroutine(ControlDeviceCoroutine(deviceId, action));
    }

    private IEnumerator ControlDeviceCoroutine(string deviceId, string action)
    {
        // TODO: HTTP POST to device-service
        yield return null;
        OnDeviceResponse?.Invoke(deviceId, true);
    }
}