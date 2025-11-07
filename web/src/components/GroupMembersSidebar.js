import React, { useState, useEffect } from 'react';
import { List, Avatar, Spin, Typography, Divider } from 'antd';
import { UserOutlined, CrownOutlined } from '@ant-design/icons';
import { groupAPI } from '../services/api';

const { Text } = Typography;

/**
 * 群成员侧边栏组件 - 企业微信风格
 * @param {number} groupId - 群ID
 * @param {boolean} visible - 是否显示侧边栏
 */
const GroupMembersSidebar = ({ groupId, visible }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ownerInfo, setOwnerInfo] = useState(null);

  // 加载群成员
  useEffect(() => {
    if (!groupId || !visible) return;

    const loadMembers = async () => {
      setLoading(true);
      try {
        const response = await groupAPI.getGroupMembers(groupId);
        if (response.code === 0) {
          const memberList = response.data || [];
          setMembers(memberList);

          // 找到群主信息
          const owner = memberList.find(m => m.is_owner);
          setOwnerInfo(owner);
        }
      } catch (error) {
        console.error('加载群成员失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, [groupId, visible]);

  // 获取头像URL
  const getAvatarSrc = (avatar) => {
    if (avatar && avatar !== 'default.png') {
      return `${process.env.REACT_APP_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:8080'}/uploads/avatars/${avatar}`;
    }
    return null;
  };

  if (!visible) return null;

  return (
    <div style={{
      width: '260px',
      height: '100%',
      background: '#fff',
      borderLeft: '1px solid #e8e8e8',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* 标题区域 */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e8e8e8',
        background: '#fafafa',
      }}>
        <Text strong style={{ fontSize: '14px' }}>
          群成员 ({members.length})
        </Text>
      </div>

      {/* 成员列表 */}
      <div style={{
        flex: 1,
        overflow: 'auto',
      }}>
        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100px',
          }}>
            <Spin />
          </div>
        ) : (
          <List
            dataSource={members}
            renderItem={(member) => (
              <List.Item
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size={40}
                      src={getAvatarSrc(member.avatar)}
                      icon={<UserOutlined />}
                    />
                  }
                  title={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      <Text style={{ fontSize: '14px' }}>
                        {member.nickname || member.username || '未知用户'}
                      </Text>
                      {member.is_owner && (
                        <CrownOutlined style={{ color: '#faad14', fontSize: '14px' }} title="群主" />
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
            locale={{
              emptyText: (
                <div style={{ textAlign: 'center', padding: '40px', color: '#ccc' }}>
                  <UserOutlined style={{ fontSize: '32px', marginBottom: '12px' }} />
                  <div>暂无成员</div>
                </div>
              )
            }}
          />
        )}
      </div>
    </div>
  );
};

export default GroupMembersSidebar;
