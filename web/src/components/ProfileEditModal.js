import React, { useState, useRef } from 'react';
import { Modal, Form, Input, Button, Avatar, Row, Col, Select, Tooltip, App } from 'antd';
import { UserOutlined, CameraOutlined, LoadingOutlined } from '@ant-design/icons';
import { userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { createNicknameValidator } from '../utils/validation';
import { getAvatarSrc, updateAvatarCacheVersion } from '../utils/avatar';

const ProfileEditModal = ({ visible, onCancel, onSuccess }) => {
  const { message } = App.useApp(); // 使用 App.useApp() 获取 message 实例
  const { user, updateUser } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const fileInputRef = useRef(null);

  // 获取头像显示URL（优化缓存机制）
  const getCurrentAvatarSrc = () => {
    if (previewAvatar) return previewAvatar;
    return getAvatarSrc(user?.avatar);
  };

  // 处理头像文件选择
  const handleAvatarChange = (file) => {
    // 检查文件类型
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件！');
      return false;
    }

    // 检查文件大小 (5MB)
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('图片大小不能超过 5MB！');
      return false;
    }

    setAvatarFile(file);

    // 预览图片
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewAvatar(e.target.result);
    };
    reader.readAsDataURL(file);

    return false; // 阻止自动上传
  };

  // 点击头像区域触发文件选择
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  // 保存个人信息
  const handleSave = async (values) => {
    setLoading(true);
    try {
      let avatarUrl = user?.avatar;

      // 如果有新头像文件，先上传头像
      if (avatarFile) {
        setAvatarLoading(true);
        const uploadResponse = await userAPI.uploadAvatar(avatarFile);
        if (uploadResponse.code === 0 && uploadResponse.data?.avatar_url) {
          // 从完整URL中提取文件名
          const urlParts = uploadResponse.data.avatar_url.split('/');
          avatarUrl = urlParts[urlParts.length - 1];
        }
        setAvatarLoading(false);
      }

      // 更新个人信息
      const updateData = {
        nickname: values.nickname,
        gender: values.gender,
        signature: values.signature || '',
      };

      // 只有在有新头像时才包含avatar字段
      if (avatarFile) {
        updateData.avatar = avatarUrl;
      }

      await userAPI.updateProfile(updateData);

      // 更新本地用户信息
      const updatedUser = {
        ...user,
        nickname: values.nickname,
        avatar: avatarUrl,
        gender: values.gender,
        signature: values.signature || '',
      };
      updateUser(updatedUser);

      // 如果头像有更新，刷新全局头像缓存
      if (avatarFile) {
        updateAvatarCacheVersion();
      }

      // 清除预览状态，强制使用新的头像
      setPreviewAvatar(null);
      setAvatarFile(null);

      message.success('个人信息更新成功！');
      onSuccess?.(updatedUser);
      onCancel();
    } catch (error) {
      console.error('更新个人信息失败:', error);
      message.error(error.response?.data?.message || '更新失败，请重试');
    } finally {
      setLoading(false);
      setAvatarLoading(false);
    }
  };

  // 重置表单
  const handleCancel = () => {
    form.resetFields();
    setPreviewAvatar(null);
    setAvatarFile(null);
    onCancel();
  };

  // 表单初始值
  const initialValues = {
    nickname: user?.nickname || '',
    phone: user?.phone || '',
    gender: user?.gender || 1, // 默认为男性
    signature: user?.signature || '',
  };

  return (
    <Modal
      title="编辑个人信息"
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={420}
      destroyOnHidden
      style={{ top: 20 }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={handleSave}
      >
        {/* 头像编辑区域 */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Avatar
              size={80}
              src={getCurrentAvatarSrc()}
              icon={<UserOutlined />}
              style={{
                cursor: 'pointer',
                border: '2px solid #f0f0f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
              onClick={handleAvatarClick}
            />

            {/* 头像上传遮罩 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.3s',
                cursor: 'pointer',
              }}
              onClick={handleAvatarClick}
              onMouseEnter={(e) => e.target.style.opacity = 1}
              onMouseLeave={(e) => e.target.style.opacity = 0}
            >
              {avatarLoading ? (
                <LoadingOutlined style={{ fontSize: '24px', color: 'white' }} />
              ) : (
                <CameraOutlined style={{ fontSize: '24px', color: 'white' }} />
              )}
            </div>
          </div>

          <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
            点击头像更换
          </div>

          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) {
                handleAvatarChange(file);
              }
            }}
          />
        </div>

        {/* 个人信息表单 */}
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              label="昵称"
              name="nickname"
              rules={[
                { required: true, message: '请输入昵称' },
                { validator: createNicknameValidator(2, 20) },
              ]}
            >
              <Input placeholder="请输入昵称" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item label="手机号">
              <Tooltip title="手机号不可修改" placement="top">
                <Input value={user?.phone} disabled style={{ color: '#999' }} />
              </Tooltip>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              label="性别"
              name="gender"
            >
              <Select placeholder="请选择性别">
                <Select.Option value={1}>男</Select.Option>
                <Select.Option value={2}>女</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              label="个性签名"
              name="signature"
            >
              <Input.TextArea
                placeholder="这个人很懒，什么都没留下..."
                rows={3}
                maxLength={200}
                showCount
              />
            </Form.Item>
          </Col>
        </Row>

        {/* 按钮区域 */}
        <div style={{ textAlign: 'right', marginTop: '24px' }}>
          <Button onClick={handleCancel} style={{ marginRight: '8px' }}>
            取消
          </Button>
          <Button type="primary" htmlType="submit" loading={loading || avatarLoading}>
            保存
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default ProfileEditModal;