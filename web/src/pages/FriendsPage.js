import React, { useState, useEffect } from 'react';
import { Input, Button, List, Avatar, Card, Space, message, Modal, Typography, Tag } from 'antd';
import { UserAddOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { friendAPI, userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;
const { Search } = Input;

const FriendsPage = () => {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  // 加载好友列表
  const loadFriends = async () => {
    try {
      const response = await friendAPI.getFriends();
      setFriends(response.data);
    } catch (error) {
      message.error('加载好友列表失败');
    }
  };

  // 搜索用户
  const handleSearch = async (value) => {
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await userAPI.searchUsers(value);
      setSearchResults(response.data);
    } catch (error) {
      message.error('搜索失败');
    } finally {
      setSearching(false);
    }
  };

  // 添加好友
  const handleAddFriend = async (friendId, friendName) => {
    setLoading(true);
    try {
      await friendAPI.addFriend(friendId);
      message.success(`已发送好友请求给 ${friendName}`);
      // 刷新搜索结果或者移除已添加的用户
      setSearchResults(searchResults.filter(user => user.id !== friendId));
      // 重新加载好友列表
      loadFriends();
    } catch (error) {
      message.error(error.response?.data?.message || '添加好友失败');
    } finally {
      setLoading(false);
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
          // 重新加载好友列表
          loadFriends();
        } catch (error) {
          message.error('删除好友失败');
        }
      },
    });
  };

  useEffect(() => {
    loadFriends();
  }, []);

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
              renderItem={(item) => (
                <List.Item
                  actions={[
                    item.is_friend ? (
                      <Tag color="blue">已是好友</Tag>
                    ) : (
                      <Button
                        type="primary"
                        size="small"
                        disabled={loading}
                        onClick={() => handleAddFriend(item.id, item.nickname)}
                        style={{
                          minWidth: '80px',
                          width: '80px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative'
                        }}
                      >
                        {loading ? (
                          <span style={{
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%'
                          }}>
                            <UserAddOutlined style={{ marginRight: '4px' }} />
                            处理中
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%'
                          }}>
                            <UserAddOutlined style={{ marginRight: '4px' }} />
                            添加好友
                          </span>
                        )}
                      </Button>
                    )
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar src={item.avatar}>{item.nickname[0]}</Avatar>}
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
              )}
            />
          </Card>
        )}

        {/* 好友列表 */}
        <Card title={`我的好友 (${friends.length})`} size="small">
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
                      删除好友
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar src={friend.avatar}>{friend.nickname[0]}</Avatar>}
                    title={<Text strong>{friend.nickname}</Text>}
                    description={friend.phone}
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </Space>
    </div>
  );
};

export default FriendsPage;
