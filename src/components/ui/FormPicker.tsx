"use client";

import React from 'react';
import { ChevronDown, Calendar, Clock } from 'lucide-react';

// ==========================================
// Select Component
// ==========================================
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
  labelClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, wrapperClassName = '', labelClassName = '', children, ...props }, ref) => {
    return (
      <div className={`w-full ${wrapperClassName}`}>
        {label && (
          <label className={`block text-xs font-semibold text-gray-500 dark:text-[#b1a7a6] uppercase tracking-wider mb-1.5 ${labelClassName}`}>
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={`appearance-none w-full px-4 py-2.5 pr-10 border border-gray-200 dark:border-[#3d4951] rounded-xl bg-[#FEFCFA] dark:bg-[#0b090a] text-[#3E2723] dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-500/25 focus:border-transparent outline-none transition-all text-sm cursor-pointer font-medium disabled:opacity-50 ${className}`}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40 pointer-events-none" />
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

// ==========================================
// DatePicker Component
// ==========================================
interface DatePickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
  labelClassName?: string;
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  ({ className = '', label, error, wrapperClassName = '', labelClassName = '', ...props }, ref) => {
    return (
      <div className={`w-full ${wrapperClassName}`}>
        {label && (
          <label className={`block text-xs font-semibold text-gray-500 dark:text-[#b1a7a6] uppercase tracking-wider mb-1.5 ${labelClassName}`}>
            {label}
          </label>
        )}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 dark:text-red-400 pointer-events-none" />
          <input
            ref={ref}
            type="date"
            className={`w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-[#3d4951] rounded-xl bg-[#FEFCFA] dark:bg-[#0b090a] text-[#3E2723] dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-500/25 focus:border-transparent outline-none transition-all text-sm cursor-pointer font-medium disabled:opacity-50 ${className}`}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
DatePicker.displayName = 'DatePicker';

// ==========================================
// TimePicker Component
// ==========================================
interface TimePickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
  labelClassName?: string;
}

export const TimePicker = React.forwardRef<HTMLInputElement, TimePickerProps>(
  ({ className = '', label, error, wrapperClassName = '', labelClassName = '', ...props }, ref) => {
    return (
      <div className={`w-full ${wrapperClassName}`}>
        {label && (
          <label className={`block text-xs font-semibold text-gray-500 dark:text-[#b1a7a6] uppercase tracking-wider mb-1.5 ${labelClassName}`}>
            {label}
          </label>
        )}
        <div className="relative">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 dark:text-red-400 pointer-events-none" />
          <input
            ref={ref}
            type="time"
            className={`w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-[#3d4951] rounded-xl bg-[#FEFCFA] dark:bg-[#0b090a] text-[#3E2723] dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-red-500/25 focus:border-transparent outline-none transition-all text-sm cursor-pointer font-medium disabled:opacity-50 ${className}`}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
TimePicker.displayName = 'TimePicker';
