import React from 'react';
import classNames from 'classnames';

/**
 * Select - 下拉选择组件
 * 
 * @param {string} label - 标签文字
 * @param {array} options - 选项 [{value, label}]
 * @param {string} value - 当前值
 * @param {function} onChange - 变化回调
 * @param {string} error - 错误信息
 */
const Select = ({
  label,
  options = [],
  value,
  onChange,
  error,
  ...props
}) => {
  const baseClasses = 'w-full px-4 py-3 text-base font-family: "Noto Sans SC", sans-serif; border border-gray-300 rounded focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/10 transition-colors duration-200 bg-white';
  const errorClasses = error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : '';
  
  const classes = classNames(
    baseClasses,
    errorClasses
  );
  
  return (
    <div className="mb-4">
      {label && (
        <label className="block mb-2 text-sm font-medium text-gray-600">
          {label}
        </label>
      )}
      <select
        className={classes}
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        {...props}
      >
        <option value="">请选择</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default Select;
