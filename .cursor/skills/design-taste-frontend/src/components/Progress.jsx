import React from 'react';
import classNames from 'classnames';

/**
 * Progress - 进度条组件
 * 
 * @param {number} value - 当前进度（0-100）
 * @param {string} variant - 样式变体：default | success | warning | error
 * @param {string} size - 尺寸：sm | md | lg
 * @param {boolean} showLabel - 是否显示百分比标签
 */
const Progress = ({
  value = 0,
  variant = 'default',
  size = 'md',
  showLabel = true,
  ...props
}) => {
  const baseClasses = 'w-full bg-gray-200 rounded-overflow-hidden';
  
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };
  
  const variantColorMap = {
    default: 'bg-gray-900',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600',
  };
  
  const containerClasses = classNames(
    baseClasses,
    sizeClasses[size]
  );
  
  const barClasses = classNames(
    'h-full rounded transition-all duration-300',
    variantColorMap[variant]
  );
  
  return (
    <div className="flex items-center gap-3" {...props}>
      <div className={containerClasses}>
        <div 
          className={barClasses}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        ></div>
      </div>
      {showLabel && (
        <span className="text-sm text-gray-600 min-w-10 text-right">
          {Math.round(value)}%
        </span>
      )}
    </div>
  );
};

export default Progress;
