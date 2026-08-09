import React from 'react';
import classNames from 'classnames';

/**
 * Alert - 警告提示组件
 * 
 * @param {string} variant - 样式变体：success | warning | error | info
 * @param {string} title - 标题
 * @param {node} children - 子元素（描述内容）
 * @param {boolean} closable - 是否可关闭
 * @param {function} onClose - 关闭回调
 */
const Alert = ({
  variant = 'info',
  title,
  children,
  closable = false,
  onClose,
  ...props
}) => {
  const baseClasses = 'p-4 border-l-4 rounded';
  
  const variantClasses = {
    success: 'bg-green-50 border-green-600 text-green-700',
    warning: 'bg-yellow-50 border-yellow-600 text-yellow-700',
    error: 'bg-red-50 border-red-600 text-red-700',
    info: 'bg-blue-50 border-blue-600 text-blue-700',
  };
  
  const iconMap = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️',
  };
  
  const classes = classNames(
    baseClasses,
    variantClasses[variant]
  );
  
  return (
    <div className={classes} {...props}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{iconMap[variant]}</span>
        <div className="flex-1">
          {title && <div className="font-medium mb-1">{title}</div>}
          <div className="text-sm">{children}</div>
        </div>
        {closable && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 transition-colors"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default Alert;
