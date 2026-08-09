import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';

/**
 * Modal - 模态框组件
 * 
 * @param {boolean} isOpen - 是否打开
 * @param {function} onClose - 关闭回调
 * @param {string} title - 标题
 * @param {node} children - 子元素
 * @param {node} footer - 底部按钮区
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  ...props
}) => {
  if (!isOpen) return null;

  const overlayClasses = 'fixed inset-0 bg-black/50 z-1000 flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-200';
  const modalClasses = 'bg-white border border-gray-200 rounded-lg max-w-lg w-full max-h-screen overflow-y-auto transform translate-y-5 transition-transform duration-200';

  return ReactDOM.createPortal(
    <div className={classNames(overlayClasses, isOpen && 'opacity-100 pointer-events-all')}>
      <div className={classNames(modalClasses, isOpen && 'translate-y-0')} {...props}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="font-serif text-xl font-semibold tracking-wide">{title}</h3>
          <button
            onClick={onClose}
            className="text-2xl text-gray-500 hover:text-gray-900 transition-colors"
          >
            ×
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 text-gray-600 leading-relaxed">
          {children}
        </div>

        {/* 底部 */}
        {footer && (
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
