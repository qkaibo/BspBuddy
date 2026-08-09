import React, { useState } from 'react';
import classNames from 'classnames';

/**
 * Pagination - 分页组件
 * 
 * @param {number} totalPages - 总页数
 * @param {number} currentPage - 当前页
 * @param {function} onPageChange - 页码变化回调
 */
const Pagination = ({
  totalPages = 1,
  currentPage = 1,
  onPageChange,
  ...props
}) => {
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  const baseClasses = 'min-w-9 h-9 flex items-center justify-center text-sm font-sans transition-all duration-200 border border-gray-300 rounded';
  const activeClasses = 'bg-gray-900 text-white border-gray-900';
  const inactiveClasses = 'bg-white text-gray-900 hover:bg-gray-50 hover:border-gray-900';
  const disabledClasses = 'opacity-50 cursor-not-allowed';

  return (
    <div className="flex items-center gap-2" {...props}>
      {/* 上一页 */}
      <button
        className={classNames(baseClasses, currentPage === 1 ? disabledClasses : inactiveClasses)}
        disabled={currentPage === 1}
        onClick={() => onPageChange && onPageChange(currentPage - 1)}
      >
        ‹
      </button>

      {/* 页码 */}
      {getPageNumbers().map((page, index) => (
        page === '...' ? (
          <span key={`ellipsis-${index}`} className="px-2 text-gray-500">...</span>
        ) : (
          <button
            key={page}
            className={classNames(
              baseClasses,
              page === currentPage ? activeClasses : inactiveClasses
            )}
            onClick={() => onPageChange && onPageChange(page)}
          >
            {page}
          </button>
        )
      ))}

      {/* 下一页 */}
      <button
        className={classNames(baseClasses, currentPage === totalPages ? disabledClasses : inactiveClasses)}
        disabled={currentPage === totalPages}
        onClick={() => onPageChange && onPageChange(currentPage + 1)}
      >
        ›
      </button>
    </div>
  );
};

export default Pagination;
