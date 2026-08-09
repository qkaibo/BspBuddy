import React from 'react';
import classNames from 'classnames';

/**
 * Button - 按钮组件
 * 
 * @param {string} variant - 样式变体：primary | secondary | danger | ghost
 * @param {string} size - 尺寸：sm | md | lg
 * @param {boolean} disabled - 是否禁用
 * @param {function} onClick - 点击事件
 * @param {node} children - 子元素
 */
const Button = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  children,
  ...props
}) => {
  const baseClasses = 'font-medium border-radius: 4px; transition-all duration-200 cursor-pointer font-family: "Noto Sans SC", sans-serif;';
  
  const variantClasses = {
    primary: 'bg-gray-900 text-white hover:bg-gray-700 active:transform translateY(0)',
    secondary: 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 active:border-gray-900',
    danger: 'bg-red-600 text-white hover:bg-red-800',
    ghost: 'bg-transparent text-gray-900 hover:bg-gray-50',
  };
  
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };
  
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';
  
  const classes = classNames(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    disabledClasses
  );
  
  return (
    <button
      className={classes}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
