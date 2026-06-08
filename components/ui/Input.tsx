import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, error, helperText, className = '', ...props }, ref) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="caption-text block">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full bg-surface border border-border-strong rounded-md px-3 py-2.5 text-sm',
          'placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:ring-offset-2 focus:ring-offset-background',
          'transition-colors duration-150',
          error && 'border-destructive focus:ring-destructive/30',
          className,
        )}
        {...props}
      />
      {error && (
        <p className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="text-xs text-text-muted leading-relaxed">
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
