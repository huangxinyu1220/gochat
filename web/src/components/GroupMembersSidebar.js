import React, { useState, useEffect } from 'react';
import { Avatar, List, Button, message, Badge } from 'antd';
import { UserOutlined, CrownOutlined, CloseOutlined } from '@ant-design/icons';
import { groupAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getAvatarSrc } from '../utils/avatar';

const GroupMembersSidebar = ({
  visible,
  groupId,
  onClose,
  groupMembers = [],
  onMembersUpdate,
  currentUser
}) => {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (visible && groupId) {
      loadGroupMembers();
    } else {
      setMembers([]);
    }
  }, [visible, groupId]);

  useEffect(() => {
    if (groupMembers.length > 0) {
      setMembers(groupMembers);
    }
  }, [groupMembers]);

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

  const handleMembersUpdate = () => {
    loadGroupMembers();
    if (onMembersUpdate) {
      onMembersUpdate();
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: '320px',
      height: '100%',
      backgroundColor: '#fff',
      borderLeft: '1px solid #e8e8e8',
      boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>
          群成员 ({members.length})
        </h3>
        <Button 
          type="text" 
          icon={<CloseOutlined />} 
          onClick={onClose}
          size="small"
        />
      </div>

      {/* Members List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <List
          loading={loading}
          dataSource={members}
          renderItem={member => (
            <List.Item
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ position: 'relative', marginRight: '12px' }}>
                  <Avatar
                    src={getAvatarSrc(member.avatar)}
                    icon={<UserOutlined />}
                    size={36}
                  />
                  {member.is_owner && (
                    <CrownOutlined 
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        color: '#faad14',
                        fontSize: '12px',
                        background: '#fff',
                        borderRadius: '50%',
                        padding: '2px'
                      }} 
                    />
                  )}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: 500,
                    color: '#333',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{ 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '120px'
                    }}>
                      {member.username}
                    </span>
                    {member.is_owner && (
                      <Badge 
                        count="群主" 
                        style={{ 
                          backgroundColor: '#faad14',
                          fontSize: '10px',
                          height: '16px',
                          lineHeight: '16px'
                        }} 
                      />
                    )}
                  </div>
                  
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#999',
                    marginTop: '2px'
                  }}>
                    {member.is_owner ? '群主' : member.joined_at}
                  </div>
                </div>
              </div>

              {/* 当前用户标识 */}
              {member.user_id === currentUser?.id && (
                <Badge 
                  count="我" 
                  style={{ 
                    backgroundColor: '#52c41a',
                    fontSize: '10px',
                    height: '16px',
                    lineHeight: '16px'
                  }} 
                />
              )}
            </List.Item>
          )}
          locale={{
            emptyText: (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 20px', 
                color: '#999' 
              }}>
                <UserOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#d9d9d9' }} />
                <div style={{ fontSize: '14px' }}>暂无群成员</div>
              </div>
            )
          }}
        />
      </div>

      {/* Footer */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid #e8e8e8',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '12px', color: '#999' }}>
          群成员信息实时同步
        </div>
      </div>
    </div>
  );
};

export default GroupMembersSidebar;
