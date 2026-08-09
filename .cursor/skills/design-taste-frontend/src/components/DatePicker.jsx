import React, { useState, useRef, useEffect } from 'react';
import classNames from 'classnames';

/**
 * DatePicker - 日期选择器组件
 * 
 * @param {string} label - 标签文字
 * @param {string} placeholder - 占位文字
 * @param {function} onChange - 日期变化回调
 * @param {string} error - 错误信息
 */
const DatePicker = ({
  label,
  placeholder = '选择日期',
  onChange,
  error,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const calendarRef = useRef(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleDateSelect = (day) => {
    const date = new Date(currentYear, currentMonth, day);
    setSelectedDate(date);
    setIsOpen(false);
    if (onChange) {
      onChange(date);
    }
  };

  const renderCalendar = () => {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    const calendarDays = [];
    
    // 空白填充
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="p-2"></div>);
    }
    
    // 日期
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = 
        day === new Date().getDate() &&
        currentMonth === new Date().getMonth() &&
        currentYear === new Date().getFullYear();
      
      calendarDays.push(
        <div
          key={day}
          onClick={() => handleDateSelect(day)}
          className={classNames(
            'p-2 text-center cursor-pointer rounded transition-colors duration-200',
            isToday 
              ? 'bg-gray-900 text-white font-semibold' 
              : 'hover:bg-gray-100'
          )}
        >
          {day}
        </div>
      );
    }
    
    return calendarDays;
  };

  const formatDate = (date) => {
    if (!date) return '';
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const inputClasses = classNames(
    'w-full px-4 py-3 text-base font-sans border border-gray-300 rounded focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/10 transition-colors duration-200 cursor-pointer',
    error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : '',
    'bg-white'
  );

  return (
    <div className="relative mb-4" ref={calendarRef}>
      {label && (
        <label className="block mb-2 text-sm font-medium text-gray-600">
          {label}
        </label>
      )}
      
      <input
        type="text"
        className={inputClasses}
        placeholder={placeholder}
        value={selectedDate ? formatDate(selectedDate) : ''}
        onClick={() => setIsOpen(!isOpen)}
        readOnly
        {...props}
      />
      
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                if (currentMonth === 0) {
                  setCurrentMonth(11);
                  setCurrentYear(currentYear - 1);
                } else {
                  setCurrentMonth(currentMonth - 1);
                }
              }}
              className="p-2 hover:bg-gray-100 rounded transition-colors duration-200"
            >
              ‹
            </button>
            <span className="font-medium">
              {currentYear}年{currentMonth + 1}月
            </span>
            <button
              onClick={() => {
                if (currentMonth === 11) {
                  setCurrentMonth(0);
                  setCurrentYear(currentYear + 1);
                } else {
                  setCurrentMonth(currentMonth + 1);
                }
              }}
              className="p-2 hover:bg-gray-100 rounded transition-colors duration-200"
            >
              ›
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {['日', '一', '二', '三', '四', '五', '六'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
            {renderCalendar()}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
