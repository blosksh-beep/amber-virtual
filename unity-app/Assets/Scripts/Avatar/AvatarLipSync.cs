using UnityEngine;

/// <summary>
/// 口型同步 - 根据AI语音输出驱动角色口型
/// </summary>
[RequireComponent(typeof(AudioSource))]
public class AvatarLipSync : MonoBehaviour
{
    [SerializeField] private AudioSource audioSource;
    [SerializeField] private SkinnedMeshRenderer faceMesh;
    [SerializeField] private int mouthBlendShapeIndex = 0;

    private void Update()
    {
        if (audioSource != null && audioSource.isPlaying)
        {
            float[] samples = new float[256];
            audioSource.GetOutputData(samples, 0);
            float amplitude = 0f;
            foreach (var s in samples) amplitude += Mathf.Abs(s);
            amplitude /= samples.Length;

            if (faceMesh != null)
            {
                faceMesh.SetBlendShapeWeight(mouthBlendShapeIndex, amplitude * 100f);
            }
        }
    }
}