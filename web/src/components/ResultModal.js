import React from 'react';
import { Modal } from 'antd';
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  CloseCircleOutlined,
  ReloadOutlined,
  WifiOutlined 
} from '@ant-design/icons';
import { SIZES } from '../constants/styles';

// 状态类型枚举
export const RESULT_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  NETWORK: 'network'
};

// 获取状态配置
export const getResultConfig = (type, message, description) => {
  const configs = {
    [RESULT_TYPES.SUCCESS]: {
      icon: <CheckCircleOutlined style={{ fontSize: '24px', color: '#52c41a' }} />,
      title: message || '操作成功',
      description: description,
      showRetry: false,
      okText: '确定'
    },
    [RESULT_TYPES.ERROR]: {
      icon: <CloseCircleOutlined style={{ fontSize: '24px', color: '#ff4d4f' }} />,
      title: message || '操作失败',
      description: description,
      showRetry: true,
      okText: '确定',
      retryText: '重试'
    },
    [RESULT_TYPES.WARNING]: {
      icon: <ExclamationCircleOutlined style={{ fontSize: '24px', color: '#faad14' }} />,
      title: message || '请检查输入',
      description: description,
      showRetry: false,
      okText: '确定'
    },
    [RESULT_TYPES.NETWORK]: {
      icon: <WifiOutlined style={{ fontSize: '24px', color: '#1890ff' }} />,
      title: '网络连接失败',
      description: description || '请检查您的网络连接，然后重试',
      showRetry: true,
      okText: '确定',
      retryText: '重试'
    }
  };

  return configs[type] || configs[RESULT_TYPES.ERROR];
};

// 统一的成功/失败结果弹窗组件
const ResultModal = ({
  visible,
  type,
  title,
  description,
  onOk,
  onRetry,
  onCancel,
  okText,
  retryText,
  cancelText,
  centered = true,
  width = 280,
  customIcon,
  showIcon = true
}) => {
  const config = getResultConfig(type, title, description);
  
  const handleOk = () => {
    if (onOk) {
      onOk();
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <Modal
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={okText || config.okText}
      cancelButtonProps={{ 
        style: { 
          display: config.showRetry && onRetry ? 'inline-block' : 'none' 
        } 
      }}
      centered={centered}
      width={width}
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
      footer={[
        <div key="footer" style={{ textAlign: 'center' }}>
          {config.showRetry && onRetry && (
            <span key="retry" style={{ marginRight: '12px' }}>
              <button
                type="button"
                onClick={handleRetry}
                style={{
                  padding: '6px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {retryText || config.retryText || '重试'}
              </button>
            </span>
          )}
          <span key="ok">
            <button
              type="button"
              onClick={handleOk}
              style={{
                padding: '6px 16px',
                border: 'none',
                borderRadius: '6px',
                background: config.type === RESULT_TYPES.ERROR ? '#ff4d4f' : '#52c41a',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {okText || config.okText || '确定'}
            </button>
          </span>
        </div>
      ]}
    >
      <div style={{ marginBottom: '16px' }}>
        {showIcon && (
          <div style={{ marginBottom: '12px' }}>
            {customIcon || config.icon}
          </div>
        )}
        
        <div style={{
          fontSize: '16px',
          color: '#333',
          fontWeight: '600',
          marginBottom: '8px'
        }}>
          {title || config.title}
        </div>
        
        {description && (
          <div style={{
            fontSize: '14px',
            color: '#666',
            lineHeight: '1.5'
          }}>
            {description}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ResultModal;
