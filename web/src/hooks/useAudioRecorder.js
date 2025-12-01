import { useState, useRef, useCallback, useEffect } from 'react';

// 最大录音时长（秒）
const MAX_DURATION = 60;
// 最小录音时长（秒）
const MIN_DURATION = 1;

/**
 * 音频录制 Hook
 * 支持浏览器原生录音，自动处理不同浏览器的兼容性
 */
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // 获取支持的 MIME 类型
  const getSupportedMimeType = useCallback(() => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return null;
  }, []);

  // 获取文件扩展名
  const getFileExtension = useCallback((mimeType) => {
    if (mimeType.includes('webm')) return '.webm';
    if (mimeType.includes('mp4')) return '.mp4';
    if (mimeType.includes('ogg')) return '.ogg';
    if (mimeType.includes('wav')) return '.wav';
    return '.webm';
  }, []);

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setPermissionDenied(false);
      setAudioBlob(null);

      // 检查是否在安全上下文中（HTTPS 或 localhost）
      const isSecureContext = window.isSecureContext;
      const isLocalhost = window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1' ||
                          window.location.hostname.startsWith('192.168.');

      console.log('[AudioRecorder] 环境检测:', {
        isSecureContext,
        isLocalhost,
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        hasMediaRecorder: !!window.MediaRecorder,
      });

      // 检查浏览器支持
      if (!navigator.mediaDevices) {
        if (!isSecureContext && !isLocalhost) {
          throw new Error('录音功能需要 HTTPS 安全连接。请使用 https:// 访问，或使用 localhost 进行本地开发。');
        }
        throw new Error('您的浏览器不支持录音功能（mediaDevices API 不可用）');
      }

      if (!navigator.mediaDevices.getUserMedia) {
        throw new Error('您的浏览器不支持 getUserMedia API');
      }

      if (!window.MediaRecorder) {
        throw new Error('您的浏览器不支持 MediaRecorder API');
      }

      // 请求麦克风权限
      console.log('[AudioRecorder] 请求麦克风权限...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.log('[AudioRecorder] 麦克风权限获取成功');

      streamRef.current = stream;

      // 获取支持的 MIME 类型
      const mimeType = getSupportedMimeType();
      console.log('[AudioRecorder] 支持的 MIME 类型:', mimeType);

      if (!mimeType) {
        throw new Error('您的浏览器不支持任何音频录制格式');
      }

      // 创建 MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000, // 64kbps，平衡质量和文件大小
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // 数据可用时收集
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // 录音停止时处理
      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType;
        const blob = new Blob(audioChunksRef.current, { type: mimeType });

        // 添加文件扩展名信息
        const extension = getFileExtension(mimeType);
        blob.extension = extension;
        blob.mimeType = mimeType;

        setAudioBlob(blob);
      };

      // 错误处理
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        setError('录音过程中发生错误');
        stopRecording();
      };

      // 开始录音
      mediaRecorder.start(100); // 每100ms收集一次数据
      setIsRecording(true);
      setDuration(0);
      startTimeRef.current = Date.now();

      // 启动计时器
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);

        // 达到最大时长自动停止
        if (elapsed >= MAX_DURATION) {
          stopRecording();
        }
      }, 100);

    } catch (err) {
      console.error('Failed to start recording:', err);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setError('麦克风权限被拒绝，请在浏览器设置中允许使用麦克风');
      } else if (err.name === 'NotFoundError') {
        setError('未检测到麦克风设备');
      } else {
        setError(err.message || '无法启动录音');
      }

      cleanup();
    }
  }, [getSupportedMimeType, getFileExtension]);

  // 停止录音
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // 停止计时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // 停止媒体流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  }, []);

  // 取消录音
  const cancelRecording = useCallback(() => {
    stopRecording();
    setAudioBlob(null);
    setDuration(0);
    audioChunksRef.current = [];
  }, [stopRecording]);

  // 清理资源
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }

    audioChunksRef.current = [];
    setIsRecording(false);
  }, []);

  // 检查录音时长是否有效
  const isValidDuration = useCallback(() => {
    return duration >= MIN_DURATION;
  }, [duration]);

  // 格式化时长显示
  const formatDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    duration,
    audioBlob,
    error,
    permissionDenied,
    startRecording,
    stopRecording,
    cancelRecording,
    isValidDuration,
    formatDuration,
    maxDuration: MAX_DURATION,
    minDuration: MIN_DURATION,
  };
}

export default useAudioRecorder;
