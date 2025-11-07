import React from 'react';
import { Button } from 'antd';
import { useButtonHover } from '../hooks/useFormHelpers';
import { BUTTON_STYLES } from '../constants/styles';

const AuthButton = ({
  loading = false,
  children,
  onClick,
  type = 'primary',
  block = true,
  'aria-describedby': ariaDescribedBy,
  ...props
}) => {
  const { handleMouseEnter, handleMouseLeave } = useButtonHover();

  const baseStyle = type === 'primary' ? BUTTON_STYLES.primary : {};

  return (
    <Button
      type={type}
      htmlType="submit"
      loading={loading}
      size="large"
      block={block}
      onClick={onClick}
      aria-describedby={ariaDescribedBy}
      aria-disabled={loading}
      style={{
        ...baseStyle,
        transform: loading ? 'scale(0.98)' : 'scale(1)',
      }}
      onMouseEnter={(e) => handleMouseEnter(e, loading)}
      onMouseLeave={(e) => handleMouseLeave(e, loading)}
      disabled={loading}
      {...props}
    >
      {/* 为屏幕阅读器提供加载状态信息 */}
      {loading && (
        <span className="sr-only" aria-live="polite">
          正在处理请求，请稍候
        </span>
      )}
      {children}
    </Button>
  );
};

export default AuthButton;