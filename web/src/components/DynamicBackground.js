import React, { useEffect, useState } from 'react';

const DynamicBackground = () => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const generateParticles = () => {
      const newParticles = [];
      for (let i = 0; i < 50; i++) {
        newParticles.push({
          id: i,
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          size: Math.random() * 3 + 1,
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: (Math.random() - 0.5) * 0.5,
          opacity: Math.random() * 0.5 + 0.2,
        });
      }
      setParticles(newParticles);
    };

    generateParticles();

    const animateParticles = () => {
      setParticles(prevParticles =>
        prevParticles.map(particle => {
          let newX = particle.x + particle.speedX;
          let newY = particle.y + particle.speedY;
          let newSpeedX = particle.speedX;
          let newSpeedY = particle.speedY;

          // 边界检测和反弹
          if (newX <= 0 || newX >= window.innerWidth) {
            newSpeedX = -newSpeedX;
            newX = Math.max(0, Math.min(window.innerWidth, newX));
          }
          if (newY <= 0 || newY >= window.innerHeight) {
            newSpeedY = -newSpeedY;
            newY = Math.max(0, Math.min(window.innerHeight, newY));
          }

          return {
            ...particle,
            x: newX,
            y: newY,
            speedX: newSpeedX,
            speedY: newSpeedY,
          };
        })
      );
    };

    const interval = setInterval(animateParticles, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: -1,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        overflow: 'hidden',
      }}
    >
      {/* 动态渐变背景 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: `
            radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(120, 219, 255, 0.3) 0%, transparent 50%)
          `,
          animation: 'gradientShift 10s ease-in-out infinite',
        }}
      />

      {/* 浮动的粒子 */}
      {particles.map(particle => (
        <div
          key={particle.id}
          style={{
            position: 'absolute',
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            backgroundColor: `rgba(255, 255, 255, ${particle.opacity})`,
            borderRadius: '50%',
            boxShadow: `0 0 ${particle.size * 2}px rgba(255, 255, 255, ${particle.opacity})`,
            transition: 'all 0.05s ease-out',
          }}
        />
      ))}

      {/* 连接线 */}
      {particles.map((particle, i) =>
        particles.slice(i + 1).map((otherParticle, j) => {
          const distance = Math.sqrt(
            Math.pow(particle.x - otherParticle.x, 2) +
            Math.pow(particle.y - otherParticle.y, 2)
          );
          
          if (distance < 150) {
            const opacity = (1 - distance / 150) * 0.2;
            return (
              <div
                key={`line-${i}-${j}`}
                style={{
                  position: 'absolute',
                  left: Math.min(particle.x, otherParticle.x),
                  top: Math.min(particle.y, otherParticle.y),
                  width: distance,
                  height: 1,
                  background: `linear-gradient(90deg, transparent, rgba(255, 255, 255, ${opacity}), transparent)`,
                  transformOrigin: '0 50%',
                  transform: `rotate(${Math.atan2(otherParticle.y - particle.y, otherParticle.x - particle.x)}rad)`,
                }}
              />
            );
          }
          return null;
        })
      )}

      <style jsx>{`
        @keyframes gradientShift {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default DynamicBackground;
