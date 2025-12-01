import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { App } from 'antd';
import WebSocketClient from '../services/websocket';
import { useAuth } from './AuthContext';
import { getWsUrl } from '../config';

const WebSocketContext = createContext(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [wsClient, setWsClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectInfo, setReconnectInfo] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const messageHandlersRef = useRef([]);
  const { isAuthenticated, user } = useAuth();
  const { message } = App.useApp(); // 使用App hook获取message API
  const reconnectMessageKeyRef = useRef(null); // 存储重连消息的key

  const connectWebSocket = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('[WebSocket] 没有token，跳过连接');
        return;
      }

      const client = new WebSocketClient(getWsUrl(), token);

      // 连接成功事件
      client.on('connected', () => {
        console.log('[WebSocket] 连接已建立');
        setIsConnected(true);
        setIsReconnecting(false);
        setReconnectInfo(null);

        // 关闭重连提示
        if (reconnectMessageKeyRef.current) {
          message.destroy(reconnectMessageKeyRef.current);
          reconnectMessageKeyRef.current = null;
        }

        // 检查是否有队列消息需要发送
        const queueLength = client.getQueueLength();
        if (queueLength > 0) {
          message.success(`连接已恢复，正在发送${queueLength}条消息`, 2);
        }
      });

      // 断开连接事件
      client.on('disconnected', () => {
        console.log('[WebSocket] 连接已断开');
        setIsConnected(false);
      });

      // 重连事件（静默处理，不显示提示）
      client.on('reconnecting', (info) => {
        console.log('[WebSocket] 正在重连...', info);
        setIsReconnecting(true);
        setReconnectInfo(info);
        // 不显示任何提示，完全无感重连
      });

      // 网络离线事件
      client.on('network-offline', () => {
        message.warning('网络连接已断开，请检查网络');
      });

      // 消息入队事件
      client.on('message-queued', (msg) => {
        console.log('[WebSocket] 消息已加入队列:', msg);
        // 优化用户体验：使用更温和的提示，并且减少频率
        message.info('消息已发送，稍后将自动送达', 1.5);
      });

      // 队列消息发送成功事件
      client.on('message-sent-from-queue', (msg) => {
        console.log('[WebSocket] 队列消息已发送:', msg);
        // 可以在这里触发UI更新，标记消息为已发送状态
      });

      // 设置事件监听器
      client.on('system', (data) => {
        console.log('[WebSocket] 系统消息:', data);
        if (data.action === 'connected') {
          // 由 'connected' 事件统一处理
        }
      });

      client.on('online-status', (data) => {
        console.log('[WebSocket] 在线状态更新:', data);
        const { user_id, is_online } = data;
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          if (is_online) {
            newSet.add(user_id);
          } else {
            newSet.delete(user_id);
          }
          return newSet;
        });
      });

      // 添加全局消息处理，用于更新会话列表
      client.on('message', (data) => {
        console.log('[WebSocket] 全局收到新消息:', data);
        // 通知所有注册的消息处理器
        messageHandlersRef.current.forEach(handler => {
          try {
            handler('message', data);
          } catch (error) {
            console.error('[WebSocket] 消息处理器错误:', error);
          }
        });
      });

      client.on('message-ack', (data) => {
        console.log('[WebSocket] 全局收到消息确认:', data);
        // 通知所有注册的消息处理器
        messageHandlersRef.current.forEach(handler => {
          try {
            handler('message-ack', data);
          } catch (error) {
            console.error('[WebSocket] 消息确认处理器错误:', error);
          }
        });
      });

      client.on('error', (errorData) => {
        console.error('[WebSocket] 错误:', errorData);
        message.error(errorData.error || 'WebSocket错误');
      });

      // 连接断开处理
      const originalDisconnect = client.disconnect;
      client.disconnect = () => {
        setIsConnected(false);
        setIsReconnecting(false);
        originalDisconnect.call(client);
      };

      await client.connect();
      setWsClient(client);
      console.log('[WebSocket] 连接成功建立');

    } catch (error) {
      console.error('[WebSocket] 连接失败:', error);
      setIsConnected(false);
      message.error('WebSocket连接失败');
    }
  };

  const disconnectWebSocket = () => {
    if (wsClient) {
      wsClient.disconnect();
      setWsClient(null);
    }
    setIsConnected(false);
    setIsReconnecting(false);
    setReconnectInfo(null);
    setOnlineUsers(new Set());

    // 清除重连提示
    if (reconnectMessageKeyRef.current) {
      message.destroy(reconnectMessageKeyRef.current);
      reconnectMessageKeyRef.current = null;
    }
  };

  // 初始化WebSocket连接
  useEffect(() => {
    if (isAuthenticated && user) {
      connectWebSocket();
    } else {
      disconnectWebSocket();
    }

    return () => {
      if (wsClient) {
        wsClient.disconnect();
      }
    };
  }, [isAuthenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 发送消息的便捷方法
  const sendChatMessage = (targetId, content) => {
    if (!wsClient) {
      return false;
    }
    // 信任WebSocketClient的队列机制，不显示连接错误给用户
    return wsClient.sendChatMessage(targetId, content);
  };

  // 检查用户是否在线
  const isUserOnline = (userId) => {
    return onlineUsers.has(userId);
  };

  // 注册全局消息处理器
  const registerMessageHandler = (handler) => {
    messageHandlersRef.current.push(handler);

    // 返回取消注册函数
    return () => {
      messageHandlersRef.current = messageHandlersRef.current.filter(h => h !== handler);
    };
  };

  const value = {
    wsClient,
    isConnected,
    isReconnecting,
    reconnectInfo,
    onlineUsers: Array.from(onlineUsers),
    sendChatMessage,
    isUserOnline,
    connectWebSocket,
    disconnectWebSocket,
    registerMessageHandler,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext;