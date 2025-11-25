// 头像缓存版本号，全局管理
let avatarCacheVersion = Date.now();

/**
 * 更新头像缓存版本号（当用户更新头像时调用）
 */
export const updateAvatarCacheVersion = () => {
  avatarCacheVersion = Date.now();
};

/**
 * 获取头像显示URL（优化缓存机制）
 * @param {string} avatar - 头像文件名或路径
 * @returns {string|null} - 完整的头像URL或null
 */
export const getAvatarSrc = (avatar) => {
  if (avatar && avatar !== 'default.png') {
    const baseUrl = process.env.REACT_APP_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:8080';

    // 如果是新格式（完整路径），直接使用
    if (avatar.startsWith('uploads/')) {
      return `${baseUrl}/${avatar}?v=${avatarCacheVersion}`;
    }

    // 如果是旧格式（仅文件名），保持兼容性
    return `${baseUrl}/uploads/files/${avatar}?v=${avatarCacheVersion}`;
  }
  return null;
};

/**
 * 获取当前缓存版本号
 */
export const getAvatarCacheVersion = () => avatarCacheVersion;