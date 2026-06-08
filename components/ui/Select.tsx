'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  options: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ label, helperText, options, className = '', ...props }, ref) => {
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="caption-text block px-0.5">
          {label}
        </label>
      )}
      <div className="relative group">
        <select
          ref={ref}
          className={cn(
            "w-full h-11 px-4 bg-surface-alt border border-border-base rounded-xl text-sm font-medium appearance-none text-text-main focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-colors outline-none",
            className
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted group-hover:text-primary transition-colors">
          <ChevronDown size={14} />
        </div>
      </div>
      {helperText && (
        <p className="text-xs text-text-muted px-0.5 leading-relaxed">
          {helperText}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';
