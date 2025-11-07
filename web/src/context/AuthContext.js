import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // 初始化时检查本地存储
  useEffect(() => {
    const initAuth = () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setToken(storedToken);
        } catch (error) {
          // 解析失败，清除本地存储
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // 登录
  const login = async (phone, password) => {
    try {
      const response = await authAPI.login({ phone, password });

      if (response.code === 0 && response.data) {
        const { token: newToken, user_info } = response.data;

        setUser(user_info);
        setToken(newToken);

        // 保存到本地存储
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(user_info));

        return { success: true };
      } else {
        return { success: false, message: response.message || 'Login failed' };
      }
    } catch (error) {
      return { success: false, message: error.message || 'Login failed' };
    }
  };

  // 注册
  const register = async (phone, password, nickname) => {
    try {
      const response = await authAPI.register({ phone, password, nickname });

      if (response.code === 0 && response.data) {
        // 注册成功，跳转到登录页面让用户手动登录
        return { success: true, message: 'Registration successful, please login' };
      } else {
        return { success: false, message: response.message || 'Registration failed' };
      }
    } catch (error) {
      return { success: false, message: error.message || 'Registration failed' };
    }
  };

  // 登出
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      // 登出API调用失败不影响客户端登出
      console.warn('Logout API call failed:', error);
    }

    // 清除状态和本地存储
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // 更新用户信息
  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
