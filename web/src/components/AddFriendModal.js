import React, { useState } from 'react';
import { Modal, Input, message } from 'antd';
import { friendRequestAPI } from '../services/api';

const { TextArea } = Input;

/**
 * 添加好友弹窗组件
 * 用于发送好友申请时输入验证消息
 */
const AddFriendModal = ({ visible, targetUser, onSuccess, onCancel }) => {
  const [requestMessage, setRequestMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // 重置表单
  const resetForm = () => {
    setRequestMessage('');
  };

  // 处理确认
  const handleConfirm = async () => {
    if (!targetUser) {
      message.error('目标用户信息缺失');
      return;
    }

    setLoading(true);
    try {
      await friendRequestAPI.sendRequest(targetUser.id, requestMessage);
      message.success('好友申请已发送');
      resetForm();
      onSuccess && onSuccess();
    } catch (error) {
      const errorMsg = error?.message || error?.error || '发送申请失败';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 处理取消
  const handleCancel = () => {
    resetForm();
    onCancel && onCancel();
  };

  return (
    <Modal
      title={`添加 ${targetUser?.nickname || '用户'} 为好友`}
      open={visible}
      onOk={handleConfirm}
      onCancel={handleCancel}
      okText="发送申请"
      cancelText="取消"
      confirmLoading={loading}
      destroyOnClose
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, color: '#666' }}>
          验证消息（可选）
        </div>
        <TextArea
          placeholder="请输入验证消息，例如：我是xxx"
          maxLength={200}
          value={requestMessage}
          onChange={(e) => setRequestMessage(e.target.value)}
          rows={3}
          showCount
        />
      </div>
      {targetUser && (
        <div style={{
          padding: '12px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <img
            src={targetUser.avatar ? `/uploads/${targetUser.avatar}` : '/default-avatar.png'}
            alt="avatar"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              objectFit: 'cover'
            }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/default-avatar.png';
            }}
          />
          <div>
            <div style={{ fontWeight: 500 }}>{targetUser.nickname}</div>
            {targetUser.phone && (
              <div style={{ fontSize: 12, color: '#999' }}>{targetUser.phone}</div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default AddFriendModal;
