import React, { useState, useRef, useEffect } from 'react';
import classNames from 'classnames';

/**
 * Dropdown - 下拉菜单组件
 * 
 * @param {node} trigger - 触发元素
 * @param {array} items - 菜单项 [{label, onClick}]
 * @param {string} placement - 位置：bottom-start | bottom-end
 */
const Dropdown = ({
  trigger,
  items = [],
  placement = 'bottom-start',
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const menuClasses = classNames(
    'absolute mt-2 bg-white border border-gray-200 rounded-lg shadow-lg min-w-48 overflow-hidden',
    'transform transition-all duration-200 origin-top-left',
    isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none',
    placement === 'bottom-end' ? 'right-0' : 'left-0'
  );

  return (
    <div className="relative inline-block" ref={dropdownRef} {...props}>
      {/* 触发元素 */}
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>

      {/* 下拉菜单 */}
      <div className={menuClasses}>
        {items.map((item, index) => (
          <button
            key={index}
            onClick={(e) => {
              item.onClick && item.onClick(e);
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Dropdown;
