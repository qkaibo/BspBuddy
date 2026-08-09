import React from 'react';
import classNames from 'classnames';

/**
 * Steps - 步骤条组件
 * 
 * @param {array} steps - 步骤项 [{label, completed?}]
 * @param {number} currentStep - 当前步骤索引（0-indexed）
 * @param {function} onStepClick - 步骤点击回调
 */
const Steps = ({
  steps = [],
  currentStep = 0,
  onStepClick,
  ...props
}) => {
  return (
    <div className="flex gap-4 mb-8" {...props}>
      {steps.map((step, index) => (
        <div 
          key={index}
          className={classNames(
            'flex-1 flex flex-col items-center relative',
            index < steps.length - 1 && 'after:content-[""] after:absolute after:top-6 after:left-1/2 after:w-full after:h-0.5 after:bg-gray-200 after:z-0'
          )}
          onClick={() => onStepClick && onStepClick(index)}
        >
          {/* 圆圈 */}
          <div 
            className={classNames(
              'w-12 h-12 rounded-full flex items-center justify-center font-semibold text-base z-10 transition-all duration-200',
              index < currentStep && 'bg-green-600 border-green-600 text-white',
              index === currentStep && 'bg-gray-900 border-gray-900 text-white',
              index > currentStep && 'bg-white border-2 border-gray-300 text-gray-500'
            )}
          >
            {index < currentStep ? '✓' : index + 1}
          </div>

          {/* 标签 */}
          <span 
            className={classNames(
              'mt-2 text-sm text-center',
              index < currentStep && 'text-green-600 font-medium',
              index === currentStep && 'text-gray-900 font-medium',
              index > currentStep && 'text-gray-500'
            )}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
};

export default Steps;
