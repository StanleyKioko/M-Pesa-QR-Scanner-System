import React from 'react';

const Input = ({ 
  className = '', 
  type = 'text', 
  placeholder = '', 
  value, 
  onChange, 
  disabled = false,
  required = false,
  id,
  name,
  autoComplete,
  onKeyPress,
  ...props 
}) => {
  return (
    <input
      id={id}
      name={name}
      type={type}
      className={`
        w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
        placeholder-gray-400 
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
        disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200
        ${className}
      `}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={required}
      autoComplete={autoComplete}
      onKeyPress={onKeyPress}
      {...props}
    />
  );
};

export default Input;