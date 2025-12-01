import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input, Button, List, Avatar, Card, Space, message, Modal, Typography, Tag, Tabs, Badge } from 'antd';
import { UserAddOutlined, DeleteOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { friendAPI, userAPI, friendRequestAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import AddFriendModal from '../components/AddFriendModal';
import FriendRequestList from '../components/FriendRequestList';

const { Title, Text } = Typography;
const { Search } = Input;

const FriendsPage = () => {
  const { user } = useAuth();
  const { registerMessageHandler } = useWebSocket();
  const [friends, setFriends] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('friends');
  const [pendingCount, setPendingCount] = useState(0);

  // 添加好友弹窗状态
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // 用于刷新申请列表的ref
  const receivedListRef = useRef(null);
  const sentListRef = useRef(null);

  // 加载待处理申请数量
  const loadPendingCount = useCallback(async () => {
    try {
      const response = await friendRequestAPI.getPendingCount();
      if (response?.data) {
        setPendingCount(response.data.count || 0);
      }
    } catch (error) {
      console.error('加载待处理数量失败:', error);
    }
  }, []);

  // 加载好友列表
  const loadFriends = useCallback(async () => {
    try {
      const response = await friendAPI.getFriends();
      setFriends(response.data || []);
    } catch (error) {
      message.error('加载好友列表失败');
    }
  }, []);

  // 搜索用户
  const handleSearch = async (value) => {
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await userAPI.searchUsers(value);
      setSearchResults(response.data || []);
    } catch (error) {
      message.error('搜索失败');
    } finally {
      setSearching(false);
    }
  };

  // 打开添加好友弹窗
  const handleOpenAddModal = (targetUser) => {
    setSelectedUser(targetUser);
    setAddModalVisible(true);
  };

  // 添加好友成功回调
  const handleAddSuccess = () => {
    setAddModalVisible(false);
    // 更新搜索结果中该用户的状态为"已发送"
    if (selectedUser) {
      setSearchResults(prev => prev.map(u =>
        u.id === selectedUser.id
          ? { ...u, request_status: 'sent' }
          : u
      ));
    }
    setSelectedUser(null);
    // 刷新发出的申请列表
    if (sentListRef.current?.refresh) {
      sentListRef.current.refresh();
    }
  };

  // 从搜索结果中同意好友申请
  const handleAcceptRequestFromSearch = async (targetUser) => {
    if (!targetUser.request_id) {
      message.error('申请信息不完整');
      return;
    }

    try {
      await friendRequestAPI.acceptRequest(targetUser.request_id);
      message.success(`已同意 ${targetUser.nickname} 的好友申请`);

      // 更新搜索结果中该用户的状态为"已是好友"
      setSearchResults(prev => prev.map(u =>
        u.id === targetUser.id
          ? { ...u, is_friend: true, request_status: 'none' }
          : u
      ));

      // 重新加载好友列表和待处理数量
      loadFriends();
      loadPendingCount();
    } catch (error) {
      const errorMsg = error?.message || error?.error || '同意申请失败';
      message.error(errorMsg);
    }
  };

  // 删除好友
  const handleRemoveFriend = async (friendId, friendName) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除好友 ${friendName} 吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await friendAPI.removeFriend(friendId);
          message.success(`已删除好友 ${friendName}`);
          loadFriends();
        } catch (error) {
          message.error('删除好友失败');
        }
      },
    });
  };

  // 同意申请后的回调
  const handleAcceptRequest = () => {
    loadFriends();
    loadPendingCount();
  };

  // 处理WebSocket好友申请消息
  useEffect(() => {
    const handleWebSocketMessage = (eventType, data) => {
      // 只处理friend-request类型的消息
      if (eventType !== 'friend-request' || !data) return;

      switch (data.type) {
        case 'new_request':
          // 收到新申请，更新待处理数量并显示通知
          loadPendingCount();
          message.info(`收到来自 ${data.data?.from_user?.nickname || '某人'} 的好友申请`);
          // 如果当前在收到的申请tab，刷新列表
          if (activeTab === 'received' && receivedListRef.current?.refresh) {
            receivedListRef.current.refresh();
          }
          break;
        case 'request_accepted':
          // 申请被接受，刷新好友列表
          message.success(`${data.data?.friend?.nickname || '对方'} 已接受你的好友申请`);
          loadFriends();
          // 刷新发出的申请列表
          if (sentListRef.current?.refresh) {
            sentListRef.current.refresh();
          }
          break;
        case 'request_rejected':
          // 申请被拒绝
          message.info('你的好友申请被拒绝');
          // 刷新发出的申请列表
          if (sentListRef.current?.refresh) {
            sentListRef.current.refresh();
          }
          break;
        case 'pending_count':
          // 更新待处理数量
          setPendingCount(data.data?.count || 0);
          break;
        default:
          break;
      }
    };

    const unregister = registerMessageHandler(handleWebSocketMessage);
    return () => unregister && unregister();
  }, [registerMessageHandler, activeTab, loadFriends, loadPendingCount]);

  useEffect(() => {
    loadFriends();
    loadPendingCount();
  }, [loadFriends, loadPendingCount]);

  // Tab项配置
  const tabItems = [
    {
      key: 'friends',
      label: `好友列表 (${friends.length})`,
      children: (
        <Card size="small" bordered={false}>
          {friends.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Text type="secondary">你还没有好友，快去搜索并添加吧！</Text>
            </div>
          ) : (
            <List
              dataSource={friends}
              renderItem={(friend) => (
                <List.Item
                  actions={[
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      onClick={() => handleRemoveFriend(friend.id, friend.nickname)}
                    >
                      删除
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        icon={<UserOutlined />}
                        src={friend.avatar ? `/uploads/${friend.avatar}` : undefined}
                      >
                        {friend.nickname?.[0]}
                      </Avatar>
                    }
                    title={<Text strong>{friend.nickname}</Text>}
                    description={friend.phone}
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      ),
    },
    {
      key: 'received',
      label: (
        <Badge count={pendingCount} size="small" offset={[10, 0]}>
          收到的申请
        </Badge>
      ),
      children: (
        <Card size="small" bordered={false}>
          <FriendRequestList
            type="received"
            ref={receivedListRef}
            onAccept={handleAcceptRequest}
          />
        </Card>
      ),
    },
    {
      key: 'sent',
      label: '发出的申请',
      children: (
        <Card size="small" bordered={false}>
          <FriendRequestList
            type="sent"
            ref={sentListRef}
          />
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 页面标题 */}
        <div>
          <Title level={2}>好友管理</Title>
          <Text type="secondary">管理你的好友关系，搜索并添加新朋友</Text>
        </div>

        {/* 搜索区域 */}
        <Card title="搜索用户" size="small">
          <Search
            placeholder="输入用户名或手机号搜索"
            enterButton={<SearchOutlined />}
            onSearch={handleSearch}
            loading={searching}
            allowClear
          />
        </Card>

        {/* 搜索结果 */}
        {searchResults.length > 0 && (
          <Card title={`搜索结果 (${searchResults.length})`} size="small">
            <List
              dataSource={searchResults}
              renderItem={(item) => {
                const requestStatus = item.request_status || 'none';

                // 根据状态渲染不同的按钮
                const renderActionButton = () => {
                  if (item.is_friend) {
                    return <Tag color="blue">已是好友</Tag>;
                  }
                  if (requestStatus === 'sent') {
                    return <Tag color="orange">已发送申请</Tag>;
                  }
                  if (requestStatus === 'received') {
                    return (
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => handleAcceptRequestFromSearch(item)}
                        style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                      >
                        同意申请
                      </Button>
                    );
                  }
                  // 默认：可以添加好友
                  return (
                    <Button
                      type="primary"
                      size="small"
                      icon={<UserAddOutlined />}
                      onClick={() => handleOpenAddModal(item)}
                    >
                      添加好友
                    </Button>
                  );
                };

                return (
                  <List.Item actions={[renderActionButton()]}>
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          icon={<UserOutlined />}
                          src={item.avatar ? `/uploads/${item.avatar}` : undefined}
                        >
                          {item.nickname?.[0]}
                        </Avatar>
                      }
                      title={
                        <Space>
                          <Text strong>{item.nickname}</Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {item.phone}
                          </Text>
                        </Space>
                      }
                      description={item.phone}
                    />
                  </List.Item>
                );
              }}
            />
          </Card>
        )}

        {/* 好友和申请列表 Tabs */}
        <Card size="small">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
          />
        </Card>
      </Space>

      {/* 添加好友弹窗 */}
      <AddFriendModal
        visible={addModalVisible}
        targetUser={selectedUser}
        onSuccess={handleAddSuccess}
        onCancel={() => {
          setAddModalVisible(false);
          setSelectedUser(null);
        }}
      />
    </div>
  );
};

export default FriendsPage;
