import React from 'react';
import classNames from 'classnames';

/**
 * Breadcrumb - 面包屑组件
 * 
 * @param {array} items - 面包屑项 [{label, href?}]
 * @param {string} separator - 分隔符（默认 /）
 */
const Breadcrumb = ({
  items = [],
  separator = '/',
  ...props
}) => {
  return (
    <nav className="flex items-center gap-2 text-sm" {...props}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="text-gray-300">{separator}</span>
          )}
          {item.href ? (
            <a
              href={item.href}
              className="text-gray-500 hover:text-gray-900 transition-colors duration-200"
            >
              {item.label}
            </a>
          ) : (
            <span className="text-gray-900 font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;
