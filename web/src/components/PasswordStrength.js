import React, { useId } from 'react';
import { Progress } from 'antd';
import { useFormValidation } from '../hooks/useFormHelpers';
import { COLORS } from '../constants/styles';

const PasswordStrength = ({ password, show = true }) => {
  const { getPasswordStrength, validatePassword } = useFormValidation();
  const strengthId = useId();

  if (!show || !password) {
    return null;
  }

  const strength = getPasswordStrength(password);
  const validation = validatePassword(password);

  const getProgressPercent = () => {
    switch (strength.level) {
      case 'weak': return 25;
      case 'medium': return 50;
      case 'good': return 75;
      case 'strong': return 100;
      default: return 0;
    }
  };

  const getStrokeColor = () => {
    switch (strength.level) {
      case 'weak': return '#ff4d4f';
      case 'medium': return '#faad14';
      case 'good': return '#52c41a';
      case 'strong': return '#1890ff';
      default: return '#f0f0f0';
    }
  };

  const getStrengthDescription = () => {
    const requirements = [
      validation.length ? '长度要求已满足' : '需要6-20位字符',
      validation.hasLetter ? '包含字母' : '缺少字母',
      validation.hasNumber ? '包含数字' : '缺少数字',
      validation.hasSpecial ? '包含特殊字符' : '缺少特殊字符',
    ];
    return `密码强度${strength.text}。${requirements.join('，')}。`;
  };

  return (
    <div
      style={{ marginTop: '8px' }}
      role="status"
      aria-labelledby={strengthId}
      aria-live="polite"
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px'
      }}>
        <span
          id={strengthId}
          style={{
            fontSize: '12px',
            color: COLORS.textSecondary
          }}
        >
          密码强度
        </span>
        <span style={{
          fontSize: '12px',
          color: strength.color,
          fontWeight: '600'
        }}>
          {strength.text}
        </span>
      </div>

      <Progress
        percent={getProgressPercent()}
        strokeColor={getStrokeColor()}
        trailColor="#f0f0f0"
        showInfo={false}
        size="small"
        style={{ marginBottom: '8px' }}
        aria-label={getStrengthDescription()}
      />

      <div
        style={{ fontSize: '11px', color: COLORS.textSecondary, lineHeight: '1.4' }}
        aria-label="密码要求列表"
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <span
            style={{ color: validation.length ? '#52c41a' : '#ff4d4f' }}
            aria-label={validation.length ? '长度要求已满足' : '需要6-20位字符'}
          >
            {validation.length ? '✓' : '✗'} 6-20位字符
          </span>
          <span
            style={{ color: validation.hasLetter ? '#52c41a' : '#d9d9d9' }}
            aria-label={validation.hasLetter ? '包含字母' : '需要包含字母'}
          >
            {validation.hasLetter ? '✓' : '✗'} 包含字母
          </span>
          <span
            style={{ color: validation.hasNumber ? '#52c41a' : '#d9d9d9' }}
            aria-label={validation.hasNumber ? '包含数字' : '需要包含数字'}
          >
            {validation.hasNumber ? '✓' : '✗'} 包含数字
          </span>
          <span
            style={{ color: validation.hasSpecial ? '#52c41a' : '#d9d9d9' }}
            aria-label={validation.hasSpecial ? '包含特殊字符' : '需要包含特殊字符'}
          >
            {validation.hasSpecial ? '✓' : '✗'} 包含特殊字符
          </span>
        </div>
      </div>

      {/* 为屏幕阅读器提供的详细描述 */}
      <div className="sr-only" aria-live="polite">
        {getStrengthDescription()}
      </div>
    </div>
  );
};

export default PasswordStrength;