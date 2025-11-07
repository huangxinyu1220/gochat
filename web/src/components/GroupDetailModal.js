import React, { useState, useEffect } from 'react';
import { Modal, Avatar, List, Button, message, Checkbox } from 'antd';
import { UserOutlined, CrownOutlined, TeamOutlined } from '@ant-design/icons';
import { groupAPI, friendAPI } from '../services/api';

const GroupDetailModal = ({ visible, groupId, onCancel, onUpdate, showAddMemberInitially = false }) => {
  const [groupInfo, setGroupInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(showAddMemberInitially);
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [addingMembers, setAddingMembers] = useState(false);

  useEffect(() => {
    if (visible && groupId) {
      loadGroupInfo();
      loadGroupMembers();
      // 根据prop设置初始状态
      setShowAddMember(showAddMemberInitially);
    } else {
      setShowAddMember(false);
      setSelectedFriends([]);
    }
  }, [visible, groupId, showAddMemberInitially]);

  // 当members加载完成且需要显示添加成员界面时，加载好友列表
  useEffect(() => {
    if (showAddMember && visible && members.length > 0) {
      loadFriends();
    }
  }, [showAddMember, members]);

  const loadGroupInfo = async () => {
    try {
      const response = await groupAPI.getGroup(groupId);
      if (response.code === 0) {
        setGroupInfo(response.data);
      }
    } catch (error) {
      console.error('加载群信息失败:', error);
      message.error('加载群信息失败');
    }
  };

  const loadGroupMembers = async () => {
    setLoading(true);
    try {
      const response = await groupAPI.getGroupMembers(groupId);
      if (response.code === 0) {
        setMembers(response.data || []);
      }
    } catch (error) {
      console.error('加载群成员失败:', error);
      message.error('加载群成员失败');
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      const response = await friendAPI.getFriends();
      if (response.code === 0) {
        const allFriends = response.data || [];
        // 不再过滤已在群中的好友，而是在UI中标记
        setFriends(allFriends);
      }
    } catch (error) {
      console.error('加载好友列表失败:', error);
      message.error('加载好友列表失败');
    }
  };

  const handleShowAddMember = () => {
    setShowAddMember(true);
    loadFriends();
  };

  const handleCancelAddMember = () => {
    // 如果是直接打开添加成员界面（showAddMemberInitially为true），直接关闭整个Modal
    if (showAddMemberInitially) {
      setShowAddMember(false);
      setSelectedFriends([]);
      onCancel(); // 关闭整个Modal
    } else {
      // 否则只是返回详情界面
      setShowAddMember(false);
      setSelectedFriends([]);
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

  const handleAddMembers = async () => {
    if (selectedFriends.length === 0) {
      message.warning('请至少选择一个好友');
      return;
    }

    setAddingMembers(true);
    try {
      const response = await groupAPI.addGroupMembers(groupId, {
        user_ids: selectedFriends
      });

      if (response.code === 0) {
        message.success('添加成员成功');
        setShowAddMember(false);
        setSelectedFriends([]);
        loadGroupMembers();
        if (onUpdate) {
          onUpdate();
        }
      } else {
        message.error(response.message || '添加成员失败');
      }
    } catch (error) {
      console.error('添加成员失败:', error);
      message.error('添加成员失败，请重试');
    } finally {
      setAddingMembers(false);
    }
  };

  if (!groupInfo) {
    return null;
  }

  return (
    <Modal
      title={showAddMember ? '添加群成员' : groupInfo.name}
      open={visible}
      onCancel={showAddMember ? handleCancelAddMember : onCancel}
      footer={null}
      width={480}
    >
      {!showAddMember ? (
        <>
          <div style={{ marginBottom: 16, fontWeight: 500 }}>
            群成员 ({members.length}人)
          </div>

          <List
            loading={loading}
            dataSource={members}
            style={{ maxHeight: '400px', overflowY: 'auto' }}
            renderItem={member => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <Avatar
                      src={member.avatar ? `/uploads/avatars/${member.avatar}` : null}
                      icon={!member.avatar && <UserOutlined />}
                    />
                  }
                  title={
                    <span>
                      {member.username}
                      {member.is_owner && (
                        <CrownOutlined style={{ color: '#faad14', marginLeft: 8 }} />
                      )}
                    </span>
                  }
                  description={
                    member.is_owner ? '群主' : `加入时间：${member.joined_at}`
                  }
                />
              </List.Item>
            )}
          />
        </>
      ) : (
        <>
          <div style={{ marginBottom: 12, color: '#888' }}>
            已选择 {selectedFriends.length} 人
          </div>
          <List
            dataSource={friends}
            style={{ maxHeight: '400px', overflowY: 'auto' }}
            renderItem={friend => {
              const isInGroup = members.some(m => m.user_id === friend.id);
              const canSelect = !isInGroup;

              return (
                <List.Item
                  style={{
                    cursor: canSelect ? 'pointer' : 'not-allowed',
                    padding: '12px 0',
                    opacity: isInGroup ? 0.5 : 1,
                  }}
                  onClick={() => canSelect && handleFriendToggle(friend.id)}
                >
                  <List.Item.Meta
                    avatar={
                      <Checkbox
                        checked={selectedFriends.includes(friend.id)}
                        disabled={isInGroup}
                        style={{ marginRight: 8 }}
                      />
                    }
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar
                            src={friend.avatar ? `/uploads/avatars/${friend.avatar}` : null}
                            icon={!friend.avatar && <UserOutlined />}
                            style={{ marginRight: 8 }}
                          />
                          <span style={{ color: isInGroup ? '#999' : '#333' }}>
                            {friend.nickname}
                          </span>
                        </div>
                        {isInGroup && (
                          <span style={{ fontSize: '12px', color: '#999' }}>已在群中</span>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
            locale={{
              emptyText: (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
                  <TeamOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#d9d9d9' }} />
                  <div style={{ fontSize: '14px', marginBottom: '8px' }}>暂无可添加的好友</div>
                  <div style={{ fontSize: '12px', color: '#bbb' }}>
                    {members.length > 0 ? '所有好友都已在群中' : '请先添加好友后再创建群聊'}
                  </div>
                </div>
              )
            }}
          />
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={handleCancelAddMember}>取消</Button>
            <Button type="primary" onClick={handleAddMembers} loading={addingMembers} disabled={selectedFriends.length === 0}>
              确定
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default GroupDetailModal;
