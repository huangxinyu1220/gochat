import React from 'react';
import { Skeleton, Card } from 'antd';
import AuthBackground from './AuthBackground';
import { CARD_STYLES, SIZES } from '../constants/styles';

const AuthSkeleton = () => {
  return (
    <AuthBackground>
      <Card
        style={{
          width: '100%',
          maxWidth: '420px',
          ...CARD_STYLES.auth,
        }}
        bodyStyle={{
          padding: SIZES.spacing.xxl,
        }}
      >
        {/* 标题骨架 */}
        <div style={{ textAlign: 'center', marginBottom: SIZES.spacing.xl }}>
          <Skeleton.Input
            active
            size="large"
            style={{
              width: '120px',
              height: '32px',
              marginBottom: SIZES.spacing.sm
            }}
          />
          <Skeleton.Input
            active
            size="small"
            style={{ width: '180px', height: '16px' }}
          />
        </div>

        {/* 表单字段骨架 */}
        <div style={{ marginBottom: SIZES.spacing.md }}>
          <Skeleton.Input
            active
            size="large"
            style={{
              width: '100%',
              height: SIZES.input.height,
              borderRadius: SIZES.borderRadius.medium
            }}
          />
        </div>

        <div style={{ marginBottom: SIZES.spacing.md }}>
          <Skeleton.Input
            active
            size="large"
            style={{
              width: '100%',
              height: SIZES.input.height,
              borderRadius: SIZES.borderRadius.medium
            }}
          />
        </div>

        <div style={{ marginBottom: SIZES.spacing.md }}>
          <Skeleton.Input
            active
            size="large"
            style={{
              width: '100%',
              height: SIZES.input.height,
              borderRadius: SIZES.borderRadius.medium
            }}
          />
        </div>

        {/* 按钮骨架 */}
        <div style={{ marginBottom: SIZES.spacing.lg }}>
          <Skeleton.Button
            active
            size="large"
            block
            style={{
              height: SIZES.input.height,
              borderRadius: SIZES.borderRadius.medium
            }}
          />
        </div>

        {/* 底部链接骨架 */}
        <div style={{ textAlign: 'center' }}>
          <Skeleton.Input
            active
            size="small"
            style={{ width: '150px', height: '20px' }}
          />
        </div>
      </Card>
    </AuthBackground>
  );
};

// 通用的加载骨架屏组件
const LoadingSkeleton = ({ type = 'auth', ...props }) => {
  switch (type) {
    case 'auth':
      return <AuthSkeleton {...props} />;
    case 'simple':
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px'
        }}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      );
    default:
      return <AuthSkeleton {...props} />;
  }
};

export default LoadingSkeleton;