import React, { useEffect, useRef } from 'react';
import { Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';

/**
 * 群聊九宫格头像组件
 * @param {Array} members - 群成员列表，第一个是群主
 * @param {Number} size - 头像大小，默认40
 */
const GroupAvatar = ({ members = [], size = 40 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || members.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // 设置canvas实际大小
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    // 缩放context以适应高DPI屏幕
    ctx.scale(dpr, dpr);

    // 清空画布
    ctx.clearRect(0, 0, size, size);

    // 绘制背景
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, size, size);

    // 根据成员数量决定布局
    const count = Math.min(members.length, 9);
    let layout;

    if (count === 1) {
      layout = [[0]];
    } else if (count === 2) {
      layout = [[0], [1]];
    } else if (count === 3) {
      layout = [[0], [1, 2]];
    } else if (count === 4) {
      layout = [[0, 1], [2, 3]];
    } else if (count === 5) {
      layout = [[0, 1], [2, 3, 4]];
    } else if (count === 6) {
      layout = [[0, 1, 2], [3, 4, 5]];
    } else if (count === 7) {
      layout = [[0, 1], [2, 3, 4], [5, 6]];
    } else if (count === 8) {
      layout = [[0, 1, 2], [3, 4, 5], [6, 7]];
    } else {
      layout = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];
    }

    const rows = layout.length;
    const gap = 2; // 间距
    const totalGap = (rows - 1) * gap;
    const itemSize = (size - totalGap) / rows;

    // 绘制每个成员头像
    const promises = [];
    layout.forEach((row, rowIndex) => {
      const cols = row.length;
      const rowWidth = itemSize * cols + gap * (cols - 1);
      const startX = (size - rowWidth) / 2;

      row.forEach((memberIndex, colIndex) => {
        const member = members[memberIndex];
        if (!member) return;

        const x = startX + colIndex * (itemSize + gap);
        const y = rowIndex * (itemSize + gap);

        // 如果有头像URL，加载并绘制
        if (member.avatar) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          const promise = new Promise((resolve) => {
            img.onload = () => {
              ctx.save();
              // 绘制圆角矩形裁剪区域
              const radius = itemSize * 0.1;
              ctx.beginPath();
              ctx.moveTo(x + radius, y);
              ctx.lineTo(x + itemSize - radius, y);
              ctx.quadraticCurveTo(x + itemSize, y, x + itemSize, y + radius);
              ctx.lineTo(x + itemSize, y + itemSize - radius);
              ctx.quadraticCurveTo(x + itemSize, y + itemSize, x + itemSize - radius, y + itemSize);
              ctx.lineTo(x + radius, y + itemSize);
              ctx.quadraticCurveTo(x, y + itemSize, x, y + itemSize - radius);
              ctx.lineTo(x, y + radius);
              ctx.quadraticCurveTo(x, y, x + radius, y);
              ctx.closePath();
              ctx.clip();

              ctx.drawImage(img, x, y, itemSize, itemSize);
              ctx.restore();
              resolve();
            };
            img.onerror = () => {
              // 加载失败，绘制默认头像
              drawDefaultAvatar(ctx, x, y, itemSize, member.nickname);
              resolve();
            };
          });
          img.src = `/uploads/avatars/${member.avatar}`;
          promises.push(promise);
        } else {
          // 绘制默认头像（昵称首字母）
          drawDefaultAvatar(ctx, x, y, itemSize, member.nickname);
        }
      });
    });

    // 等待所有图片加载完成
    Promise.all(promises).then(() => {
      // 所有图片加载完成
    });

  }, [members, size]);

  // 绘制默认头像（昵称首字母）
  const drawDefaultAvatar = (ctx, x, y, itemSize, nickname) => {
    // 背景色
    const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2'];
    const colorIndex = (nickname?.charCodeAt(0) || 0) % colors.length;

    ctx.fillStyle = colors[colorIndex];
    ctx.fillRect(x, y, itemSize, itemSize);

    // 文字
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${itemSize * 0.5}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = nickname?.charAt(0) || '?';
    ctx.fillText(text, x + itemSize / 2, y + itemSize / 2);
  };

  if (members.length === 0) {
    return (
      <Avatar size={size} icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        borderRadius: '4px',
        display: 'block'
      }}
    />
  );
};

export default GroupAvatar;
