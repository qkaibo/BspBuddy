import React from 'react';
import classNames from 'classnames';

/**
 * Spinner - 加载动画组件
 * 
 * @param {string} size - 尺寸：sm | md | lg
 * @param {string} variant - 样式变体：default | primary
 * @param {string} className - 自定义类名
 */
const Spinner = ({
  size = 'md',
  variant = 'default',
  className,
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };
  
  const variantClasses = {
    default: 'border-gray-300 border-t-gray-900',
    primary: 'border-gray-300 border-t-teal-600',
  };
  
  const classes = classNames(
    'inline-block rounded-full animate-spin',
    sizeClasses[size],
    variantClasses[variant],
    className
  );
  
  return (
    <div className="flex items-center justify-center p-4">
      <div className={classes} {...props}></div>
    </div>
  );
};

export default Spinner;
