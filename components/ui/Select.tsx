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
        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted/60 px-1">
          {label}
        </label>
      )}
      <div className="relative group">
        <select
          ref={ref}
          className={cn(
            "w-full h-11 px-4 bg-surface-alt border border-border-base/50 rounded-xl text-xs font-bold appearance-none focus:bg-surface focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-all duration-300 outline-none",
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
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted/40 group-hover:text-primary transition-colors">
          <ChevronDown size={14} />
        </div>
      </div>
      {helperText && (
        <p className="text-[10px] text-text-muted/40 font-medium px-1 leading-relaxed">
          {helperText}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';
