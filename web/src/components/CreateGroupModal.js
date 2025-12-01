import React, { useState, useEffect } from 'react';
import { Modal, Steps, Checkbox, Input, Button, Avatar, List, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { friendAPI, groupAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getAvatarSrc } from '../utils/avatar';

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
        <div>
          {/* 选择状态栏 */}
          <div style={{ 
            marginBottom: 16, 
            padding: '12px 16px', 
            background: selectedFriends.length > 0 ? '#e6f7ff' : '#f5f5f5',
            border: `1px solid ${selectedFriends.length > 0 ? '#91d5ff' : '#d9d9d9'}`,
            borderRadius: 6,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ 
              color: selectedFriends.length > 0 ? '#1890ff' : '#666',
              fontWeight: 500
            }}>
              {selectedFriends.length > 0 ? `已选择 ${selectedFriends.length} 位好友` : '请选择要添加的好友'}
            </div>
            {selectedFriends.length > 0 && (
              <Button 
                type="link" 
                size="small"
                onClick={() => setSelectedFriends([])}
                style={{ padding: 0, height: 'auto' }}
              >
                清空选择
              </Button>
            )}
          </div>

          {/* 好友列表 */}
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {friends.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '60px 20px', 
                color: '#999',
                background: '#fafafa',
                borderRadius: 6,
                border: '1px dashed #d9d9d9'
              }}>
                <UserOutlined style={{ fontSize: 32, marginBottom: 12, display: 'block' }} />
                <div style={{ fontSize: 14 }}>暂无好友</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>请先添加好友后再创建群聊</div>
              </div>
            ) : (
              <List
                dataSource={friends}
                renderItem={friend => {
                  const isSelected = selectedFriends.includes(friend.id);
                  return (
                    <List.Item
                      style={{ 
                        cursor: 'pointer', 
                        padding: '16px',
                        marginBottom: 8,
                        background: isSelected ? '#e6f7ff' : '#fff',
                        border: `1px solid ${isSelected ? '#91d5ff' : '#f0f0f0'}`,
                        borderRadius: 8,
                        transition: 'all 0.3s ease',
                        ':hover': {
                          background: isSelected ? '#e6f7ff' : '#fafafa',
                          borderColor: isSelected ? '#91d5ff' : '#d9d9d9'
                        }
                      }}
                      onClick={() => handleFriendToggle(friend.id)}
                    >
                      <List.Item.Meta
                        avatar={
                          <div style={{ position: 'relative' }}>
                            <Avatar
                              src={getAvatarSrc(friend.avatar)}
                              icon={<UserOutlined />}
                              size={48}
                              style={{ marginRight: 12 }}
                            />
                            <Checkbox
                              checked={isSelected}
                              style={{ 
                                position: 'absolute',
                                top: -2,
                                right: -2,
                                background: '#fff',
                                borderRadius: '50%',
                                padding: 2
                              }}
                            />
                          </div>
                        }
                        title={
                          <div style={{ 
                            fontWeight: 500,
                            color: isSelected ? '#1890ff' : '#262626',
                            marginBottom: 4
                          }}>
                            {friend.nickname}
                          </div>
                        }
                        description={
                          <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                            点击{isSelected ? '取消选择' : '选择'}该好友
                          </div>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </div>
        </div>
      ),
    },
    {
      title: '设置群名',
      content: (
        <div>
          {/* 群名输入 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ 
              marginBottom: 12, 
              fontWeight: 500, 
              fontSize: 16,
              color: '#262626'
            }}>
              群聊名称
            </div>
            <Input
              placeholder="请输入群名称（必填）"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
              showCount
              autoFocus
              style={{ 
                fontSize: 16,
                padding: '12px 16px',
                borderRadius: 8
              }}
            />
          </div>

          {/* 群成员预览 */}
          <div style={{ 
            background: '#fafafa',
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            padding: 16
          }}>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 500, 
              color: '#262626',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center'
            }}>
              <UserOutlined style={{ marginRight: 8, color: '#1890ff' }} />
              群成员预览 ({selectedFriends.length + 1} 人)
            </div>
            
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 12
            }}>
              {/* 当前用户 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                background: '#fff',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                fontSize: 14,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                <Avatar
                  size="small"
                  src={getAvatarSrc(user?.avatar)}
                  icon={<UserOutlined />}
                  style={{ marginRight: 8 }}
                />
                <span style={{ fontWeight: 500 }}>{user?.nickname || '我'}</span>
                <span style={{ 
                  marginLeft: 8, 
                  padding: '2px 6px',
                  background: '#52c41a',
                  color: '#fff',
                  fontSize: 10,
                  borderRadius: 3
                }}>群主</span>
              </div>
              
              {/* 选中的好友 */}
              {friends
                .filter(f => selectedFriends.includes(f.id))
                .map(friend => (
                  <div key={friend.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#fff',
                    border: '1px solid #d9d9d9',
                    borderRadius: 6,
                    fontSize: 14,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    <Avatar
                      size="small"
                      src={getAvatarSrc(friend.avatar)}
                      icon={<UserOutlined />}
                      style={{ marginRight: 8 }}
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
      title={
        <div style={{ 
          fontSize: 18, 
          fontWeight: 600,
          color: '#262626',
          display: 'flex',
          alignItems: 'center'
        }}>
          <UserOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          创建群聊
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
      destroyOnClose
      style={{ top: 20 }}
      bodyStyle={{ padding: '24px 24px 8px 24px' }}
    >
      {/* 优化后的步骤指示器 */}
      <div style={{ marginBottom: 32 }}>
        <Steps 
          current={currentStep} 
          size="small"
          style={{ 
            marginBottom: 0,
            padding: '0 20px'
          }}
        >
          {steps.map((item, index) => (
            <Steps.Step 
              key={item.title} 
              title={item.title}
              description={currentStep === index ? '进行中' : currentStep > index ? '已完成' : '待进行'}
              style={{
                '& .ant-steps-item-process .ant-steps-item-icon': {
                  background: '#1890ff',
                  borderColor: '#1890ff'
                }
              }}
            />
          ))}
        </Steps>
      </div>

      <div style={{ marginBottom: 24, minHeight: 280 }}>
        {steps[currentStep].content}
      </div>

      {/* 优化后的按钮区域 */}
      <div style={{ 
        marginTop: 24,
        padding: '16px 24px',
        background: '#fafafa',
        borderRadius: 8,
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
          {currentStep === 0 ? (selectedFriends.length > 0 ? '可以点击下一步继续' : '请选择至少1个好友') : '确认群聊信息'}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {currentStep > 0 && (
            <Button 
              onClick={handleBack}
              size="large"
              style={{ minWidth: 80 }}
            >
              上一步
            </Button>
          )}
          {currentStep === 0 && (
            <Button 
              onClick={onCancel}
              size="large"
              style={{ minWidth: 80 }}
            >
              取消
            </Button>
          )}
          {currentStep === 1 && (
            <Button 
              onClick={onCancel}
              size="large"
              style={{ minWidth: 80 }}
            >
              取消
            </Button>
          )}
          <Button 
            type="primary" 
            onClick={currentStep === 0 ? handleNext : handleCreate} 
            loading={loading}
            size="large"
            style={{ 
              minWidth: 100,
              background: currentStep === 0 ? '#1890ff' : '#52c41a',
              borderColor: currentStep === 0 ? '#1890ff' : '#52c41a'
            }}
          >
            {currentStep === 0 ? '下一步' : '创建群聊'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CreateGroupModal;
