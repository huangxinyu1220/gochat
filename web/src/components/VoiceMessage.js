import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CaretRightOutlined, PauseOutlined } from '@ant-design/icons';
import './VoiceMessage.css';

/**
 * 语音消息播放组件 - 极简设计
 * @param {string} src - 语音文件URL（支持 url|duration 格式）
 * @param {number} duration - 语音时长（秒）
 * @param {boolean} isSelf - 是否是自己发送的消息
 */
function VoiceMessage({ src, duration: propDuration, isSelf }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(propDuration || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const audioRef = useRef(null);

  // 解析语音URL和时长（支持 url|duration 格式）
  const parseVoiceData = useCallback(() => {
    if (!src) return { url: '', duration: 0 };

    if (src.includes('|')) {
      const [url, dur] = src.split('|');
      return { url, duration: parseFloat(dur) || 0 };
    }

    return { url: src, duration: propDuration || 0 };
  }, [src, propDuration]);

  const { url: voiceUrl, duration: parsedDuration } = parseVoiceData();

  // 更新时长
  useEffect(() => {
    if (parsedDuration > 0) {
      setDuration(parsedDuration);
    }
  }, [parsedDuration]);

  // 格式化时长显示
  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0''";
    const roundedSeconds = Math.round(seconds);
    if (roundedSeconds < 60) {
      return `${roundedSeconds}''`;
    }
    const mins = Math.floor(roundedSeconds / 60);
    const secs = roundedSeconds % 60;
    return `${mins}'${secs.toString().padStart(2, '0')}''`;
  };

  // 播放/暂停切换
  const togglePlay = async (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        setError(null);

        // 停止其他正在播放的语音
        const allAudios = document.querySelectorAll('audio');
        allAudios.forEach(audio => {
          if (audio !== audioRef.current && !audio.paused) {
            audio.pause();
            audio.dispatchEvent(new Event('pause'));
          }
        });

        await audioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Failed to play audio:', err);
      setError('无法播放');
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  // 监听音频加载完成
  const handleLoadedMetadata = () => {
    if (audioRef.current && !propDuration) {
      setDuration(audioRef.current.duration);
    }
    setIsLoading(false);
  };

  // 监听播放结束
  const handleEnded = () => {
    setIsPlaying(false);
  };

  // 监听暂停
  const handlePause = () => {
    setIsPlaying(false);
  };

  // 监听错误
  const handleError = () => {
    setError('加载失败');
    setIsLoading(false);
    setIsPlaying(false);
  };

  // 清理
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // 计算气泡宽度（根据时长动态调整）
  const getBubbleWidth = () => {
    // 基础宽度 80px，每秒增加 3px，最大 180px
    const baseWidth = 80;
    const maxWidth = 180;
    const width = Math.min(maxWidth, baseWidth + duration * 3);
    return `${width}px`;
  };

  // 获取完整的语音URL
  const getFullUrl = () => {
    if (!voiceUrl) return '';
    if (voiceUrl.startsWith('http')) return voiceUrl;
    if (voiceUrl.startsWith('/')) {
      return `${window.location.origin}${voiceUrl}`;
    }
    return voiceUrl;
  };

  // 生成波形条
  const renderWaveBars = () => {
    const bars = [];
    const barCount = 4;

    for (let i = 0; i < barCount; i++) {
      bars.push(
        <span
          key={i}
          className={`voice-bar ${isPlaying ? 'playing' : ''}`}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      );
    }
    return bars;
  };

  return (
    <div
      className={`voice-msg ${isSelf ? 'voice-msg-self' : 'voice-msg-other'} ${isPlaying ? 'is-playing' : ''} ${error ? 'has-error' : ''}`}
      style={{ width: getBubbleWidth() }}
      onClick={togglePlay}
    >
      <audio
        ref={audioRef}
        src={getFullUrl()}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPause={handlePause}
        onError={handleError}
      />

      {isSelf ? (
        // 自己发送的语音：播放按钮在左，波形在中间，时长在右
        <>
          <div className="voice-msg-btn">
            {isLoading ? (
              <div className="voice-msg-loading" />
            ) : isPlaying ? (
              <PauseOutlined className="voice-msg-icon" />
            ) : (
              <CaretRightOutlined className="voice-msg-icon" />
            )}
          </div>
          <div className="voice-msg-waves">
            {renderWaveBars()}
          </div>
          <div className="voice-msg-duration">
            {error || formatDuration(duration)}
          </div>
        </>
      ) : (
        // 对方发送的语音：时长在左，波形在中间，播放按钮在右
        <>
          <div className="voice-msg-duration">
            {error || formatDuration(duration)}
          </div>
          <div className="voice-msg-waves">
            {renderWaveBars()}
          </div>
          <div className="voice-msg-btn">
            {isLoading ? (
              <div className="voice-msg-loading" />
            ) : isPlaying ? (
              <PauseOutlined className="voice-msg-icon" />
            ) : (
              <CaretRightOutlined className="voice-msg-icon" style={{ transform: 'rotate(180deg)' }} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default VoiceMessage;
