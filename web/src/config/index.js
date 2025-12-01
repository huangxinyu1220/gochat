/**
 * 统一配置管理
 *
 * 支持三种配置方式（按优先级）：
 * 1. 环境变量 REACT_APP_*
 * 2. 基于当前访问地址自动推断（适用于跨机器访问）
 * 3. 默认值（localhost）
 */

// 获取当前页面的 host（不含端口）
const getCurrentHost = () => {
  if (typeof window !== 'undefined') {
    return window.location.hostname;
  }
  return 'localhost';
};

// 获取当前页面的协议
const getCurrentProtocol = () => {
  if (typeof window !== 'undefined') {
    return window.location.protocol;
  }
  return 'http:';
};

// 判断是否是本地开发环境
const isLocalDev = () => {
  const host = getCurrentHost();
  return host === 'localhost' || host === '127.0.0.1';
};

// 后端服务端口
const BACKEND_PORT = 8080;

/**
 * 获取后端基础 URL（不含 /api/v1）
 * 例如: http://192.168.1.100:8080
 */
export const getBaseUrl = () => {
  // 优先使用环境变量
  if (process.env.REACT_APP_API_BASE_URL) {
    // 移除 /api/v1 后缀
    return process.env.REACT_APP_API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  }

  // 如果是本地开发，使用 localhost
  if (isLocalDev()) {
    return `http://localhost:${BACKEND_PORT}`;
  }

  // 否则使用当前访问的 host（支持内网 IP 访问）
  const protocol = getCurrentProtocol();
  const host = getCurrentHost();
  return `${protocol}//${host}:${BACKEND_PORT}`;
};

/**
 * 获取 API 基础 URL
 * 例如: http://192.168.1.100:8080/api/v1
 */
export const getApiBaseUrl = () => {
  // 优先使用环境变量
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }

  // 本地开发时使用代理（相对路径）
  if (isLocalDev()) {
    return '/api/v1';
  }

  // 跨机器访问时使用完整 URL
  return `${getBaseUrl()}/api/v1`;
};

/**
 * 获取 WebSocket URL
 * 例如: ws://192.168.1.100:8080/ws
 */
export const getWsUrl = () => {
  // 优先使用环境变量
  if (process.env.REACT_APP_WS_URL) {
    return process.env.REACT_APP_WS_URL;
  }

  // 根据当前协议决定 ws 还是 wss
  const wsProtocol = getCurrentProtocol() === 'https:' ? 'wss:' : 'ws:';
  const host = getCurrentHost();

  // 本地开发使用 localhost
  if (isLocalDev()) {
    return `ws://localhost:${BACKEND_PORT}/ws`;
  }

  // 跨机器访问使用当前 host
  return `${wsProtocol}//${host}:${BACKEND_PORT}/ws`;
};

/**
 * 获取静态资源 URL（头像、图片等）
 * @param {string} path - 资源路径，如 "uploads/avatars/xxx.jpg"
 * @returns {string} 完整的资源 URL
 */
export const getStaticUrl = (path) => {
  if (!path) return '';

  const baseUrl = getBaseUrl();

  // 确保路径以 / 开头
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
};

// 导出配置对象，方便调试
export const config = {
  get baseUrl() {
    return getBaseUrl();
  },
  get apiBaseUrl() {
    return getApiBaseUrl();
  },
  get wsUrl() {
    return getWsUrl();
  },
  isLocalDev: isLocalDev(),
  currentHost: getCurrentHost(),
};

export default config;
