import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Card, message } from 'antd';
import { UserOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useDebounce, useFormValidation } from '../hooks/useFormHelpers';
import { createNicknameValidator } from '../utils/validation';
import AuthBackground from '../components/AuthBackground';
import AuthFormTitle from '../components/AuthFormTitle';
import AuthFormInput from '../components/AuthFormInput';
import AuthButton from '../components/AuthButton';
import AuthModeToggle from '../components/AuthModeToggle';
import PasswordStrength from '../components/PasswordStrength';
import ResultModal, { RESULT_TYPES } from '../components/ResultModal';
import { getErrorType } from '../components/ErrorAlert';
import { CARD_STYLES, SIZES } from '../constants/styles';

const AuthPage = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [isLogin, setIsLogin] = useState(true);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
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
    setErrorModalVisible(false);

    try {
      let result;
      if (isLogin) {
        // 登录模式
        result = await login(values.phone, values.password);
        if (result.success) {
          message.success('登录成功！');
          navigate('/');
        } else {
          const errorType = getErrorType(result);
          const resultType = errorType === 'network' ? RESULT_TYPES.NETWORK : 
                           errorType === 'validation' ? RESULT_TYPES.WARNING : 
                           RESULT_TYPES.ERROR;
          setErrorDetails({
            type: resultType,
            title: `${isLogin ? '登录' : '注册'}失败`,
            message: result.message,
            showRetry: errorType === 'network'
          });
          setErrorModalVisible(true);
        }
      } else {
        // 注册模式
        result = await register(values.phone, values.password, values.nickname);
        if (result.success) {
          setSuccessModalVisible(true);
        } else {
          const errorType = getErrorType(result);
          const resultType = errorType === 'network' ? RESULT_TYPES.NETWORK : 
                           errorType === 'validation' ? RESULT_TYPES.WARNING : 
                           RESULT_TYPES.ERROR;
          setErrorDetails({
            type: resultType,
            title: `${isLogin ? '登录' : '注册'}失败`,
            message: result.message,
            showRetry: errorType === 'network'
          });
          setErrorModalVisible(true);
        }
      }
    } catch (error) {
      const errorType = getErrorType(error);
      const resultType = errorType === 'network' ? RESULT_TYPES.NETWORK : 
                       errorType === 'validation' ? RESULT_TYPES.WARNING : 
                       RESULT_TYPES.ERROR;
      setErrorDetails({
        type: resultType,
        title: `${isLogin ? '登录' : '注册'}失败`,
        message: error.message || `${isLogin ? '登录' : '注册'}失败，请检查网络连接`,
        showRetry: errorType === 'network'
      });
      setErrorModalVisible(true);
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

  const handleErrorOk = () => {
    setErrorModalVisible(false);
    setErrorDetails(null);
  };

  const handleErrorRetry = () => {
    setErrorModalVisible(false);
    // 重新提交表单
    form.submit();
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    form.resetFields();
    setPassword('');
    setErrorModalVisible(false);
    setErrorDetails(null);
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
                { validator: createNicknameValidator(2, 20) },
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
      <ResultModal
        visible={successModalVisible}
        type={RESULT_TYPES.SUCCESS}
        title="注册成功！"
        onOk={handleConfirmSuccess}
        centered
        width={280}
      />

      {/* 错误提示弹窗 */}
      {errorDetails && (
        <ResultModal
          visible={errorModalVisible}
          type={errorDetails.type}
          title={errorDetails.title}
          description={errorDetails.message}
          onOk={handleErrorOk}
          onRetry={handleErrorRetry}
          centered
          width={280}
        />
      )}
    </AuthBackground>
  );
};

export default AuthPage;
