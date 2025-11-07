import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MainPage from './pages/MainPage';
import LoadingSpinner from './components/LoadingSpinner';

// 受保护的路由组件
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// 公共路由组件（登录状态下跳转到主页）
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
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
          <div className="App">
            <Routes>
              {/* 公开路由 */}
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <RegisterPage />
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
