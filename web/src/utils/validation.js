// 验证工具函数

/**
 * 计算字符串的Unicode字符数量（而不是字节数）
 * 正确处理中文等多字节字符
 * @param {string} str
 * @returns {number}
 */
export const getUnicodeLength = (str) => {
  if (!str) return 0;

  // 使用Array.from来正确计算Unicode字符数量
  // 这会将多字节字符（如中文）正确计算为1个字符
  return Array.from(str).length;
};

/**
 * 验证昵称长度（Unicode字符数）
 * @param {string} nickname
 * @param {number} min 最小字符数，默认2
 * @param {number} max 最大字符数，默认20
 * @returns {boolean}
 */
export const validateNicknameLength = (nickname, min = 2, max = 20) => {
  const length = getUnicodeLength(nickname);
  return length >= min && length <= max;
};

/**
 * 创建昵称长度验证器（用于Ant Design表单）
 * @param {number} min 最小字符数
 * @param {number} max 最大字符数
 * @returns {Function} 验证器函数
 */
export const createNicknameValidator = (min = 2, max = 20) => {
  return (rule, value) => {
    if (!value) {
      return Promise.resolve();
    }

    const length = getUnicodeLength(value);

    if (length < min) {
      return Promise.reject(new Error(`昵称至少${min}个字符`));
    }

    if (length > max) {
      return Promise.reject(new Error(`昵称最多${max}个字符`));
    }

    return Promise.resolve();
  };
};

/**
 * 创建通用字符长度验证器
 * @param {string} fieldName 字段名称
 * @param {number} min 最小字符数
 * @param {number} max 最大字符数
 * @returns {Function} 验证器函数
 */
export const createLengthValidator = (fieldName, min, max) => {
  return (rule, value) => {
    if (!value) {
      return Promise.resolve();
    }

    const length = getUnicodeLength(value);

    if (length < min) {
      return Promise.reject(new Error(`${fieldName}至少${min}个字符`));
    }

    if (length > max) {
      return Promise.reject(new Error(`${fieldName}最多${max}个字符`));
    }

    return Promise.resolve();
  };
};