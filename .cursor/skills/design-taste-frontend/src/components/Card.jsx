import React from 'react';
import classNames from 'classnames';

/**
 * Card - 卡片组件
 * 
 * @param {string} padding - 内边距：none | sm | md | lg
 * @param {boolean} hoverable - 是否可悬停（悬停效果）
 * @param {function} onClick - 点击事件（如果可点击）
 * @param {node} children - 子元素
 */
const Card = ({
  padding = 'md',
  hoverable = false,
  onClick,
  children,
  ...props
}) => {
  const baseClasses = 'bg-white border border-gray-200 rounded-lg';
  
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };
  
  const hoverClasses = hoverable 
    ? 'cursor-pointer transition-all duration-200 hover:transform hover:-translate-y-0.5 hover:shadow-lg hover:border-transparent' 
    : '';
  
  const classes = classNames(
    baseClasses,
    paddingClasses[padding],
    hoverClasses
  );
  
  const Component = onClick ? 'div' : 'div';
  const componentProps = onClick ? { onClick } : {};
  
  return (
    <Component className={classes} {...componentProps} {...props}>
      {children}
    </Component>
  );
};

export default Card;
