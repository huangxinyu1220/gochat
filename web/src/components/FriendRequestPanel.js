import React, { useState, useEffect, useCallback } from 'react';
import { Drawer, List, Avatar, Button, Empty, Spin, message, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { friendRequestAPI } from '../services/api';
import { getAvatarSrc } from '../utils/avatar';

const { Text } = Typography;

/**
 * 好友申请面板组件
 * 以抽屉形式展示收到的好友申请
 */
const FriendRequestPanel = ({ visible, onClose, onAccept, onCountChange }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  // 加载申请列表
  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await friendRequestAPI.getReceivedRequests({ page: 1, page_size: 50 });
      if (response?.data) {
        const items = response.data.items || [];
        setRequests(items);
        // 通知父组件更新数量
        onCountChange && onCountChange(items.length);
      }
    } catch (error) {
      console.error('加载申请列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  // 面板打开时加载数据
  useEffect(() => {
    if (visible) {
      loadRequests();
    }
  }, [visible, loadRequests]);

  // 同意申请
  const handleAccept = async (request) => {
    setActionLoading(prev => ({ ...prev, [request.id]: 'accept' }));
    try {
      await friendRequestAPI.acceptRequest(request.id);
      message.success(`已同意 ${request.from_user?.nickname || '对方'} 的好友申请`);

      // 从列表中移除
      setRequests(prev => {
        const newList = prev.filter(r => r.id !== request.id);
        onCountChange && onCountChange(newList.length);
        return newList;
      });

      // 通知父组件刷新好友列表
      onAccept && onAccept();
    } catch (error) {
      const errorMsg = error?.message || error?.error || '操作失败';
      message.error(errorMsg);
    } finally {
      setActionLoading(prev => ({ ...prev, [request.id]: null }));
    }
  };

  // 拒绝申请
  const handleReject = async (request) => {
    setActionLoading(prev => ({ ...prev, [request.id]: 'reject' }));
    try {
      await friendRequestAPI.rejectRequest(request.id);
      message.success('已拒绝该申请');

      // 从列表中移除
      setRequests(prev => {
        const newList = prev.filter(r => r.id !== request.id);
        onCountChange && onCountChange(newList.length);
        return newList;
      });
    } catch (error) {
      const errorMsg = error?.message || error?.error || '操作失败';
      message.error(errorMsg);
    } finally {
      setActionLoading(prev => ({ ...prev, [request.id]: null }));
    }
  };

  // 格式化时间
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60 * 1000) return '刚刚';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)}天前`;
    return date.toLocaleDateString();
  };

  // 刷新方法，供外部调用
  const refresh = useCallback(() => {
    loadRequests();
  }, [loadRequests]);

  // 将 refresh 方法暴露给父组件
  useEffect(() => {
    if (visible && window) {
      window.__friendRequestPanelRefresh = refresh;
    }
    return () => {
      if (window.__friendRequestPanelRefresh === refresh) {
        delete window.__friendRequestPanelRefresh;
      }
    };
  }, [visible, refresh]);

  return (
    <Drawer
      title="好友申请"
      placement="right"
      width={380}
      onClose={onClose}
      open={visible}
      styles={{ body: { padding: 0 } }}
    >
      {loading && requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin />
        </div>
      ) : requests.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无好友申请"
          style={{ marginTop: 60 }}
        />
      ) : (
        <List
          dataSource={requests}
          renderItem={(request) => {
            const fromUser = request.from_user || {};
            const isLoading = actionLoading[request.id];
            const hasMessage = request.message && request.message.trim();

            return (
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                {/* 头像 */}
                <Avatar
                  size={40}
                  icon={<UserOutlined />}
                  src={getAvatarSrc(fromUser.avatar)}
                  style={{ flexShrink: 0 }}
                >
                  {fromUser.nickname?.[0]}
                </Avatar>

                {/* 用户信息 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Text strong style={{ fontSize: '14px' }}>
                      {fromUser.nickname || '未知用户'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      {formatTime(request.created_at)}
                    </Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {hasMessage ? request.message : '请求添加你为好友'}
                  </Text>
                </div>

                {/* 操作按钮 */}
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <Button
                    size="small"
                    loading={isLoading === 'reject'}
                    disabled={!!isLoading}
                    onClick={() => handleReject(request)}
                    style={{
                      borderRadius: '4px',
                      fontSize: '12px',
                      padding: '0 10px',
                      height: '26px',
                    }}
                  >
                    拒绝
                  </Button>
                  <Button
                    type="primary"
                    size="small"
                    loading={isLoading === 'accept'}
                    disabled={!!isLoading}
                    onClick={() => handleAccept(request)}
                    style={{
                      backgroundColor: '#52c41a',
                      borderColor: '#52c41a',
                      borderRadius: '4px',
                      fontSize: '12px',
                      padding: '0 10px',
                      height: '26px',
                    }}
                  >
                    同意
                  </Button>
                </div>
              </div>
            );
          }}
        />
      )}
    </Drawer>
  );
};

export default FriendRequestPanel;
