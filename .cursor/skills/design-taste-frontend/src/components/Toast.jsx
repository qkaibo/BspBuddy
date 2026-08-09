import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

/**
 * Toast - 通知组件
 * 
 * @param {string} variant - 样式变体：success | warning | error | info
 * @param {string} message - 通知消息
 * @param {function} onClose - 关闭回调
 * @param {number} duration - 自动关闭时长（毫秒，默认3000）
 */
const Toast = ({
  variant = 'info',
  message,
  onClose,
  duration = 3000,
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 显示动画
    const showTimer = setTimeout(() => setIsVisible(true), 10);
    // 自动关闭
    const closeTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose && onClose(), 300);
    }, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(closeTimer);
    };
  }, [duration, onClose]);

  const baseClasses = 'flex items-center gap-3 p-4 bg-white border-l-4 rounded shadow-lg transform transition-all duration-300';
  const variantClasses = {
    success: 'border-green-600',
    warning: 'border-yellow-600',
    error: 'border-red-600',
    info: 'border-blue-600',
  };

  const classes = classNames(
    baseClasses,
    variantClasses[variant],
    isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
  );

  const iconMap = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️',
  };

  return (
    <div className={classes} {...props}>
      <span className="text-xl">{iconMap[variant]}</span>
      <span className="flex-1 text-sm">{message}</span>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onClose && onClose(), 300);
        }}
        className="text-gray-500 hover:text-gray-900 transition-colors"
      >
        ×
      </button>
    </div>
  );
};

export default Toast;
