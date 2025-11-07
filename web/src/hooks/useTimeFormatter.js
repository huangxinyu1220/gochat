import { useCallback } from 'react';

/**
 * 消息时间格式化相关的自定义hooks
 * 提供各种时间格式化功能
 */

export const useTimeFormatter = () => {
  // 格式化最后消息时间 - 修复时区问题
  const formatLastMessageTime = useCallback((timestamp) => {
    if (!timestamp) return '';

    let date;
    if (typeof timestamp === 'string') {
      // 检查是否已经是ISO格式（包含T和Z）
      if (timestamp.includes('T') && timestamp.endsWith('Z')) {
        // 已经是ISO格式，直接使用
        date = new Date(timestamp);
      } else {
        // 后端返回的UTC时间字符串，格式如 "2025-11-03 03:45:59"
        // 强制作为UTC时间处理，转换为本地时间显示
        const utcTimestamp = timestamp.replace(' ', 'T') + 'Z';
        date = new Date(utcTimestamp);
      }
    } else if (typeof timestamp === 'number') {
      // 数字时间戳
      date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
    } else {
      date = new Date(timestamp);
    }

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', timestamp);
      return '';
    }

    const now = new Date();
    const diff = now - date;

    // 使用本地时间进行日期比较
    const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateLocal = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDiff = Math.floor((nowLocal - dateLocal) / 86400000);

    if (diff < 60000) { // 1分钟内
      return '刚刚';
    } else if (diff < 3600000) { // 1小时内
      return `${Math.floor(diff / 60000)}分钟前`;
    } else if (dayDiff === 0) { // 今天
      // 使用转换后的本地时间显示
      const localHour = date.getHours();
      const localMinute = date.getMinutes();
      const timeStr = `${String(localHour).padStart(2, '0')}:${String(localMinute).padStart(2, '0')}`;
      return timeStr;
    } else if (dayDiff === 1) { // 昨天
      return '昨天';
    } else if (now.getFullYear() === date.getFullYear()) { // 今年
      return `${date.getMonth() + 1}-${date.getDate()}`;
    } else { // 今年以前
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }
  }, []);

  // 格式化hover时间 - 企业微信风格：月/日 时:分
  const formatHoverTime = useCallback((timestamp) => {
    let date;
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
    } else {
      date = new Date(timestamp);
    }

    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${month}/${day} ${hours}:${minutes}`;
  }, []);

  // 格式化时间分隔线显示
  const formatTimeDivider = useCallback((timestamp) => {
    let date;
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
    } else {
      date = new Date(timestamp);
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = (today - messageDate) / (1000 * 60 * 60 * 24);

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (diffDays === 0) {
      // 今天：显示上午/下午 + 时间
      const period = date.getHours() < 12 ? '上午' : '下午';
      const displayHour = date.getHours() === 0 ? 12 : (date.getHours() > 12 ? date.getHours() - 12 : date.getHours());
      return `${period} ${String(displayHour).padStart(2, '0')}:${minutes}`;
    } else if (diffDays === 1) {
      // 昨天
      return `昨天 ${timeStr}`;
    } else if (diffDays < 7) {
      // 一周内：显示星期
      const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      return `${weekdays[date.getDay()]} ${timeStr}`;
    } else {
      // 更早：显示月/日
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}月${day}日 ${timeStr}`;
    }
  }, []);

  // 通用格式化时间功能
  const formatTime = useCallback((timestamp) => {
    // 确保时间戳是正确的格式，如果是字符串则解析，如果是数字则直接使用
    let date;
    if (typeof timestamp === 'string') {
      // 后端返回的ISO字符串，直接解析
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      // 数字时间戳，检查是否是毫秒级别
      date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
    } else {
      date = new Date(timestamp);
    }

    const now = new Date();
    const diff = now - date;

    if (diff < 60000) { // 1分钟内
      return '刚刚';
    } else if (diff < 3600000) { // 1小时内
      return `${Math.floor(diff / 60000)}分钟前`;
    } else if (diff < 86400000) { // 24小时内
      return `${Math.floor(diff / 3600000)}小时前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  }, []);

  return {
    formatLastMessageTime,
    formatHoverTime,
    formatTimeDivider,
    formatTime
  };
};

/**
 * 消息内容格式化相关hooks
 */
export const useMessageFormatter = () => {
  // 格式化会话列表的最后一条消息内容
  const formatLastMessageContent = useCallback((content, msgType) => {
    if (!content) return '';

    // 如果是图片消息，显示 [图片]
    if (msgType === 2) {
      return '[图片]';
    }

    // 文本消息直接显示
    return content;
  }, []);

  return {
    formatLastMessageContent
  };
};