class WebSocketClient {
  constructor(url, token) {
    this.url = url;
    this.token = token;
    this.ws = null;
    this.reconnectCount = 0;
    this.maxReconnectCount = Infinity; // 无限重连
    this.reconnectDelay = 1000; // 初始1秒
    this.maxReconnectDelay = 60000; // 最大60秒
    this.heartbeatInterval = 30000; // 30秒
    this.heartbeatTimeout = 60000; // 60秒超时
    this.heartbeatTimer = null;
    this.heartbeatTimeoutTimer = null;
    this.lastPongTime = 0;
    this.messageHandlers = {};
    this.connected = false;
    this.userId = 0;
    this.shouldReconnect = true; // 是否应该重连
    this.manualClose = false; // 是否为手动关闭
    this.reconnecting = false; // 是否正在重连中
    this.messageQueue = []; // 消息队列（用于断线重连后发送）
    this.isPageVisible = true; // 页面是否可见

    // 监听页面可见性变化
    this.setupVisibilityListener();
    // 监听网络状态变化
    this.setupNetworkListener();
  }

  // 监听页面可见性
  setupVisibilityListener() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.isPageVisible = !document.hidden;

        if (this.isPageVisible && !this.connected && this.shouldReconnect) {
          console.log('[WebSocket] 页面恢复可见，检查连接状态');
          this.checkAndReconnect();
        }
      });
    }
  }

  // 监听网络状态
  setupNetworkListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[WebSocket] 网络已恢复，尝试重连');
        this.reconnectCount = 0; // 重置重连次数
        this.checkAndReconnect();
      });

      window.addEventListener('offline', () => {
        console.log('[WebSocket] 网络已断开');
        this.emit('network-offline');
      });
    }
  }

  // 检查并重连
  checkAndReconnect() {
    if (!this.connected && this.shouldReconnect && !this.reconnecting) {
      this.handleReconnect();
    }
  }

  // 连接WebSocket
  connect() {
    // 如果已经连接，直接返回
    if (this.connected) {
      return Promise.resolve();
    }

    // 如果正在重连中，避免重复连接
    if (this.reconnecting) {
      return Promise.reject(new Error('正在重连中'));
    }

    this.reconnecting = true;

    return new Promise((resolve, reject) => {
      try {
        const fullUrl = `${this.url}?token=${this.token}`;
        this.ws = new WebSocket(fullUrl);

        this.ws.onopen = (event) => {
          console.log('[WebSocket] 连接成功');
          this.connected = true;
          this.reconnecting = false;
          this.reconnectCount = 0; // 重置重连次数
          this.shouldReconnect = true; // 重置重连标志
          this.manualClose = false; // 重置手动关闭标志
          this.lastPongTime = Date.now(); // 初始化心跳时间
          this.startHeartbeat();

          // 触发连接成功事件
          this.emit('connected');

          // 发送队列中的消息
          this.flushMessageQueue();

          resolve(event);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[WebSocket] 消息解析失败:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('[WebSocket] 连接关闭:', event.code, event.reason);
          this.connected = false;
          this.reconnecting = false;
          this.stopHeartbeat();

          // 触发断开连接事件
          this.emit('disconnected', { code: event.code, reason: event.reason });

          // 只有非手动关闭且应该重连时才尝试重连
          if (!this.manualClose && this.shouldReconnect && event.code !== 1000) {
            this.handleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] 连接错误:', error);
          this.reconnecting = false;
          reject(error);
        };

      } catch (error) {
        console.error('[WebSocket] 创建连接失败:', error);
        this.reconnecting = false;
        reject(error);
      }
    });
  }

  // 断开连接
  disconnect() {
    this.manualClose = true; // 标记为手动关闭
    this.shouldReconnect = false; // 停止自动重连
    this.connected = false;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
    }
  }

  // 发送消息
  send(type, data) {
    const message = {
      type: type,
      action: 'send',
      msg_id: this.generateMessageId(),
      data: data,
    };

    // 如果未连接，将消息加入队列（仅聊天消息）
    if (!this.connected) {
      if (type === 'chat') {
        console.warn('[WebSocket] 未连接，消息已加入队列');
        this.messageQueue.push(message);
        // 触发消息入队事件
        this.emit('message-queued', message);
        return message.msg_id;
      } else {
        console.warn('[WebSocket] 未连接，无法发送非聊天消息');
        return false;
      }
    }

    try {
      this.ws.send(JSON.stringify(message));

      // 心跳消息不打印日志，减少console噪音
      if (type !== 'ping' && type !== 'pong') {
        console.log('[WebSocket] 发送消息:', message);
      }

      return message.msg_id;
    } catch (error) {
      console.error('[WebSocket] 发送消息失败:', error);

      // 发送失败，如果是聊天消息则加入队列
      if (type === 'chat') {
        this.messageQueue.push(message);
        this.emit('message-queued', message);
        return message.msg_id;
      }

      return false;
    }
  }

  // 发送队列中的消息
  flushMessageQueue() {
    if (this.messageQueue.length === 0) {
      return;
    }

    console.log(`[WebSocket] 发送队列中的 ${this.messageQueue.length} 条消息`);

    const queue = [...this.messageQueue];
    this.messageQueue = [];

    queue.forEach(message => {
      try {
        this.ws.send(JSON.stringify(message));
        console.log('[WebSocket] 队列消息已发送:', message);
        this.emit('message-sent-from-queue', message);
      } catch (error) {
        console.error('[WebSocket] 队列消息发送失败:', error);
        // 发送失败，重新加入队列
        this.messageQueue.push(message);
      }
    });
  }

  // 清空消息队列
  clearMessageQueue() {
    const count = this.messageQueue.length;
    this.messageQueue = [];
    console.log(`[WebSocket] 清空消息队列: ${count} 条消息`);
    return count;
  }

  // 发送心跳
  sendHeartbeat() {
    if (!this.connected) return;

    // 静默发送心跳，不打印日志
    const message = {
      type: 'ping',
      action: 'send',
      msg_id: this.generateMessageId(),
      data: {},
    };

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[WebSocket] 发送心跳失败:', error);
    }
  }

  // 发送pong响应
  sendPong() {
    if (!this.connected) return;

    const message = {
      type: 'pong',
      action: 'send',
      msg_id: this.generateMessageId(),
      data: {},
    };

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[WebSocket] 发送pong失败:', error);
    }
  }

  // 发送聊天消息
  sendChatMessage(targetId, content, msgType = 1, conversationType = 1) {
    const data = {
      content: content,
    };

    // 根据会话类型设置不同的字��
    if (conversationType === 2) {
      // 群聊
      data.group_id = targetId;
    } else {
      // 单聊
      data.to_user_id = targetId;
    }

    // 如果指定了消息类型（不是默认的文本类型），则包含在数据中
    if (msgType !== 1) {
      data.msg_type = msgType;
    }

    return this.send('chat', data);
  }

  // 处理接收到的消息
  handleMessage(message) {
    // 心跳消息不打印日志，减少console噪音
    if (message.type !== 'ping' && message.type !== 'pong') {
      console.log('[WebSocket] 收到消息:', message);
    }

    switch (message.type) {
      case 'system':
        this.handleSystemMessage(message);
        break;
      case 'chat':
        this.handleChatMessage(message);
        break;
      case 'status':
        this.handleStatusMessage(message);
        break;
      case 'ping':
        this.handlePing(message);
        break;
      case 'pong':
        this.handlePong(message);
        break;
      case 'error':
        this.handleError(message);
        break;
      default:
        console.warn('[WebSocket] 未知消息类型:', message.type);
    }
  }

  // 处理系统消息
  handleSystemMessage(message) {
    if (message.action === 'connected' && message.data) {
      this.userId = message.data.user_id;
      console.log('[WebSocket] 用户连接确认:', this.userId);
    }

    this.emit('system', message);
  }

  // 处理聊天消息
  handleChatMessage(message) {
    if (message.action === 'receive') {
      this.emit('message', message.data);
    } else if (message.action === 'ack') {
      this.emit('message-ack', message.data);
    }
  }

  // 处理在线状态消息
  handleStatusMessage(message) {
    if (message.action === 'online_status') {
      this.emit('online-status', message.data);
    }
  }

  // 处理服务器发送的ping
  handlePing(message) {
    // 自动回复pong
    this.sendPong();
  }

  // 处理pong响应
  handlePong(message) {
    // 收到心跳响应，连接正常
    this.lastPongTime = Date.now();
  }

  // 处理错误消息
  handleError(message) {
    console.error('[WebSocket] 收到错误:', message);
    this.emit('error', message.data);
  }

  // 事件处理器
  on(event, callback) {
    if (!this.messageHandlers[event]) {
      this.messageHandlers[event] = [];
    }
    this.messageHandlers[event].push(callback);
  }

  off(event, callback) {
    if (this.messageHandlers[event]) {
      this.messageHandlers[event] = this.messageHandlers[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.messageHandlers[event]) {
      this.messageHandlers[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[WebSocket] 事件处理失败:', error);
        }
      });
    }
  }

  // 开启心跳
  startHeartbeat() {
    // 清理已存在的定时器
    this.stopHeartbeat();

    // 定期发送心跳
    this.heartbeatTimer = setInterval(() => {
      // 如果不应该重连，停止心跳
      if (!this.shouldReconnect) {
        this.stopHeartbeat();
        return;
      }

      if (this.connected) {
        // 检查是否超时（如果有发送过心跳的话）
        if (this.lastPongTime > 0) {
          const timeSinceLastPong = Date.now() - this.lastPongTime;
          if (timeSinceLastPong > this.heartbeatTimeout) {
            console.warn('[WebSocket] 心跳超时，连接可能已断开');
            // 先关闭当前连接，触发 onclose 事件
            this.connected = false;
            if (this.ws) {
              this.ws.close(4000, 'Heartbeat timeout'); // 使用自定义关闭码
            }
            return;
          }
        }

        this.sendHeartbeat();
      }
    }, this.heartbeatInterval);
  }

  // 停止心跳
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  // 处理重连
  handleReconnect() {
    // 如果不应该重连，直接返回
    if (!this.shouldReconnect) {
      return;
    }

    // 如果正在重连中，避免重复重连
    if (this.reconnecting) {
      return;
    }

    this.reconnectCount++;

    // 使用指数退避算法计算延迟：min(初始延迟 * 2^(重连次数-1), 最大延迟)
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectCount - 1),
      this.maxReconnectDelay
    );

    console.log(`[WebSocket] ${delay}ms后进行第${this.reconnectCount}次重连`);

    // 触发重连事件，传递重连次数和延迟
    this.emit('reconnecting', {
      count: this.reconnectCount,
      delay: delay
    });

    setTimeout(() => {
      // 再次检查是否应该重连
      if (!this.shouldReconnect) {
        return;
      }

      this.connect().catch(error => {
        console.error('[WebSocket] 重连失败:', error);
        // 重连失败后会自动触发 onclose，从而继续重连
      });
    }, delay);
  }

  // 生成唯一消息ID
  generateMessageId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取连接状态
  isConnected() {
    return this.connected;
  }

  // 获取用户ID
  getUserId() {
    return this.userId;
  }

  // 获取消息队列长度
  getQueueLength() {
    return this.messageQueue.length;
  }

  // 获取重连次数
  getReconnectCount() {
    return this.reconnectCount;
  }
}

export default WebSocketClient;
