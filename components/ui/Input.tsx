import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, error, helperText, className = '', ...props }, ref) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="caption-text block ml-1">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`
          w-full bg-surface border border-border-base rounded-xl px-4 py-3 text-sm
          placeholder:text-text-faint focus:outline-none focus:ring-4 focus:ring-primary/10
          focus:border-primary/40 transition-all duration-200
          ${error ? 'border-destructive focus:ring-destructive/10' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-[10px] font-bold text-destructive ml-1 uppercase tracking-wider">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="text-[10px] text-text-muted font-medium px-1 leading-relaxed">
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
