// 样式常量配置文件

export const COLORS = {
  primary: '#1890ff',
  primaryLight: '#40a9ff',
  secondary: '#722ed1',
  accent: '#fa8c16',
  text: '#333',
  textSecondary: '#666',
  white: '#fff',
  background: '#f8f9fa',
  backgroundSecondary: '#e8f4fd',
  transparent: 'transparent',
};

export const GRADIENTS = {
  primary: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryLight})`,
  background: `linear-gradient(135deg, ${COLORS.background} 0%, ${COLORS.backgroundSecondary} 100%)`,
  backgroundRadial: `
    radial-gradient(circle at 20% 80%, rgba(24, 144, 255, 0.08) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(114, 46, 209, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 40% 40%, rgba(250, 140, 22, 0.04) 0%, transparent 50%)
  `,
};

export const SHADOWS = {
  card: '0 8px 32px rgba(24, 144, 255, 0.1)',
  button: '0 4px 12px rgba(24, 144, 255, 0.3)',
  buttonHover: '0 6px 20px rgba(24, 144, 255, 0.4)',
  inputFocus: '0 0 0 3px rgba(24, 144, 255, 0.1)',
};

export const BORDERS = {
  input: '2px solid rgba(24, 144, 255, 0.1)',
  inputFocus: `2px solid ${COLORS.primary}`,
  modal: '1px solid rgba(24, 144, 255, 0.1)',
};

export const SIZES = {
  borderRadius: {
    small: '4px',
    medium: '8px',
    large: '12px',
    xlarge: '16px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '20px',
    xl: '24px',
    xxl: '32px',
  },
  input: {
    height: '44px',
  },
};

export const INPUT_STYLES = {
  base: {
    height: SIZES.input.height,
    borderRadius: SIZES.borderRadius.medium,
    border: BORDERS.input,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    fontSize: '14px',
    transition: 'all 0.3s ease',
  },
  focused: {
    borderColor: COLORS.primary,
    boxShadow: '0 0 0 2px rgba(24, 144, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  blur: {
    borderColor: 'rgba(24, 144, 255, 0.1)',
    boxShadow: 'none',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
};

export const BUTTON_STYLES = {
  primary: {
    height: SIZES.input.height,
    background: GRADIENTS.primary,
    borderColor: 'transparent',
    borderRadius: SIZES.borderRadius.medium,
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: SHADOWS.button,
    transition: 'all 0.3s ease',
  },
  primaryHover: {
    boxShadow: SHADOWS.buttonHover,
    transform: 'translateY(-1px)',
  },
};

export const CARD_STYLES = {
  auth: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: SIZES.borderRadius.xlarge,
    boxShadow: SHADOWS.card,
    border: BORDERS.modal,
    transform: 'translateY(0)',
    transition: 'all 0.3s ease',
    position: 'relative',
  },
};

export const ANIMATIONS = {
  backgroundShift: 'backgroundShift 15s ease-in-out infinite',
  particleFloat: (duration, delay) => `particleFloat ${duration}s ease-in-out infinite ${delay}s`,
  float: 'float 12s ease-in-out infinite',
  triangleRotate: 'triangleRotate 10s linear infinite',
  squareRotate: 'squareRotate 8s ease-in-out infinite',
  hexagonPulse: 'hexagonPulse 9s ease-in-out infinite',
  diamondFloat: 'diamondFloat 11s ease-in-out infinite',
  ellipseFloat: 'ellipseFloat 13s ease-in-out infinite',
  groupFloat: 'groupFloat 14s ease-in-out infinite',
  waveMove: 'waveMove 6s ease-in-out infinite',
  crossRotate: 'crossRotate 12s linear infinite',
  ringRotate: 'ringRotate 15s linear infinite',
  pulse: (duration, delay) => `pulse ${duration}s ease-in-out infinite ${delay}`,
};