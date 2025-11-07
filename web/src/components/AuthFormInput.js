import React, { useId } from 'react';
import { Input } from 'antd';
import { useInputFocus } from '../hooks/useFormHelpers';
import { INPUT_STYLES } from '../constants/styles';

const AuthFormInput = ({
  prefix,
  placeholder,
  type = 'text',
  disabled = false,
  autoComplete,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  error = false,
  errorMessage,
  ...props
}) => {
  const { handleFocus, handleBlur } = useInputFocus();
  const errorId = useId();

  const InputComponent = type === 'password' ? Input.Password : Input;

  // 构建 aria-describedby 属性
  const buildAriaDescribedBy = () => {
    const descriptions = [];
    if (ariaDescribedBy) descriptions.push(ariaDescribedBy);
    if (error && errorMessage) descriptions.push(errorId);
    return descriptions.length > 0 ? descriptions.join(' ') : undefined;
  };

  return (
    <>
      <InputComponent
        prefix={prefix}
        placeholder={placeholder}
        size="large"
        disabled={disabled}
        autoComplete={autoComplete}
        aria-label={ariaLabel}
        aria-describedby={buildAriaDescribedBy()}
        aria-invalid={error}
        aria-required="true"
        style={{
          ...INPUT_STYLES.base,
          borderColor: error ? '#ff4d4f' : INPUT_STYLES.base.borderColor,
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
      {/* 错误信息，对屏幕阅读器可见 */}
      {error && errorMessage && (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          style={{
            color: '#ff4d4f',
            fontSize: '12px',
            marginTop: '4px',
            display: 'block',
          }}
        >
          {errorMessage}
        </div>
      )}
    </>
  );
};

export default AuthFormInput;