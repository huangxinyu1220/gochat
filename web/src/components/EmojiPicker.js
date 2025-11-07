import React, { useState } from 'react';
import { Popover } from 'antd';

// 常用表情列表 - 分类展示
const EMOJI_CATEGORIES = {
  '笑脸': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗'],
  '手势': ['👍', '👎', '👌', '🤝', '👏', '🙏', '💪', '🤞', '✌️', '🤟', '👋', '🤚', '👊', '✊', '🤛', '🤜', '🖐️', '✋'],
  '情绪': ['😢', '😭', '😤', '😠', '😡', '🤬', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😬', '🙄'],
  '爱心': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  '其他': ['🔥', '⭐', '✨', '💯', '✅', '❌', '❓', '❗', '💤', '💢', '👀', '🎉', '🎊', '🎁', '🌹', '☀️', '🌈', '⚡'],
};

const EmojiPicker = ({ onSelect, children }) => {
  const [hoveredEmoji, setHoveredEmoji] = useState(null);

  const content = (
    <div style={{
      width: '340px', // 减小宽度
      maxHeight: '280px', // 减小高度
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '4px 8px 8px 8px', // 增加右侧padding防止遮挡
    }}>
      {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
        <div key={category} style={{ marginBottom: '10px' }}>
          <div style={{
            fontSize: '11px',
            color: '#999',
            marginBottom: '6px',
            fontWeight: '600',
            paddingLeft: '2px',
          }}>
            {category}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: '4px',
          }}>
            {emojis.map((emoji, index) => (
              <div
                key={`${emoji}-${index}`}
                onClick={() => onSelect(emoji)}
                onMouseEnter={() => setHoveredEmoji(`${category}-${index}`)}
                onMouseLeave={() => setHoveredEmoji(null)}
                style={{
                  fontSize: '22px', // 减小emoji尺寸
                  cursor: 'pointer',
                  padding: '4px', // 减小内边距
                  borderRadius: '6px',
                  textAlign: 'center',
                  userSelect: 'none',
                  background: hoveredEmoji === `${category}-${index}` ? '#e6f7ff' : 'transparent',
                  transform: hoveredEmoji === `${category}-${index}` ? 'scale(1.25)' : 'scale(1)', // 减小放大倍数
                  transition: 'all 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                  boxShadow: hoveredEmoji === `${category}-${index}` ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
                  zIndex: hoveredEmoji === `${category}-${index}` ? 10 : 1,
                  position: 'relative',
                }}
              >
                <span style={{
                  display: 'inline-block',
                  animation: hoveredEmoji === `${category}-${index}` ? 'bounce 0.6s ease' : 'none',
                }}>
                  {emoji}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* CSS 动画定义 */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          25% { transform: translateY(-6px); }
          50% { transform: translateY(-3px); }
          75% { transform: translateY(-4px); }
        }

        /* 自定义滚动条样式 */
        div::-webkit-scrollbar {
          width: 5px;
        }

        div::-webkit-scrollbar-track {
          background: #f5f5f5;
          border-radius: 3px;
        }

        div::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 3px;
        }

        div::-webkit-scrollbar-thumb:hover {
          background: #aaa;
        }
      `}</style>
    </div>
  );

  return (
    <Popover
      content={content}
      title={<span style={{ fontSize: '13px', fontWeight: '600' }}>选择表情</span>}
      trigger="click"
      placement="topLeft"
      overlayStyle={{ zIndex: 1000 }}
      styles={{ body: { padding: '8px 4px' } }}
    >
      {children}
    </Popover>
  );
};

export default EmojiPicker;
