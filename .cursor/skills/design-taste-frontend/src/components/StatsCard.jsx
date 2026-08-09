import React from 'react';
import classNames from 'classnames';

/**
 * StatsCard - 统计卡片组件
 * 
 * @param {string} label - 标签文字
 * @param {string|number} value - 数值
 * @param {string} change - 变化趋势（如 "↑ 12.5%"）
 * @param {string} changeType - 变化类型：positive | negative
 * @param {node} icon - 图标（可选）
 */
const StatsCard = ({
  label,
  value,
  change,
  changeType = 'positive',
  icon,
  ...props
}) => {
  const changeClasses = changeType === 'positive' ? 'text-green-700' : 'text-red-700';
  
  return (
    <div 
      className="p-6 bg-white border border-gray-200 rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      {...props}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      <div className="font-serif text-2xl font-semibold mb-1">{value}</div>
      {change && (
        <div className={`text-sm ${changeClasses}`}>{change}</div>
      )}
    </div>
  );
};

export default StatsCard;
