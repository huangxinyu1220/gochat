import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Spin, App, Image } from 'antd';
import { messageAPI } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import { getBaseUrl } from '../config';
import VoiceMessage from './VoiceMessage';

const ChatInterface = forwardRef(({ conversation, currentUser, inputValue, setInputValue, onSendMessage, onClearUnread }, ref) => {
  const { message } = App.useApp(); // 使用 App.useApp() 获取 message 实例
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false); // 加载更多历史消息状态
  const [hasMoreHistory, setHasMoreHistory] = useState(true); // 是否还有更多历史消息
  const [currentPage, setCurrentPage] = useState(1); // 当前页数
  const [showLoadTip, setShowLoadTip] = useState(false); // 是否显示加载提示
  const [hoveredMessageId, setHoveredMessageId] = useState(null); // 添加hover状态
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null); // 消息容器引用，用于滚动监听
  const loadingRequestRef = useRef(null); // 用于跟踪当前请求，防止重复
  const abortControllerRef = useRef(null); // 用于取消请求
  const currentConversationIdRef = useRef(null); // 追踪当前会话ID
  const inputValueRef = useRef(inputValue); // 追踪输入框内容，避免事件监听器频繁重新注册
  const { wsClient, isConnected } = useWebSocket();

  // 更新 inputValueRef
  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  // 滚动到底部 - 支持立即滚动和平滑滚动，确保完全滚动到底部
  const scrollToBottom = useCallback((smooth = true, retries = 3) => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const doScroll = () => {
      // 使用 scrollTop 确保精确滚动到底部
      const scrollHeight = container.scrollHeight;
      const targetScrollTop = scrollHeight - container.clientHeight;

      if (smooth) {
        container.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
      } else {
        container.scrollTop = targetScrollTop;
      }
    };

    // 立即执行第一次滚动
    doScroll();

    // 如果需要重试，在稍后再次尝试（处理图片等异步加载的情况）
    if (retries > 0) {
      setTimeout(() => {
        // 检查是否真的滚动到底部了
        const container = messagesContainerRef.current;
        if (container) {
          const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 5;
          if (!isAtBottom) {
            scrollToBottom(smooth, retries - 1);
          }
        }
      }, smooth ? 100 : 50);
    }
  }, []);

  // 加载历史消息
  const loadMessageHistory = useCallback(async (page = 1, isInitialLoad = false) => {
    if (!conversation) return;

    // 保存当前会话ID，用于后续验证（防止异步竞态条件）
    const requestConversationId = conversation.id;

    // 【重要】不要在这里abort，应该由useEffect统一管理
    // 只在这里创建新的AbortController用于当前请求
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 生成请求唯一标识
    const requestKey = `${conversation.id}_${page}_${isInitialLoad}`;

    // 防止重复请求
    if (isInitialLoad && loadingHistory) return;
    if (!isInitialLoad && loadingMore) return;

    // 检查是否有相同的请求正在进行
    if (loadingRequestRef.current === requestKey) {
      return;
    }

    // 标记当前请求
    loadingRequestRef.current = requestKey;

    if (isInitialLoad) {
      setLoadingHistory(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await messageAPI.getMessages({
        target_id: conversation.target_id,
        type: conversation.type,
        page: page,
        page_size: 50
      }, {
        signal: abortController.signal // 传递signal，支持取消请求
      });

      // 【关键修复】检查当前会话是否已切换，防止异步竞态条件
      if (!conversation || conversation.id !== requestConversationId) {
        console.warn('会话已切换，丢弃旧请求的响应:', {
          requestConversationId,
          currentConversationId: conversation?.id
        });
        return;
      }

      if (response.data && response.data.messages && Array.isArray(response.data.messages)) {
        // 再次验证会话ID（使用ref，更可靠）
        if (currentConversationIdRef.current !== requestConversationId) {
          console.warn('会话已切换(ref检查)，丢弃响应:', {
            requestConversationId,
            currentConversationId: currentConversationIdRef.current
          });
          return;
        }

        // 将后端消息转换为前端格式
        const formattedMessages = response.data.messages.map(msg => ({
          id: msg.id,
          from_user_id: msg.from_user_id,
          from_user: msg.from_user,
          content: msg.content,
          msg_type: msg.msg_type || 1, // 确保有msg_type字段，默认为1（文本）
          created_at: new Date(msg.created_at).getTime(),
          isSelf: msg.from_user_id === currentUser?.id,
        }));

        // 按时间正序排列（API返回的是倒序）
        formattedMessages.reverse();

        if (isInitialLoad) {
          // 在设置消息前最后一次验证
          if (currentConversationIdRef.current !== requestConversationId) {
            console.warn('会话已切换(设置消息前检查)，取消更新');
            return;
          }

          // 初始加载：直接设置消息
          setMessages(formattedMessages);

          // 多重保障机制确保滚动到底部
          // 1. 立即尝试滚动（requestAnimationFrame）
          requestAnimationFrame(() => {
            if (currentConversationIdRef.current === requestConversationId && messagesContainerRef.current) {
              messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
          });

          // 2. 延迟50ms再次尝试（确保DOM完全渲染）
          setTimeout(() => {
            if (currentConversationIdRef.current === requestConversationId && messagesContainerRef.current) {
              messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
          }, 50);

          // 3. 延迟200ms最后一次尝试（确保图片等异步内容加载）
          setTimeout(() => {
            if (currentConversationIdRef.current === requestConversationId && messagesContainerRef.current) {
              messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
          }, 200);
        } else {
          // 加载更多：保存当前滚动位置
          const container = messagesContainerRef.current;
          const oldScrollHeight = container?.scrollHeight || 0;

          // 将新消息插入到开头
          setMessages(prev => [...formattedMessages, ...prev]);

          // 恢复滚动位置，保持用户当前查看的位置
          setTimeout(() => {
            if (container) {
              const newScrollHeight = container.scrollHeight;
              const heightDiff = newScrollHeight - oldScrollHeight;
              container.scrollTop = container.scrollTop + heightDiff;
            }
          }, 0);
        }

        // 更新分页状态
        const pagination = response.data.pagination;
        setCurrentPage(page);
        setHasMoreHistory(page < pagination.total_page);
      } else {
        if (isInitialLoad) {
          setMessages([]);
        }
        setHasMoreHistory(false);
      }
    } catch (error) {
      // 如果是请求被取消，不显示错误（包括 AbortError 和 CanceledError）
      if (
        error.name === 'AbortError' ||
        error.name === 'CanceledError' ||
        error.code === 'ERR_CANCELED' ||
        error.message?.includes('abort') ||
        error.message?.includes('cancel')
      ) {
        return;
      }

      console.error('加载历史消息失败:', error);

      // 再次验证会话ID，防止错误提示显示在错误的会话
      if (!conversation || conversation.id !== requestConversationId) {
        console.warn('会话已切换，忽略错误处理');
        return;
      }

      if (isInitialLoad) {
        setMessages([]); // 加载失败时清空消息列表
      }
      setHasMoreHistory(false);
      message.error('加载历史消息失败');
    } finally {
      // 清除请求标识
      loadingRequestRef.current = null;

      // 再次验证会话ID，防止loading状态更新到错误的会话
      if (!conversation || conversation.id !== requestConversationId) {
        console.warn('会话已切换，跳过loading状态更新');
        return;
      }

      if (isInitialLoad) {
        setLoadingHistory(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [conversation, currentUser]); // 移除loading状态依赖，避免频繁重新创建函数

  // 初始化消息处理和历史加载
  useEffect(() => {
    if (conversation) {
      // 【关键】立即更新当前会话ID的ref（必须在最开始）
      currentConversationIdRef.current = conversation.id;

      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // 清除之前的请求标识
      loadingRequestRef.current = null;

      // 重置loading状态，确保可以发起新请求
      setLoadingHistory(false);
      setLoadingMore(false);

      // 先清空消息列表，避免显示上一个会话的消息
      setMessages([]);
      // 重置分页状态
      setCurrentPage(1);
      setHasMoreHistory(true);
      setShowLoadTip(false); // 重置加载提示

      // 发起新请求（移除了loadingHistory检查）
      loadMessageHistory(1, true);
    }

    // 清理函数：组件卸载时取消请求
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [conversation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 处理新消息
  const handleNewMessage = useCallback((data) => {
    // 检查消息是否属于当前会话
    if (!conversation) return;

    let isCurrentConversation = false;

    if (conversation.type === 1) {
      // 单聊：必须是来自目标用户且没有群组ID的消息
      isCurrentConversation =
        data.from_user_id === conversation.target_id &&
        !data.group_id; // 确保不是群聊消息
    } else if (conversation.type === 2) {
      // 群聊：必须是来自目标群组的消息
      isCurrentConversation =
        data.group_id === conversation.target_id;
    }

    if (!isCurrentConversation) return;

    const newMessage = {
      id: data.message_id,
      from_user_id: data.from_user_id,
      from_user: data.from_user,
      content: data.content,
      msg_type: data.msg_type || 1, // 确保有msg_type字段，默认为1（文本）
      created_at: data.created_at,
      isSelf: false,
    };
    setMessages(prev => [...prev, newMessage]);

    // 收到新消息时立即滚动到底部，使用多次重试确保完全滚动
    requestAnimationFrame(() => {
      scrollToBottom(true, 5); // 增加重试次数到5次，确保图片消息也能正确滚动
    });

    // 自动清除未读消息计数，因为用户正在查看此会话
    if (onClearUnread) {
      onClearUnread();
    }
  }, [conversation, onClearUnread, scrollToBottom]);

  // 处理消息确认
  const handleMessageAck = useCallback((data) => {
    // 更新本地消息状态，移除"发送中"标记
    setMessages(prev => prev.map(msg =>
      msg.id === data.message_id || (msg.isSelf && msg.sending)
        ? { ...msg, sending: false, id: data.message_id }
        : msg
    ));
  }, []);

  // 设置消息处理器
  const setupMessageHandlers = () => {
    if (!wsClient) return;

    // 移除旧的处理器（避免重复）
    wsClient.off('message', handleNewMessage);
    wsClient.off('message-ack', handleMessageAck);

    // 添加新的处理器
    wsClient.on('message', handleNewMessage);
    wsClient.on('message-ack', handleMessageAck);
  };

  // 独立的WebSocket处理器设置
  useEffect(() => {
    if (wsClient && conversation) {
      setupMessageHandlers();
    }

    return () => {
      // 清理消息处理器
      if (wsClient) {
        wsClient.off('message', handleNewMessage);
        wsClient.off('message-ack', handleMessageAck);
      }
    };
  }, [wsClient, handleNewMessage, handleMessageAck]); // eslint-disable-line react-hooks/exhaustive-deps

  // 加载更多历史消息
  const loadMoreHistory = useCallback(() => {
    if (!loadingMore && hasMoreHistory) {
      const nextPage = currentPage + 1;
      loadMessageHistory(nextPage, false);
    }
  }, [hasMoreHistory, currentPage, loadingMore]); // 移除loadMessageHistory依赖，避免循环依赖

  // 滚动监听：检测是否滚动到顶部
  useEffect(() => {
    let lastScrollTop = 0;

    const handleScroll = (e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.target;

      // 检测滚动方向
      const isScrollingUp = scrollTop < lastScrollTop;
      const isAtTop = scrollTop <= 5; // 更严格的顶部条件
      const isNearTop = scrollTop <= 50; // 接近顶部

      // 显示/隐藏加载提示
      if (hasMoreHistory) {
        setShowLoadTip(isNearTop);
      } else {
        setShowLoadTip(false);
      }

      // 只有当用户向上滚动且真正到达顶部时才触发加载
      if (isScrollingUp && isAtTop && hasMoreHistory && !loadingMore && !loadingHistory) {
        loadMoreHistory();
      }

      lastScrollTop = scrollTop;
    };

    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [hasMoreHistory, loadingMore, loadingHistory, loadMoreHistory]);

  // 发送消息 - 使用 useCallback 优化
  const handleSendMessage = useCallback((messageContent = null, messageType = 1) => {
    // 如果传入了消息内容（比如图片URL），直接使用；否则从输入框获取
    const content = messageContent || inputValue.trim();

    if (!content || !wsClient) {
      return;
    }

    // 如果是文本消息，发送WebSocket消息
    if (!messageContent) {
      const msgId = wsClient.sendChatMessage(conversation.target_id, content, 1, conversation.type);

      if (!msgId) return;
    }

    // 立即添加到本地消息列表（乐观更新）
    const newMessage = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 唯一临时ID
      from_user_id: currentUser.id,
      from_user: {
        id: currentUser.id,
        nickname: currentUser.nickname,
        avatar: currentUser.avatar,
      },
      content: content,
      msg_type: messageType, // 使用传入的消息类型
      created_at: Date.now(),
      isSelf: true,
      sending: true, // 标记为发送中
    };

    setMessages(prev => [...prev, newMessage]);

    // 只有文本消息才清空输入框
    if (!messageContent) {
      setInputValue(''); // 清空输入框
    }

    // 发送消息后立即滚动到底部，使用多次重试确保完全滚动
    requestAnimationFrame(() => {
      scrollToBottom(true, 5); // 增加重试次数到5次，确保图片消息也能正确滚动
    });

    // 发送消息后自动清除未读计数，表示用户正在积极参与会话
    if (onClearUnread) {
      onClearUnread();
    }

    if (onSendMessage && !messageContent) {
      onSendMessage(content);
    }
  }, [inputValue, wsClient, isConnected, conversation, currentUser, onClearUnread, onSendMessage, setInputValue, scrollToBottom]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    handleSendMessage
  }));

  // 监听全局回车事件 - 优化依赖
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // 检查是否是回车键，且不是shift+回车，且输入框有内容
      if (e.key === 'Enter' && !e.shiftKey) {
        const trimmedValue = inputValueRef.current.trim();
        if (trimmedValue) {
          e.preventDefault();
          handleSendMessage();
        }
      }
    };

    // 添加到document级别监听
    document.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [handleSendMessage]); // 只依赖 handleSendMessage，不再依赖 inputValue

  // 格式化时间 - 修复时区问题
  const formatTime = (timestamp) => {
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
  };

  // 格式化hover时间 - 企业微信风格：月/日 时:分
  const formatHoverTime = (timestamp) => {
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
  };

  // 格式化时间分隔线显示
  const formatTimeDivider = (timestamp) => {
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
  };

  // 渲染消息内容
  const renderMessageContent = (msg) => {
    const { content, msg_type, isSelf } = msg;

    // 图片消息
    if (msg_type === 2) {
      const imageUrl = `${getBaseUrl()}${content}`;
      return (
        <Image
          src={imageUrl}
          alt="图片"
          style={{
            maxWidth: '300px',
            maxHeight: '300px',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
          preview={{
            mask: <div style={{ fontSize: '14px' }}>点击查看大图</div>,
          }}
        />
      );
    }

    // 语音消息
    if (msg_type === 3) {
      // 解析语音内容（格式：url|duration）
      let voiceUrl = content;
      let duration = 0;

      if (content.includes('|')) {
        const [url, dur] = content.split('|');
        voiceUrl = url;
        duration = parseFloat(dur) || 0;
      }

      return (
        <VoiceMessage
          src={voiceUrl}
          duration={duration}
          isSelf={isSelf}
        />
      );
    }

    // 文本消息（默认）
    const lines = content.split('\n');
    return lines.map((line, index) => (
      <div key={index}>
        {line || <br />}
      </div>
    ));
  };

  // 检查是否需要时间分隔线（5分钟以上间隔）
  const needsTimeDivider = (currentMsg, previousMsg) => {
    if (!previousMsg) return false;

    const current = new Date(typeof currentMsg.created_at === 'string' ? currentMsg.created_at :
      (currentMsg.created_at > 1000000000000 ? currentMsg.created_at : currentMsg.created_at * 1000));
    const previous = new Date(typeof previousMsg.created_at === 'string' ? previousMsg.created_at :
      (previousMsg.created_at > 1000000000000 ? previousMsg.created_at : previousMsg.created_at * 1000));

    const diffMinutes = (current - previous) / (1000 * 60);
    return diffMinutes > 5; // 超过5分钟显示时间分隔线
  };

  // 检查是否需要紧凑显示（连续消息来自同一人）
  const needsCompactSpacing = (currentMsg, previousMsg, conversationType) => {
    if (!previousMsg) return false;

    // 如果有时间分隔线，不紧凑
    if (needsTimeDivider(currentMsg, previousMsg)) return false;

    // 单聊：只要不是第一条消息且没有时间分隔线，就紧凑
    if (conversationType === 1) {
      return true;
    }

    // 群聊：只有自己连续发的消息才紧凑，对方消息不紧凑（保持昵称显示）
    const currentIsSelf = currentMsg.isSelf;
    const previousIsSelf = previousMsg.isSelf;

    // 如果都是自己的消息，紧凑
    if (currentIsSelf && previousIsSelf) {
      return true;
    }

    // 对方的消息不紧凑，每条都显示昵称
    return false;
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#f0f0f0', // 企业微信背景色
    }}>
      {/* 自定义滚动条样式 */}
      <style>{`
        .chat-messages-container {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
        }

        .chat-messages-container:hover {
          scrollbar-color: rgba(0, 0, 0, 0.3) transparent;
        }

        .chat-messages-container::-webkit-scrollbar {
          width: 8px;
        }

        .chat-messages-container::-webkit-scrollbar-track {
          background: transparent;
        }

        .chat-messages-container::-webkit-scrollbar-thumb {
          background-color: transparent;
          border-radius: 4px;
          transition: background-color 0.3s;
        }

        .chat-messages-container:hover::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.3);
        }

        .chat-messages-container:hover::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0, 0, 0, 0.5);
        }
      `}</style>

      {/* 消息列表区域 - 修复布局，移除底部预留空间 */}
      <div
        ref={messagesContainerRef}
        className="chat-messages-container"
        style={{
          flex: 1,
          padding: '16px', // 移除底部预留空间
          overflow: 'auto',
          background: '#fff',
        }}
      >
        {loadingHistory ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
          }}>
            <Spin size="large" />
          </div>
        ) : (
          <div>
            {/* 加载更多历史消息提示 - 只在接近顶部且有更多历史时显示 */}
            {showLoadTip && hasMoreHistory && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '12px 16px',
                color: '#999',
                fontSize: '12px',
              }}>
                {loadingMore ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Spin size="small" />
                    <span>加载历史消息中...</span>
                  </div>
                ) : (
                  <span>下拉查看更多历史消息</span>
                )}
              </div>
            )}

            {messages.map((msg, index) => {
              const previousMsg = index > 0 ? messages[index - 1] : null;
              const showTimeDivider = needsTimeDivider(msg, previousMsg);
              const isCompact = needsCompactSpacing(msg, previousMsg, conversation.type);

              return (
                <div key={`${msg.id}_${index}`}>
                  {/* 时间分隔线 */}
                  {showTimeDivider && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      margin: '16px 0',
                    }}>
                      <div style={{
                        color: '#999',
                        fontSize: '12px',
                      }}>
                        {formatTimeDivider(msg.created_at)}
                      </div>
                    </div>
                  )}

                  {/* 消息气泡 */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.isSelf ? 'flex-end' : 'flex-start',
                      marginBottom: isCompact ? '2px' : '4px', // 紧凑模式2px，正常模式也改为4px，更紧凑
                    }}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                  >
                    {/* 群聊消息显示发送者昵称和hover时间（仅对方消息） */}
                    {conversation.type === 2 && !msg.isSelf && msg.from_user && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '2px',
                        marginBottom: '2px',
                        marginLeft: '2px',
                        height: '16px',
                        lineHeight: '16px',
                      }}>
                        <span style={{
                          fontSize: '12px',
                          color: '#888',
                        }}>
                          {msg.from_user.nickname || '未知用户'}
                        </span>
                        {hoveredMessageId === msg.id && (
                          <span style={{
                            fontSize: '11px',
                            color: '#999',
                          }}>
                            {formatHoverTime(msg.created_at)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 单聊对方消息hover时间显示 - 固定高度避免跳动 */}
                    {conversation.type === 1 && !msg.isSelf && (
                      <div style={{
                        fontSize: '11px',
                        color: hoveredMessageId === msg.id ? '#999' : 'transparent',
                        marginTop: '2px',
                        marginBottom: '2px',
                        marginLeft: '2px',
                        height: '16px',
                        lineHeight: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                      }}>
                        {formatHoverTime(msg.created_at)}
                      </div>
                    )}

                    {/* 自己的消息hover时间显示 - 固定高度避免跳动 */}
                    {msg.isSelf && (
                      <div style={{
                        fontSize: '11px',
                        color: hoveredMessageId === msg.id ? '#999' : 'transparent',
                        marginTop: '2px',
                        marginBottom: '2px',
                        marginRight: '2px',
                        height: '16px',
                        lineHeight: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                      }}>
                        {formatHoverTime(msg.created_at)}
                      </div>
                    )}

                    <div
                      style={{
                        maxWidth: '70%',
                        // 语音消息使用自己的样式，不需要气泡背景
                        background: msg.msg_type === 3 ? 'transparent' : (msg.isSelf ? '#95ec69' : '#fff'),
                        color: '#333',
                        padding: msg.msg_type === 3 ? '0' : '8px 12px',
                        borderRadius: '6px',
                        position: 'relative',
                        boxShadow: msg.msg_type === 3 ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                        border: msg.msg_type === 3 ? 'none' : (msg.isSelf ? 'none' : '1px solid #e5e7eb'),
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.sending && (
                        <div style={{
                          fontSize: '12px',
                          color: '#999',
                          marginBottom: '4px',
                        }}>
                          发送中...
                        </div>
                      )}

                      <div style={{ lineHeight: '1.5', fontSize: '15px' }}>
                        {renderMessageContent(msg)}
                      </div>

                      {/* 优化的气泡尾巴 - 双方都有三角尖，语音消息不显示 */}
                      {msg.msg_type !== 3 && (msg.isSelf ? (
                        // 自己的消息：右侧绿色三角尖 - 调整位置到气泡中央
                        <div style={{
                          position: 'absolute',
                          bottom: '50%',
                          transform: 'translateY(50%)', // 垂直居中
                          right: '-5px',
                          width: 0,
                          height: 0,
                          borderLeft: '6px solid #95ec69',
                          borderTop: '4px solid transparent',
                          borderBottom: '4px solid transparent',
                        }} />
                      ) : (
                        // 好友的消息：左侧带边框的白色三角尖
                        <>
                          {/* 外层边框三角 */}
                          <div style={{
                            position: 'absolute',
                            bottom: '50%',
                            transform: 'translateY(50%)', // 垂直居中
                            left: '-7px',
                            width: 0,
                            height: 0,
                            borderRight: '7px solid #e5e7eb',
                            borderTop: '4px solid transparent',
                            borderBottom: '4px solid transparent',
                          }} />
                          {/* 内层白色三角 */}
                          <div style={{
                            position: 'absolute',
                            bottom: '50%',
                            transform: 'translateY(50%)', // 垂直居中
                            left: '-6px',
                            width: 0,
                            height: 0,
                            borderRight: '6px solid #fff',
                            borderTop: '4px solid transparent',
                            borderBottom: '4px solid transparent',
                          }} />
                        </>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
});

// 添加displayName以便调试
ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;
