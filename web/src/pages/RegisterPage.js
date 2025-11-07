import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

const RegisterPage = () => {
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const result = await register(values.phone, values.password, values.nickname);
      if (result.success) {
        message.success(result.message || '注册成功，请登录！');
        navigate('/login'); // 注册成功后跳转到登录页面
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('注册失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Title level={2} style={{ marginBottom: '8px', color: '#1890ff' }}>
            IM即时通讯
          </Title>
          <Title level={4} style={{ margin: '0', color: '#666' }}>
            用户注册
          </Title>
        </div>

        <Form
          name="register"
          onFinish={onFinish}
          autoComplete="off"
          layout="vertical"
        >
          <Form.Item
            name="phone"
            rules={[
              { required: true, message: '请输入手机号!' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号!' },
            ]}
          >
            <Input
              prefix={<PhoneOutlined />}
              placeholder="手机号"
              size="large"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            name="nickname"
            rules={[
              { required: true, message: '请输入昵称!' },
              { min: 2, message: '昵称至少2位!' },
              { max: 20, message: '昵称最多20位!' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="昵称(2-20位)"
              size="large"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码!' },
              { min: 6, message: '密码至少6位!' },
              { max: 20, message: '密码最多20位!' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码(6-20位)"
              size="large"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不匹配!'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="确认密码"
              size="large"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              block
            >
              {loading ? '注册中...' : '注册'}
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Space>
              <Text>已有账号？</Text>
              <Link to="/login" style={{ color: '#1890ff' }}>
                立即登录
              </Link>
            </Space>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default RegisterPage;
