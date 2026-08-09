import React from 'react';
import classNames from 'classnames';

/**
 * Table - 表格组件
 * 
 * @param {array} columns - 列配置 [{key, title, render?}]
 * @param {array} data - 数据数组
 * @param {boolean} hoverable - 是否可悬停高亮
 * @param {function} onRowClick - 行点击事件
 */
const Table = ({
  columns = [],
  data = [],
  hoverable = true,
  onRowClick,
  ...props
}) => {
  const baseClasses = 'w-full border-collapse text-base';
  const wrapperClasses = 'overflow-x-auto bg-white border border-gray-200 rounded-lg';
  
  return (
    <div className={wrapperClasses}>
      <table className={baseClasses} {...props}>
        {/* 表头 */}
        <thead className="bg-gray-50 border-b-2 border-gray-200">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase tracking-wide"
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>

        {/* 表体 */}
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={classNames(
                'border-b border-gray-200 transition-colors duration-200',
                hoverable && 'hover:bg-gray-50 cursor-pointer'
              )}
              onClick={() => onRowClick && onRowClick(row, rowIndex)}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-4">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
