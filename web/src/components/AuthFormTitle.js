import React from 'react';
import { Typography } from 'antd';
import { COLORS, SIZES, GRADIENTS } from '../constants/styles';

const { Title, Text } = Typography;

const AuthFormTitle = ({ isLogin = true }) => {
  return (
    <div style={{ textAlign: 'center', marginBottom: SIZES.spacing.xl }}>
      <Title
        level={2}
        style={{
          marginBottom: SIZES.spacing.sm,
          color: COLORS.primary,
          fontSize: '24px',
          fontWeight: '700',
          background: GRADIENTS.primary,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        GoChat
      </Title>
      <Text style={{
        color: COLORS.textSecondary,
        fontSize: '14px',
        opacity: 0.8,
      }}>
        {isLogin ? '欢迎回来，请登录您的账户' : '创建您的专属账户'}
      </Text>
    </div>
  );
};

export default AuthFormTitle;