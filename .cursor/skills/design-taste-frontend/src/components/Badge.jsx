import React from 'react';
import classNames from 'classnames';

/**
 * Badge - 徽章/标签组件
 * 
 * @param {string} variant - 样式变体：success | warning | error | info
 * @param {string} size - 尺寸：sm | md
 * @param {node} children - 子元素
 */
const Badge = ({
  variant = 'info',
  size = 'md',
  children,
  ...props
}) => {
  const baseClasses = 'inline-block font-medium rounded';
  
  const variantClasses = {
    success: 'bg-green-50 text-green-700',
    warning: 'bg-yellow-50 text-yellow-700',
    error: 'bg-red-50 text-red-700',
    info: 'bg-blue-50 text-blue-700',
  };
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };
  
  const classes = classNames(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size]
  );
  
  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
};

export default Badge;
