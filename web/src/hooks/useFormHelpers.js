import { useCallback } from 'react';
import { INPUT_STYLES } from '../constants/styles';

// 自定义Hook - 处理输入框焦点状态
export const useInputFocus = () => {
  const handleFocus = useCallback((e) => {
    Object.assign(e.target.style, INPUT_STYLES.focused);
  }, []);

  const handleBlur = useCallback((e) => {
    Object.assign(e.target.style, INPUT_STYLES.blur);
  }, []);

  return { handleFocus, handleBlur };
};

// 自定义Hook - 处理按钮悬停效果
export const useButtonHover = () => {
  const handleMouseEnter = useCallback((e, disabled = false) => {
    if (!disabled) {
      e.target.style.boxShadow = '0 6px 20px rgba(24, 144, 255, 0.4)';
      e.target.style.transform = 'translateY(-1px)';
    }
  }, []);

  const handleMouseLeave = useCallback((e, disabled = false) => {
    if (!disabled) {
      e.target.style.boxShadow = '0 4px 12px rgba(24, 144, 255, 0.3)';
      e.target.style.transform = 'translateY(0)';
    }
  }, []);

  return { handleMouseEnter, handleMouseLeave };
};

// 自定义Hook - 防抖
export const useDebounce = (callback, delay) => {
  let timeoutRef = null;

  const debouncedCallback = useCallback((...args) => {
    clearTimeout(timeoutRef);
    timeoutRef = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);

  return debouncedCallback;
};

// 自定义Hook - 表单验证状态
export const useFormValidation = () => {
  const validatePhone = (phone) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  };

  const validatePassword = (password) => {
    return {
      length: password.length >= 6 && password.length <= 20,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
  };

  const getPasswordStrength = (password) => {
    const validation = validatePassword(password);
    let score = 0;

    if (validation.length) score += 1;
    if (validation.hasLetter) score += 1;
    if (validation.hasNumber) score += 1;
    if (validation.hasSpecial) score += 1;

    if (score <= 1) return { level: 'weak', text: '弱', color: '#ff4d4f' };
    if (score === 2) return { level: 'medium', text: '中', color: '#faad14' };
    if (score === 3) return { level: 'good', text: '强', color: '#52c41a' };
    if (score === 4) return { level: 'strong', text: '很强', color: '#1890ff' };

    return { level: 'weak', text: '弱', color: '#ff4d4f' };
  };

  return {
    validatePhone,
    validatePassword,
    getPasswordStrength,
  };
};