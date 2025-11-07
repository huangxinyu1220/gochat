import React, { useState, useEffect } from 'react';
import { Modal, Steps, Checkbox, Input, Button, Avatar, List, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { friendAPI, groupAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CreateGroupModal = ({ visible, onCancel, onSuccess }) => {
  const { user } = useAuth(); // 获取当前登录用户
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);

  // 加载好友列表
  useEffect(() => {
    if (visible) {
      loadFriends();
    } else {
      // 重置状态
      setCurrentStep(0);
      setSelectedFriends([]);
      setGroupName('');
    }
  }, [visible]);

  const loadFriends = async () => {
    try {
      const response = await friendAPI.getFriends();
      console.log('获取好友列表响应:', response);
      if (response.code === 0) {
        console.log('好友列表数据:', response.data);
        setFriends(response.data || []);
      } else {
        console.error('获取好友列表失败，code:', response.code, 'message:', response.message);
        message.error(response.message || '加载好友列表失败');
      }
    } catch (error) {
      console.error('加载好友列表失败:', error);
      message.error('加载好友列表失败');
    }
  };

  const handleFriendToggle = (friendId) => {
    setSelectedFriends(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      } else {
        return [...prev, friendId];
      }
    });
  };

  const handleNext = () => {
    if (currentStep === 0) {
      if (selectedFriends.length === 0) {
        message.warning('请至少选择一个好友');
        return;
      }
      setCurrentStep(1);
    }
  };

  const handleBack = () => {
    setCurrentStep(0);
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      message.warning('请输入群名称');
      return;
    }

    setLoading(true);
    try {
      const response = await groupAPI.createGroup({
        name: groupName.trim(),
        member_ids: selectedFriends
      });

      if (response.code === 0) {
        message.success('创建群聊成功');
        onSuccess(response.data); // 返回创建的群组信息
      } else {
        message.error(response.message || '创建群聊失败');
      }
    } catch (error) {
      console.error('创建群聊失败:', error);
      message.error('创建群聊失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: '选择好友',
      content: (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <div style={{ marginBottom: 12, color: '#888' }}>
            已选择 {selectedFriends.length} 人
          </div>
          {friends.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              暂无好友，请先添加好友
            </div>
          ) : (
            <List
              dataSource={friends}
              renderItem={friend => (
                <List.Item
                  style={{ cursor: 'pointer', padding: '12px 0' }}
                  onClick={() => handleFriendToggle(friend.id)}
                >
                  <List.Item.Meta
                    avatar={
                      <Checkbox
                        checked={selectedFriends.includes(friend.id)}
                        style={{ marginRight: 8 }}
                      />
                    }
                    title={
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar
                          src={friend.avatar ? `/uploads/avatars/${friend.avatar}` : null}
                          icon={!friend.avatar && <UserOutlined />}
                          style={{ marginRight: 8 }}
                        />
                        {friend.nickname}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      ),
    },
    {
      title: '设置群名',
      content: (
        <div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>群名称</div>
            <Input
              placeholder="请输入群名称"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
              showCount
              autoFocus
            />
          </div>
          <div style={{ marginTop: 24, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
              群成员预览 ({selectedFriends.length + 1} 人)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: 12 }}>
              {/* 显示当前用户（自己） */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                background: '#fff',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                <Avatar
                  size="small"
                  src={user?.avatar ? `/uploads/avatars/${user.avatar}` : null}
                  icon={!user?.avatar && <UserOutlined />}
                  style={{ marginRight: 4 }}
                />
                <span>{user?.nickname || '我'}</span>
              </div>
              {/* 显示选中的好友 */}
              {friends
                .filter(f => selectedFriends.includes(f.id))
                .map(friend => (
                  <div key={friend.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    background: '#fff',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    <Avatar
                      size="small"
                      src={friend.avatar ? `/uploads/avatars/${friend.avatar}` : null}
                      icon={!friend.avatar && <UserOutlined />}
                      style={{ marginRight: 4 }}
                    />
                    <span>{friend.nickname}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <Modal
      title="创建群聊"
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={500}
      destroyOnClose
    >
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        {steps.map(item => (
          <Steps.Step key={item.title} title={item.title} />
        ))}
      </Steps>

      <div>{steps[currentStep].content}</div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {currentStep > 0 && (
          <Button onClick={handleBack}>上一步</Button>
        )}
        {currentStep === 0 && (
          <>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" onClick={handleNext}>
              下一步
            </Button>
          </>
        )}
        {currentStep === 1 && (
          <>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" onClick={handleCreate} loading={loading}>
              创建
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
};

export default CreateGroupModal;
