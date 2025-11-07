// 基于 pinyin-pro 库的中文拼音首字母工具
import { pinyin } from 'pinyin-pro';

/**
 * 获取中文字符的拼音首字母
 * @param {string} char - 中文字符
 * @returns {string} 拼音首字母 A-Z，如果无法识别返回 '#'
 */
export const getChinesePinyinInitial = (char) => {
  if (!char) return '#';

  // 如果已经是英文字母，直接返回
  const upperChar = char.toUpperCase();
  if (/^[A-Z]$/.test(upperChar)) {
    return upperChar;
  }

  try {
    // 使用 pinyin-pro 获取拼音首字母
    const firstLetter = pinyin(char, {
      pattern: 'first', // 获取首字母
      toneType: 'none',  // 不要声调
      type: 'array'      // 返回数组格式
    })[0];

    if (firstLetter && /^[A-Z]$/i.test(firstLetter)) {
      return firstLetter.toUpperCase();
    }
  } catch (error) {
    console.warn('获取拼音首字母失败:', char, error);
  }

  // 如果是数字，归到 '#'
  if (/^\d$/.test(char)) {
    return '#';
  }

  // 其他无法识别的字符归到 '#'
  return '#';
};

/**
 * 获取姓名的首字母（用于分组）
 * @param {string} name - 姓名
 * @returns {string} 首字母 A-Z 或 '#'
 */
export const getNameInitial = (name) => {
  if (!name || typeof name !== 'string') return '#';

  const firstChar = name.trim()[0];
  if (!firstChar) return '#';

  return getChinesePinyinInitial(firstChar);
};

/**
 * 获取联系人分组的显示文本
 * @param {string} letter - 分组字母
 * @returns {string} 显示文本
 */
export const getGroupDisplayText = (letter) => {
  return letter; // 直接返回字母，不加额外文字
};