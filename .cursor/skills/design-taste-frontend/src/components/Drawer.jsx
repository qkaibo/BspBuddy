import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';

/**
 * Drawer - 抽屉组件
 * 
 * @param {boolean} isOpen - 是否打开
 * @param {function} onClose - 关闭回调
 * @param {string} title - 标题
 * @param {node} children - 子元素
 * @param {node} footer - 底部按钮区
 * @param {string} width - 宽度（默认400px）
 */
const Drawer = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width = '400px',
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // 显示动画
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const overlayClasses = classNames(
    'fixed inset-0 bg-black/50 z-1000 transition-opacity duration-300',
    isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
  );

  const drawerClasses = classNames(
    'fixed top-0 right-0 h-screen bg-white border-l border-gray-200 overflow-y-auto transition-transform duration-300 ease-out',
    isVisible ? 'translate-x-0' : 'translate-x-full'
  );

  return ReactDOM.createPortal(
    <div className={overlayClasses} onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div className={drawerClasses} style={{ width }} {...props}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="font-serif text-xl font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-2xl text-gray-500 hover:text-gray-900 transition-colors"
          >
            ×
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 p-6 text-gray-600 leading-relaxed">
          {children}
        </div>

        {/* 底部 */}
        {footer && (
          <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Drawer;
