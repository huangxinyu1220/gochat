import React, { useState, useEffect } from 'react';
import { List, Avatar, Card, Typography, Badge, Space, Button, message } from 'antd';
import { WechatOutlined, TeamOutlined, ClearOutlined } from '@ant-design/icons';
import { conversationAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

const ConversationsPage = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  // 获取头像URL - 统一使用uploads/files目录
  const getAvatarSrc = (avatar) => {
    if (!avatar || avatar === 'default.png') {
      return null;
    }

    const baseURL = process.env.REACT_APP_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:8080';
    return `${baseURL}/uploads/files/${avatar}`;
  };

  // 加载会话列表
  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await conversationAPI.getConversations();
      setConversations(response.data);
    } catch (error) {
      message.error('加载会话列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 清空未读计数
  const handleClearUnread = async (conversationId, targetName) => {
    try {
      await conversationAPI.clearUnreadCount(conversationId);
      message.success(`已清空与 ${targetName} 的未读消息`);

      // 更新本地状态
      setConversations(conversations.map(conv =>
        conv.id === conversationId ? { ...conv, unread_count: 0 } : conv
      ));
    } catch (error) {
      message.error('清空未读消息失败');
    }
  };

  // 获取会话类型图标
  const getConversationIcon = (type) => {
    return type === 1 ? <WechatOutlined /> : <TeamOutlined />;
  };

  // 获取会话类型名称
  const getConversationTypeText = (type) => {
    return type === 1 ? '好友聊天' : '群聊';
  };

  // 格式化时间显示
  const formatTime = (timeStr) => {
    if (!timeStr || timeStr === '') return '';

    const time = new Date(timeStr);
    const now = new Date();
    const diff = now - time;

    // 1分钟内
    if (diff < 60000) {
      return '刚刚';
    }

    // 1小时内
    if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}分钟前`;
    }

    // 今天
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(time.getFullYear(), time.getMonth(), time.getDate());

    if (messageDate.getTime() === today.getTime()) {
      return `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;
    }

    // 昨天
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.getTime() === yesterday.getTime()) {
      return `昨天 ${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;
    }

    // 更早
    return `${time.getMonth() + 1}-${time.getDate()} ${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;
  };

  useEffect(() => {
    loadConversations();
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 页面标题 */}
        <div>
          <Title level={2}>消息会话</Title>
          <Text type="secondary">查看所有聊天记录和未读消息</Text>
        </div>

        {/* 会话列表 */}
        <Card size="small">
          <List
            loading={loading}
            dataSource={conversations}
            renderItem={(conversation) => (
              <List.Item
                actions={[
                  conversation.unread_count > 0 && (
                    <Button
                      type="text"
                      icon={<ClearOutlined />}
                      size="small"
                      onClick={() => handleClearUnread(conversation.id, conversation.target_name)}
                      style={{ color: '#1890ff' }}
                    >
                      清空未读({conversation.unread_count})
                    </Button>
                  )
                ].filter(Boolean)}
                style={{ padding: '16px' }}
              >
                <List.Item.Meta
                  avatar={
                    <Badge count={conversation.unread_count} overflowCount={99}>
                      <Avatar
                        src={getAvatarSrc(conversation.target_avatar)}
                        icon={getConversationIcon(conversation.type)}
                      >
                        {conversation.target_name && conversation.target_name[0]}
                      </Avatar>
                    </Badge>
                  }
                  title={
                    <Space>
                      <Text strong>{conversation.target_name}</Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {getConversationTypeText(conversation.type)}
                      </Text>
                    </Space>
                  }
                  description={
                    <div>
                      <Text
                        style={{
                          color: conversation.unread_count > 0 ? '#1890ff' : '#666',
                          fontWeight: conversation.unread_count > 0 ? '500' : 'normal'
                        }}
                      >
                        {conversation.last_msg_content}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {formatTime(conversation.last_msg_time)}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
            locale={{
              emptyText: (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Text type="secondary">暂无会话，快去添加好友开始聊天吧！</Text>
                </div>
              )
            }}
          />

          {!loading && conversations.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: '16px', color: '#666', fontSize: '14px' }}>
              共 {conversations.length} 个会话
            </div>
          )}
        </Card>
      </Space>
    </div>
  );
};

export default ConversationsPage;
