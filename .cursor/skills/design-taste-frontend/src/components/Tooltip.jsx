import React, { useState } from 'react';
import classNames from 'classnames';

/**
 * Tooltip - 工具提示组件
 * 
 * @param {node} children - 子元素（触发元素）
 * @param {string} text - 提示文字
 * @param {string} placement - 位置：top | bottom | left | right
 */
const Tooltip = ({
  children,
  text,
  placement = 'top',
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const tooltipClasses = classNames(
    'absolute z-50 px-3 py-1.5 text-sm text-white bg-gray-900 rounded whitespace-nowrap',
    'transform transition-all duration-200',
    {
      'bottom-full left-1/2 -translate-x-1/2 mb-2': placement === 'top',
      'top-full left-1/2 -translate-x-1/2 mt-2': placement === 'bottom',
      'right-full top-1/2 -translate-y-1/2 mr-2': placement === 'left',
      'left-full top-1/2 -translate-y-1/2 ml-2': placement === 'right',
    },
    isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'
  );

  const arrowClasses = classNames(
    'absolute w-2 h-2 bg-gray-900 transform rotate-45',
    {
      'top-full left-1/2 -translate-x-1/2 -mt-1': placement === 'top',
      'bottom-full left-1/2 -translate-x-1/2 -mb-1': placement === 'bottom',
      'top-1/2 right-full -translate-y-1/2 -mr-1': placement === 'left',
      'top-1/2 left-full -translate-y-1/2 -ml-1': placement === 'right',
    }
  );

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      {...props}
    >
      {children}
      <div className={tooltipClasses}>
        {text}
        <div className={arrowClasses}></div>
      </div>
    </div>
  );
};

export default Tooltip;
