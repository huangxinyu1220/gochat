import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || '/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        // Token失效，清除本地存储并跳转到登录页
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      return Promise.reject(data || error);
    } else {
      return Promise.reject(error);
    }
  }
);

// API方法
export const authAPI = {
  // 用户注册
  register: (data) => api.post('/auth/register', data),

  // 用户登录
  login: (data) => api.post('/auth/login', data),

  // 用户登出
  logout: () => api.post('/auth/logout'),
};

export const userAPI = {
  // 获取个人资料
  getProfile: () => api.get('/user/profile'),

  // 更新个人资料
  updateProfile: (data) => api.put('/user/profile', data),

  // 上传头像
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/user/upload-avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // 上传聊天图片
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // 搜索用户
  searchUsers: (keyword) => api.get('/user/search', { params: { keyword } }),
};

export const friendAPI = {
  // 获取好友列表
  getFriends: () => api.get('/friend/list'),

  // 添加好友
  addFriend: (friendId) => api.post('/friend/add', { friend_id: friendId }),

  // 删除好友
  removeFriend: (friendId) => api.delete(`/friend/${friendId}`),
};

export const groupAPI = {
  // 创建群组
  createGroup: (data) => api.post('/group/create', data),

  // 获取群组详情
  getGroup: (groupId) => api.get(`/group/${groupId}`),

  // 获取群成员列表
  getGroupMembers: (groupId) => api.get(`/group/${groupId}/members`),

  // 添加群成员
  addGroupMembers: (groupId, data) => api.post(`/group/${groupId}/members`, data),

  // 退出群组
  quitGroup: (groupId) => api.post(`/group/${groupId}/quit`),

  // 解散群组
  deleteGroup: (groupId) => api.delete(`/group/${groupId}`),
};

export const conversationAPI = {
  // 获取会话列表
  getConversations: () => api.get('/conversation/list'),

  // 清空未读消息
  clearUnreadCount: (conversationId) => api.post(`/conversation/${conversationId}/clear-unread`),
};

export const messageAPI = {
  // 获取历史消息 - 支持多种查询方式
  getMessages: (params, config = {}) => api.get('/message/history', { params, ...config }),

  // 获取历史消息（旧版本兼容）
  getHistory: (conversationId, page = 1) =>
    api.get('/message/history', { params: { conversation_id: conversationId, page } }),
};

export default api;
