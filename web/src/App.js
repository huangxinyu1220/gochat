import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import AuthPage from './pages/AuthPage';
import MainPage from './pages/MainPage';
import LoadingSkeleton from './components/LoadingSkeleton';
import './styles/accessibility.css';

// 受保护的路由组件
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSkeleton type="auth" />;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// 公共路由组件（登录状态下跳转到主页）
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSkeleton type="auth" />;
  }

  return isAuthenticated ? <Navigate to="/" replace /> : children;
};

function AppContent() {
  return (
    <ConfigProvider
      theme={{
        token: {
          // 这里可以自定义Ant Design主题色
          colorPrimary: '#1890ff',
        },
      }}
    >
      <AntdApp>
        <WebSocketProvider>
          <Router>
            <div className="App" role="application" aria-label="GoChat 应用程序">
              <Routes>
                {/* 公开路由 - 统一使用AuthPage */}
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <AuthPage />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <PublicRoute>
                      <AuthPage />
                    </PublicRoute>
                  }
                />

                {/* 受保护路由 */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <MainPage />
                    </ProtectedRoute>
                  }
                />

                {/* 默认重定向 */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </Router>
        </WebSocketProvider>
      </AntdApp>
    </ConfigProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
