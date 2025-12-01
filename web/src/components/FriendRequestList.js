import React, { useState, useEffect, useCallback } from 'react';
import { List, Avatar, Button, Empty, Spin, message, Tag, Tooltip } from 'antd';
import { CheckOutlined, CloseOutlined, UserOutlined } from '@ant-design/icons';
import { friendRequestAPI } from '../services/api';

// 申请状态常量
const REQUEST_STATUS = {
  PENDING: 0,
  ACCEPTED: 1,
  REJECTED: 2,
  EXPIRED: 3,
};

// 状态标签配置
const STATUS_CONFIG = {
  [REQUEST_STATUS.PENDING]: { text: '待处理', color: 'processing' },
  [REQUEST_STATUS.ACCEPTED]: { text: '已同意', color: 'success' },
  [REQUEST_STATUS.REJECTED]: { text: '已拒绝', color: 'error' },
  [REQUEST_STATUS.EXPIRED]: { text: '已过期', color: 'default' },
};

/**
 * 好友申请列表组件
 * @param {string} type - 'received' (收到的申请) 或 'sent' (发出的申请)
 * @param {function} onAccept - 同意申请后的回调
 */
const FriendRequestList = ({ type = 'received', onAccept }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState({});

  // 加载申请列表
  const loadRequests = useCallback(async (currentPage = 1) => {
    setLoading(true);
    try {
      const api = type === 'received'
        ? friendRequestAPI.getReceivedRequests
        : friendRequestAPI.getSentRequests;

      const response = await api({ page: currentPage, page_size: 20 });
      if (response?.data) {
        setRequests(response.data.items || []);
        setTotal(response.data.total || 0);
      }
    } catch (error) {
      console.error('加载申请列表失败:', error);
      message.error('加载申请列表失败');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    loadRequests(page);
  }, [page, loadRequests]);

  // 刷新列表
  const refresh = () => {
    loadRequests(page);
  };

  // 同意申请
  const handleAccept = async (requestId) => {
    setActionLoading(prev => ({ ...prev, [requestId]: 'accept' }));
    try {
      await friendRequestAPI.acceptRequest(requestId);
      message.success('已同意好友申请');
      refresh();
      onAccept && onAccept();
    } catch (error) {
      const errorMsg = error?.message || error?.error || '操作失败';
      message.error(errorMsg);
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: null }));
    }
  };

  // 拒绝申请
  const handleReject = async (requestId) => {
    setActionLoading(prev => ({ ...prev, [requestId]: 'reject' }));
    try {
      await friendRequestAPI.rejectRequest(requestId);
      message.success('已拒绝好友申请');
      refresh();
    } catch (error) {
      const errorMsg = error?.message || error?.error || '操作失败';
      message.error(errorMsg);
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: null }));
    }
  };

  // 取消申请
  const handleCancel = async (requestId) => {
    setActionLoading(prev => ({ ...prev, [requestId]: 'cancel' }));
    try {
      await friendRequestAPI.cancelRequest(requestId);
      message.success('已取消申请');
      refresh();
    } catch (error) {
      const errorMsg = error?.message || error?.error || '操作失败';
      message.error(errorMsg);
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: null }));
    }
  };

  // 格式化时间
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    const now = new Date();
    const diff = now - date;

    // 小于1分钟
    if (diff < 60 * 1000) {
      return '刚刚';
    }
    // 小于1小时
    if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / 60000)}分钟前`;
    }
    // 小于24小时
    if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / 3600000)}小时前`;
    }
    // 小于7天
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / 86400000)}天前`;
    }
    // 超过7天显示日期
    return date.toLocaleDateString();
  };

  // 渲染操作按钮
  const renderActions = (item) => {
    const isLoading = actionLoading[item.id];
    const status = item.status;

    // 待处理状态
    if (status === REQUEST_STATUS.PENDING) {
      if (type === 'received') {
        return [
          <Tooltip title="同意" key="accept">
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              loading={isLoading === 'accept'}
              onClick={() => handleAccept(item.id)}
            >
              同意
            </Button>
          </Tooltip>,
          <Tooltip title="拒绝" key="reject">
            <Button
              size="small"
              icon={<CloseOutlined />}
              loading={isLoading === 'reject'}
              onClick={() => handleReject(item.id)}
            >
              拒绝
            </Button>
          </Tooltip>
        ];
      } else {
        // 发出的申请可以取消
        return [
          <Button
            size="small"
            danger
            loading={isLoading === 'cancel'}
            onClick={() => handleCancel(item.id)}
            key="cancel"
          >
            取消申请
          </Button>
        ];
      }
    }

    // 非待处理状态显示标签
    const statusConfig = STATUS_CONFIG[status] || { text: '未知', color: 'default' };
    return [
      <Tag color={statusConfig.color} key="status">
        {statusConfig.text}
      </Tag>
    ];
  };

  // 获取用户信息
  const getUserInfo = (item) => {
    return type === 'received' ? item.from_user : item.to_user;
  };

  if (loading && requests.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={type === 'received' ? '暂无收到的申请' : '暂无发出的申请'}
      />
    );
  }

  return (
    <List
      dataSource={requests}
      loading={loading}
      pagination={{
        current: page,
        total: total,
        pageSize: 20,
        onChange: setPage,
        showTotal: (t) => `共 ${t} 条`,
        size: 'small',
      }}
      renderItem={(item) => {
        const userInfo = getUserInfo(item);
        return (
          <List.Item
            actions={renderActions(item)}
            style={{
              padding: '12px 0',
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            <List.Item.Meta
              avatar={
                <Avatar
                  size={48}
                  icon={<UserOutlined />}
                  src={userInfo?.avatar ? `/uploads/${userInfo.avatar}` : undefined}
                />
              }
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{userInfo?.nickname || '未知用户'}</span>
                  {userInfo?.phone && (
                    <span style={{ fontSize: 12, color: '#999' }}>
                      ({userInfo.phone})
                    </span>
                  )}
                </div>
              }
              description={
                <div>
                  {item.message && (
                    <div style={{ marginBottom: 4, color: '#666' }}>
                      {item.message}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {formatTime(item.created_at)}
                  </div>
                </div>
              }
            />
          </List.Item>
        );
      }}
    />
  );
};

export default FriendRequestList;
