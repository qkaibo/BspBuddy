import React from 'react';
import classNames from 'classnames';

/**
 * Input - 输入框组件
 * 
 * @param {string} type - 输入框类型：text | email | password | number
 * @param {string} label - 标签文字
 * @param {string} placeholder - 占位文字
 * @param {string} error - 错误信息
 * @param {boolean} disabled - 是否禁用
 * @param {function} onChange - 变化事件
 */
const Input = ({
  type = 'text',
  label,
  placeholder,
  error,
  disabled = false,
  onChange,
  ...props
}) => {
  const baseClasses = 'w-full px-4 py-3 text-base font-family: "Noto Sans SC", sans-serif; border border-gray-300 rounded focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/10 transition-colors duration-200';
  const errorClasses = error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : '';
  const disabledClasses = disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white';
  
  const classes = classNames(
    baseClasses,
    errorClasses,
    disabledClasses
  );
  
  return (
    <div className="mb-4">
      {label && (
        <label className="block mb-2 text-sm font-medium text-gray-600">
          {label}
        </label>
      )}
      <input
        type={type}
        className={classes}
        placeholder={placeholder}
        disabled={disabled}
        onChange={onChange}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default Input;
