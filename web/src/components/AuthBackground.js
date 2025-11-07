import { useMemo } from 'react';
import { ANIMATIONS } from '../constants/styles';

const AuthBackground = ({ children }) => {
  // 检测用户是否偏好减少动画
  const prefersReducedMotion = useMemo(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches, []
  );

  // 减少粒子数量以提高性能
  const particleCount = prefersReducedMotion ? 0 : 6;

  // 使用useMemo优化粒子配置
  const particles = useMemo(() => {
    if (prefersReducedMotion) return [];

    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      size: Math.random() * 4 + 2,
      color: Math.random() > 0.5 ? '24, 144, 255' : '114, 46, 209',
      opacity: Math.random() * 0.3 + 0.1,
      shape: Math.random() > 0.6 ? '50%' : '25%',
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: 6 + Math.random() * 8,
      delay: Math.random() * 3,
    }));
  }, [particleCount, prefersReducedMotion]);

  // 几何形状配置
  const shapes = useMemo(() => {
    if (prefersReducedMotion) return [];

    return [
      {
        id: 'circle',
        type: 'circle',
        style: {
          top: '8%',
          left: '12%',
          width: '120px',
          height: '120px',
          background: 'linear-gradient(135deg, rgba(24, 144, 255, 0.12), rgba(114, 46, 209, 0.08))',
          borderRadius: '50%',
          animation: ANIMATIONS.float,
          willChange: 'transform',
        }
      },
      {
        id: 'triangle',
        type: 'triangle',
        style: {
          top: '15%',
          right: '12%',
          width: '0',
          height: '0',
          borderLeft: '45px solid transparent',
          borderRight: '45px solid transparent',
          borderBottom: '78px solid rgba(250, 140, 22, 0.1)',
          animation: ANIMATIONS.triangleRotate,
          willChange: 'transform',
        }
      },
      {
        id: 'square',
        type: 'square',
        style: {
          bottom: '18%',
          left: '8%',
          width: '65px',
          height: '65px',
          background: 'linear-gradient(45deg, rgba(24, 144, 255, 0.1), rgba(250, 140, 22, 0.06))',
          borderRadius: '10px',
          animation: ANIMATIONS.squareRotate,
          willChange: 'transform',
        }
      },
      {
        id: 'hexagon',
        type: 'hexagon',
        style: {
          top: '45%',
          right: '6%',
          width: '70px',
          height: '70px',
          background: 'rgba(114, 46, 209, 0.1)',
          clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
          animation: ANIMATIONS.hexagonPulse,
          willChange: 'transform',
        }
      },
      {
        id: 'diamond',
        type: 'diamond',
        style: {
          bottom: '25%',
          right: '18%',
          width: '55px',
          height: '55px',
          background: 'rgba(250, 140, 22, 0.12)',
          transform: 'rotate(45deg)',
          borderRadius: '6px',
          animation: ANIMATIONS.diamondFloat,
          willChange: 'transform',
        }
      },
    ];
  }, [prefersReducedMotion]);

  return (
    <div
      className="auth-page"
      role="main"
      aria-label="登录注册页面"
      style={{
        minHeight: '100vh',
        background: `
          radial-gradient(circle at 20% 80%, rgba(24, 144, 255, 0.06) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(114, 46, 209, 0.04) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(250, 140, 22, 0.03) 0%, transparent 50%),
          linear-gradient(135deg, #f8f9fa 0%, #e8f4fd 100%)
        `,
        backgroundAttachment: 'fixed',
        animation: prefersReducedMotion ? 'none' : ANIMATIONS.backgroundShift,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
        willChange: prefersReducedMotion ? 'auto' : 'background-position',
      }}
    >
      {/* 装饰性元素 - 对屏幕阅读器隐藏 */}
      <div aria-hidden="true">
        {/* 优化的粒子系统 */}
        {particles.map((particle) => (
          <div
            key={`particle-${particle.id}`}
            style={{
              position: 'absolute',
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              background: `rgba(${particle.color}, ${particle.opacity})`,
              borderRadius: particle.shape,
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              animation: ANIMATIONS.particleFloat(particle.duration, particle.delay),
              willChange: 'transform, opacity',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* 优化的几何形状 */}
        {shapes.map((shape) => (
          <div
            key={shape.id}
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              ...shape.style,
            }}
          />
        ))}
      </div>

      {children}

      {/* 压缩的关键帧样式 */}
      <style jsx global>{`
        @keyframes backgroundShift {
          0%, 100% { background-position: 0% 0%, 0% 0%, 0% 0%; }
          50% { background-position: 100% 100%, 50% 50%, 75% 25%; }
        }

        @keyframes particleFloat {
          0%, 100% {
            transform: translateY(0px) translateX(0px) scale(1) rotate(0deg);
            opacity: 0.5;
          }
          50% {
            transform: translateY(-25px) translateX(-8px) scale(1.1) rotate(180deg);
            opacity: 0.8;
          }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1) rotate(0deg); }
          50% { transform: translateY(-18px) scale(1.06) rotate(180deg); }
        }

        @keyframes triangleRotate {
          0%, 100% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.08); }
        }

        @keyframes squareRotate {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(90deg) scale(1.04); }
          50% { transform: rotate(180deg) scale(0.96); }
          75% { transform: rotate(270deg) scale(1.02); }
        }

        @keyframes hexagonPulse {
          0%, 100% {
            transform: scale(1) rotate(0deg);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.12) rotate(180deg);
            opacity: 0.9;
          }
        }

        @keyframes diamondFloat {
          0%, 100% { transform: translateY(0px) rotate(45deg) scale(1); }
          50% { transform: translateY(-20px) rotate(45deg) scale(1.08); }
        }

        /* 为支持减少动画的用户优化 */
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* GPU加速优化 */
        [class*="particle-"], [class*="shape-"] {
          transform-style: preserve-3d;
          backface-visibility: hidden;
          -webkit-perspective: 1000px;
          perspective: 1000px;
        }
      `}</style>
    </div>
  );
};

export default AuthBackground;