import React, { useState } from 'react';
import classNames from 'classnames';

/**
 * Tabs - 标签页组件
 * 
 * @param {array} tabs - 标签页配置 [{label, content}]
 * @param {number} defaultIndex - 默认激活的标签索引
 * @param {function} onTabChange - 标签切换回调
 */
const Tabs = ({
  tabs = [],
  defaultIndex = 0,
  onTabChange,
  ...props
}) => {
  const [activeIndex, setActiveIndex] = useState(defaultIndex);

  const handleTabClick = (index) => {
    setActiveIndex(index);
    if (onTabChange) {
      onTabChange(index);
    }
  };

  return (
    <div {...props}>
      {/* 标签列表 */}
      <div className="flex border-b-2 border-gray-200 mb-4">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => handleTabClick(index)}
            className={classNames(
              'px-4 py-3 text-base font-sans transition-colors duration-200',
              'border-b-2 border-transparent -mb-0.5',
              index === activeIndex
                ? 'text-gray-900 border-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-900'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        {tabs[activeIndex]?.content}
      </div>
    </div>
  );
};

export default Tabs;
