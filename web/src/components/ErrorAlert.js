import React from 'react';
import { Alert, Button } from 'antd';
import { ReloadOutlined, WifiOutlined } from '@ant-design/icons';

// 错误类型枚举
export const ERROR_TYPES = {
  NETWORK: 'network',
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  SERVER: 'server',
  UNKNOWN: 'unknown'
};

// 根据错误信息判断错误类型
export const getErrorType = (error) => {
  if (!error) return ERROR_TYPES.UNKNOWN;

  const errorMessage = error.message || error.toString().toLowerCase();

  if (errorMessage.includes('network') || errorMessage.includes('fetch') ||
      errorMessage.includes('connection') || errorMessage.includes('timeout')) {
    return ERROR_TYPES.NETWORK;
  }

  if (errorMessage.includes('validation') || errorMessage.includes('format') ||
      errorMessage.includes('invalid')) {
    return ERROR_TYPES.VALIDATION;
  }

  if (errorMessage.includes('unauthorized') || errorMessage.includes('auth') ||
      errorMessage.includes('login') || errorMessage.includes('token')) {
    return ERROR_TYPES.AUTHENTICATION;
  }

  if (errorMessage.includes('server') || errorMessage.includes('internal')) {
    return ERROR_TYPES.SERVER;
  }

  return ERROR_TYPES.UNKNOWN;
};

// 获取错误配置
export const getErrorConfig = (type, customMessage) => {
  const configs = {
    [ERROR_TYPES.NETWORK]: {
      type: 'error',
      message: '网络连接失败',
      description: customMessage || '请检查您的网络连接，然后重试',
      icon: <WifiOutlined />,
      showRetry: true
    },
    [ERROR_TYPES.VALIDATION]: {
      type: 'warning',
      message: '输入验证失败',
      description: customMessage || '请检查您输入的信息格式是否正确',
      showRetry: false
    },
    [ERROR_TYPES.AUTHENTICATION]: {
      type: 'error',
      message: '身份验证失败',
      description: customMessage || '用户名或密码错误，请重新输入',
      showRetry: false
    },
    [ERROR_TYPES.SERVER]: {
      type: 'error',
      message: '服务器错误',
      description: customMessage || '服务器暂时无法处理请求，请稍后重试',
      showRetry: true
    },
    [ERROR_TYPES.UNKNOWN]: {
      type: 'error',
      message: '操作失败',
      description: customMessage || '发生未知错误，请重试',
      showRetry: true
    }
  };

  return configs[type] || configs[ERROR_TYPES.UNKNOWN];
};

// 错误提示组件
const ErrorAlert = ({
  error,
  type,
  customMessage,
  onRetry,
  onClose,
  style,
  className
}) => {
  if (!error && !type) return null;

  const errorType = type || getErrorType(error);
  const config = getErrorConfig(errorType, customMessage);

  return (
    <Alert
      type={config.type}
      message={config.message}
      description={config.description}
      icon={config.icon}
      style={{
        marginBottom: '16px',
        borderRadius: '8px',
        ...style
      }}
      className={className}
      action={
        config.showRetry && onRetry ? (
          <Button
            size="small"
            type="primary"
            ghost
            icon={<ReloadOutlined />}
            onClick={onRetry}
          >
            重试
          </Button>
        ) : null
      }
      closable={!!onClose}
      onClose={onClose}
      showIcon
    />
  );
};

export default ErrorAlert;