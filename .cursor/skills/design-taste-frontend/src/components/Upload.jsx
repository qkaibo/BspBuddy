import React, { useState, useRef } from 'react';
import classNames from 'classnames';

/**
 * Upload - 上传组件
 * 
 * @param {function} onUpload - 上传回调 (file) => {}
 * @param {string} accept - 接受的文件类型（如 ".jpg,.png,.pdf"）
 * @param {number} maxSize - 最大文件大小（MB）
 * @param {boolean} multiple - 是否允许多文件
 * @param {string} tip - 提示文字
 */
const Upload = ({
  onUpload,
  accept,
  maxSize = 10,
  multiple = false,
  tip = '支持 jpg、png、pdf 格式，单个文件不超过10MB',
  ...props
}) => {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = (fileList) => {
    const newFiles = Array.from(fileList).map(file => ({
      file,
      id: Date.now() + Math.random(),
      progress: 0,
      status: 'uploading', // uploading | success | error
    }));

    setFiles(prev => [...prev, ...newFiles]);

    // 模拟上传进度
    newFiles.forEach((item) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        if (progress >= 100) {
          clearInterval(interval);
          setFiles(prev => 
            prev.map(f => f.id === item.id ? { ...f, progress: 100, status: 'success' } : f)
          );
          if (onUpload) onUpload(item.file);
        } else {
          setFiles(prev => 
            prev.map(f => f.id === item.id ? { ...f, progress } : f)
          );
        }
      }, 200);
    });
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = ''; // 重置 input
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const dropzoneClasses = classNames(
    'p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all duration-200',
    isDragging 
      ? 'border-teal-600 bg-teal-50' 
      : 'border-gray-300 hover:border-teal-600 hover:bg-gray-50'
  );

  return (
    <div {...props}>
      {/* 拖拽区 */}
      <div
        className={dropzoneClasses}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-4xl mb-4">📁</div>
        <div className="text-base text-gray-600 mb-2">点击或拖拽文件到此处</div>
        <div className="text-sm text-gray-400">{tip}</div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded">
              <div className="text-xl">📄</div>
              <div className="flex-1">
                <div className="text-sm font-medium mb-1">{item.file.name}</div>
                <div className="text-xs text-gray-500">
                  {(item.file.size / 1024 / 1024).toFixed(2)} MB
                </div>
                {item.status === 'uploading' && (
                  <div className="mt-1 h-1 bg-gray-100 rounded overflow-hidden">
                    <div 
                      className="h-full bg-teal-600 transition-all duration-200"
                      style={{ width: `${item.progress}%` }}
                    ></div>
                  </div>
                )}
              </div>
              <button
                onClick={() => removeFile(item.id)}
                className="text-gray-400 hover:text-gray-900 transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Upload;
