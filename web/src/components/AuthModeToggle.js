import React from 'react';
import { Button, Space, Typography } from 'antd';
import { COLORS, SIZES } from '../constants/styles';

const { Text } = Typography;

const AuthModeToggle = ({ isLogin, onToggle, loading = false }) => {
  const handleMouseEnter = (e) => {
    e.target.style.backgroundColor = 'rgba(24, 144, 255, 0.1)';
    e.target.style.transform = 'translateY(-1px)';
  };

  const handleMouseLeave = (e) => {
    e.target.style.backgroundColor = 'transparent';
    e.target.style.transform = 'translateY(0)';
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <Space size="middle">
        <Text style={{
          color: COLORS.textSecondary,
          fontSize: '14px'
        }}>
          {isLogin ? '还没有账户？' : '已有账户？'}
        </Text>
        <Button
          type="link"
          onClick={onToggle}
          disabled={loading}
          style={{
            color: COLORS.primary,
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
            padding: `${SIZES.spacing.xs} ${SIZES.spacing.sm}`,
            borderRadius: SIZES.borderRadius.small,
            transition: 'all 0.3s ease',
            border: 'none',
            background: 'none',
            height: 'auto',
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {isLogin ? '立即注册' : '立即登录'}
        </Button>
      </Space>
    </div>
  );
};

export default AuthModeToggle;