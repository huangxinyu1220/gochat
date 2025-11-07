import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const LoadingSpinner = ({ size = 'default', tip = 'Loading...' }) => {
  const antIcon = <LoadingOutlined style={{ fontSize: 24 }} spin />;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
      }}
    >
      <Spin indicator={antIcon} size={size} tip={tip}>
        <div style={{ padding: 50 }}></div>
      </Spin>
    </div>
  );
};

export default LoadingSpinner;
