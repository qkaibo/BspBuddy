import React from 'react';
import classNames from 'classnames';

/**
 * Timeline - 时间轴组件
 * 
 * @param {array} items - 时间轴项 [{date, title, content, completed?}]
 * @param {string} position - 位置：left | right | alternating
 */
const Timeline = ({
  items = [],
  position = 'left',
  ...props
}) => {
  return (
    <div className="relative pl-8" {...props}>
      {/* 时间线 */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200"></div>

      {items.map((item, index) => (
        <div key={index} className="relative mb-8 last:mb-0">
          {/* 圆点 */}
          <div 
            className={classNames(
              'absolute left-0 top-2 w-3 h-3 rounded-full transform -translate-x-1/2 border-2',
              item.completed 
                ? 'bg-green-600 border-green-600' 
                : 'bg-white border-gray-900'
            )}
          ></div>

          {/* 日期 */}
          <div className="text-sm text-gray-500 mb-2">{item.date}</div>

          {/* 标题 */}
          <h3 className="font-sans text-lg font-semibold mb-2">{item.title}</h3>

          {/* 内容 */}
          <p className="text-gray-600 leading-relaxed">{item.content}</p>
        </div>
      ))}
    </div>
  );
};

export default Timeline;
