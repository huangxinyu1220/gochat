import React, { useEffect, useRef } from 'react';
import { Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';

/**
 * 群聊九宫格头像组件 - 改进版
 * @param {Array} members - 群成员列表
 * @param {Number} size - 头像大小，默认40
 */
const GroupAvatar = ({ members = [], size = 40 }) => {
  const canvasRef = useRef(null);

  // 获取头像URL - 统一使用uploads/files目录
  const getAvatarSrc = (avatar) => {
    if (!avatar || avatar === 'default.png') {
      return null;
    }

    const baseURL = process.env.REACT_APP_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:8080';
    return `${baseURL}/uploads/files/${avatar}`;
  };

  // 计算统一的网格布局
  const calculateGridLayout = (count, totalSize) => {
    const gap = 2;
    let rows, cols;
    
    // 根据成员数量确定网格配置
    if (count === 1) {
      rows = 1; cols = 1;
    } else if (count === 2) {
      rows = 1; cols = 2;
    } else if (count === 3 || count === 4) {
      rows = 2; cols = 2;
    } else if (count >= 5) {
      rows = 3; cols = 3;
    }
    
    // 计算头像尺寸，确保完美居中
    const itemSize = Math.floor((totalSize - gap * (cols - 1)) / cols);
    const gridWidth = cols * itemSize + gap * (cols - 1);
    const gridHeight = rows * itemSize + gap * (rows - 1);
    
    // 计算起始偏移，确保网格完全居中
    const offsetX = Math.floor((totalSize - gridWidth) / 2);
    const offsetY = Math.floor((totalSize - gridHeight) / 2);
    
    const positions = [];
    
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      
      positions.push({
        x: offsetX + col * (itemSize + gap),
        y: offsetY + row * (itemSize + gap),
        size: itemSize
      });
    }
    
    return positions;
  };

  // 绘制默认头像（昵称首字母）
  const drawDefaultAvatar = (ctx, x, y, itemSize, nickname) => {
    // 背景色
    const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2'];
    const colorIndex = (nickname?.charCodeAt(0) || 0) % colors.length;

    ctx.fillStyle = colors[colorIndex];
    
    // 绘制圆角矩形背景
    const radius = Math.min(itemSize * 0.1, 8);
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
    ctx.fill();

    // 文字
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(itemSize * 0.4)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = nickname?.charAt(0)?.toUpperCase() || '?';
    ctx.fillText(text, x + itemSize / 2, y + itemSize / 2);
  };

  useEffect(() => {
    if (!canvasRef.current || members.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // 设置canvas实际大小，考虑高DPI
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    // 缩放context以适应高DPI屏幕
    ctx.scale(dpr, dpr);

    // 清空画布
    ctx.clearRect(0, 0, size, size);

    // 绘制背景
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, size, size);

    // 获取显示的成员数量（最多9个）
    const displayMembers = members.slice(0, 9);
    const count = displayMembers.length;

    if (count === 0) return;

    // 计算统一网格布局
    const positions = calculateGridLayout(count, size);

    // 预加载图片并绘制
    const imagePromises = positions.map((pos, index) => {
      const member = displayMembers[index];
      if (!member) return Promise.resolve();

      const { x, y, size: itemSize } = pos;

      // 如果有头像URL，加载并绘制
      if (member.avatar) {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          img.onload = () => {
            ctx.save();
            
            // 创建圆角裁剪路径
            const radius = Math.min(itemSize * 0.15, 8);
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

            // 绘制图片
            ctx.drawImage(img, x, y, itemSize, itemSize);
            ctx.restore();
            resolve();
          };
          
          img.onerror = () => {
            // 加载失败，绘制默认头像
            drawDefaultAvatar(ctx, x, y, itemSize, member.nickname);
            resolve();
          };
          
          img.src = getAvatarSrc(member.avatar);
        });
      } else {
        // 绘制默认头像（昵称首字母）
        drawDefaultAvatar(ctx, x, y, itemSize, member.nickname);
        return Promise.resolve();
      }
    });

    // 等待所有图片加载完成
    Promise.all(imagePromises).then(() => {
      // 绘制完成，可以添加后续处理
    });

  }, [members, size]);

  if (members.length === 0) {
    return (
      <Avatar 
        size={size} 
        icon={<UserOutlined />} 
        style={{ 
          backgroundColor: '#87d068',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }} 
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        borderRadius: '4px',
        display: 'block',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}
    />
  );
};

export default GroupAvatar;
