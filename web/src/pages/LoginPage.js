import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message, Space } from 'antd';
import { LockOutlined, PhoneOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const result = await login(values.phone, values.password);
      if (result.success) {
        message.success('登录成功！');
        navigate('/');
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('登录失败，请检查网络连接');
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
            用户登录
          </Title>
        </div>

        <Form
          name="login"
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

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              block
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Space>
              <Text>还没有账号？</Text>
              <Link to="/register" style={{ color: '#1890ff' }}>
                立即注册
              </Link>
            </Space>
          </div>

          {/* 测试账号提示 */}
          <div
            style={{
              marginTop: '24px',
              padding: '16px',
              background: '#f5f5f5',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#666',
            }}
          >
            <Text strong>测试账号:</Text>
            <br />
            手机：13800138000<br />
            密码：123456
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
