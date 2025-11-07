import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Card, message, Modal } from 'antd';
import { UserOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useDebounce, useFormValidation } from '../hooks/useFormHelpers';
import AuthBackground from '../components/AuthBackground';
import AuthFormTitle from '../components/AuthFormTitle';
import AuthFormInput from '../components/AuthFormInput';
import AuthButton from '../components/AuthButton';
import AuthModeToggle from '../components/AuthModeToggle';
import PasswordStrength from '../components/PasswordStrength';
import ErrorAlert, { getErrorType } from '../components/ErrorAlert';
import { CARD_STYLES, SIZES } from '../constants/styles';

const AuthPage = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [isLogin, setIsLogin] = useState(true);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const { login, register } = useAuth();
  const { validatePhone } = useFormValidation();
  const navigate = useNavigate();

  // 防抖验证手机号
  const debouncedPhoneValidation = useDebounce((phone) => {
    if (phone && !validatePhone(phone)) {
      form.setFields([{
        name: 'phone',
        errors: ['请输入正确的手机号码格式'],
      }]);
    }
  }, 500);

  const onFinish = async (values) => {
    setLoading(true);
    setError(null);

    try {
      let result;
      if (isLogin) {
        // 登录模式
        result = await login(values.phone, values.password);
        if (result.success) {
          message.success('登录成功！');
          navigate('/');
        } else {
          setError({ type: getErrorType(result), message: result.message });
        }
      } else {
        // 注册模式
        result = await register(values.phone, values.password, values.nickname);
        if (result.success) {
          setSuccessModalVisible(true);
        } else {
          setError({ type: getErrorType(result), message: result.message });
        }
      }
    } catch (error) {
      setError({
        type: getErrorType(error),
        message: error.message || `${isLogin ? '登录' : '注册'}失败，请检查网络连接`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSuccess = () => {
    setSuccessModalVisible(false);
    setIsLogin(true);
    form.resetFields();
    setPassword('');
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    form.resetFields();
    setPassword('');
    setError(null);
  };

  const handleRetry = () => {
    setError(null);
  };

  const handlePhoneChange = (e) => {
    debouncedPhoneValidation(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  return (
    <AuthBackground>
      <Card
        style={{
          width: '100%',
          maxWidth: isLogin ? '400px' : '420px',
          ...CARD_STYLES.auth,
        }}
        bodyStyle={{
          padding: SIZES.spacing.xxl,
        }}
      >
        <AuthFormTitle isLogin={isLogin} />

        {/* 错误提示 */}
        {error && (
          <ErrorAlert
            type={error.type}
            customMessage={error.message}
            onRetry={handleRetry}
            onClose={() => setError(null)}
          />
        )}

        <Form
          form={form}
          name="auth"
          onFinish={onFinish}
          autoComplete="off"
          layout="vertical"
          key={isLogin ? 'login' : 'register'}
        >
          {/* 手机号输入 */}
          <Form.Item
            name="phone"
            rules={[
              { required: true, message: '请输入手机号码!' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码!' },
            ]}
            style={{ marginBottom: SIZES.spacing.md }}
          >
            <AuthFormInput
              prefix={<PhoneOutlined style={{ color: '#1890ff' }} />}
              placeholder="请输入手机号码"
              disabled={loading}
              onChange={handlePhoneChange}
              autoComplete="tel"
              aria-label="手机号码"
            />
          </Form.Item>

          {/* 昵称输入（仅注册时显示） */}
          {!isLogin && (
            <Form.Item
              name="nickname"
              rules={[
                { required: true, message: '请输入昵称!' },
                { min: 2, message: '昵称至少2位!' },
                { max: 20, message: '昵称最多20位!' },
              ]}
              style={{ marginBottom: SIZES.spacing.md }}
            >
              <AuthFormInput
                prefix={<UserOutlined style={{ color: '#1890ff' }} />}
                placeholder="请输入昵称"
                disabled={loading}
                autoComplete="nickname"
                aria-label="昵称"
              />
            </Form.Item>
          )}

          {/* 密码输入 */}
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码!' },
              { min: 6, message: '密码至少6位!' },
              { max: 20, message: '密码最多20位!' },
            ]}
            style={{ marginBottom: SIZES.spacing.md }}
          >
            <AuthFormInput
              type="password"
              prefix={<LockOutlined style={{ color: '#1890ff' }} />}
              placeholder="请输入密码"
              disabled={loading}
              onChange={handlePasswordChange}
              autoComplete={isLogin ? "current-password" : "new-password"}
              aria-label="密码"
            />
          </Form.Item>

          {/* 密码强度指示器（仅注册时显示） */}
          {!isLogin && (
            <PasswordStrength password={password} show={password.length > 0} />
          )}

          {/* 确认密码输入（仅注册时显示） */}
          {!isLogin && (
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
              style={{ marginBottom: SIZES.spacing.lg }}
            >
              <AuthFormInput
                type="password"
                prefix={<LockOutlined style={{ color: '#1890ff' }} />}
                placeholder="请确认密码"
                disabled={loading}
                autoComplete="new-password"
                aria-label="确认密码"
              />
            </Form.Item>
          )}

          {/* 提交按钮 */}
          <Form.Item style={{ marginBottom: SIZES.spacing.lg }}>
            <AuthButton loading={loading}>
              {loading ? `${isLogin ? '登录' : '注册'}中...` : `${isLogin ? '登录账户' : '创建账户'}`}
            </AuthButton>
          </Form.Item>

          {/* 模式切换 */}
          <AuthModeToggle
            isLogin={isLogin}
            onToggle={toggleMode}
            loading={loading}
          />
        </Form>
      </Card>

      {/* 注册成功弹窗 */}
      <Modal
        title=""
        open={successModalVisible}
        onOk={handleConfirmSuccess}
        onCancel={handleConfirmSuccess}
        okText="确定"
        cancelButtonProps={{ style: { display: 'none' } }}
        centered
        width={280}
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        styles={{
          content: {
            borderRadius: SIZES.borderRadius.large,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
          },
          body: {
            padding: SIZES.spacing.lg,
            textAlign: 'center',
          },
          footer: {
            borderTop: '1px solid rgba(24, 144, 255, 0.1)',
            textAlign: 'center',
          },
        }}
      >
        <div style={{
          fontSize: '16px',
          color: '#333',
          fontWeight: '600',
        }}>
          注册成功！
        </div>
      </Modal>
    </AuthBackground>
  );
};

export default AuthPage;
