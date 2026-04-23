import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ 
  variant = 'primary', 
  size = 'md', 
  isLoading = false,
  leftIcon,
  rightIcon,
  children, 
  className = '', 
  disabled,
  ...props 
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2';
  
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm shadow-primary/10 active:bg-primary-hover/90',
    secondary: 'bg-primary/5 text-primary hover:bg-primary/10 active:bg-primary/20',
    ghost: 'text-text-muted hover:bg-surface-alt hover:text-text-main active:bg-surface-alt/80',
    outline: 'border border-border-base text-text-muted hover:bg-surface-alt hover:text-text-main hover:border-border-strong active:bg-surface-alt/80',
    link: 'text-primary hover:underline p-0 h-auto font-bold normal-case tracking-normal',
  };
  
  const sizes = {
    xs: 'px-2.5 py-1 text-[10px] rounded-lg uppercase tracking-wider min-h-[28px]',
    sm: 'px-3.5 py-1.5 text-[10px] rounded-lg uppercase tracking-wider min-h-[32px]',
    md: 'px-5 py-2.5 text-xs rounded-xl uppercase tracking-wider min-h-[40px]',
    lg: 'px-7 py-3.5 text-sm rounded-2xl uppercase tracking-wider min-h-[48px]',
    icon: 'p-2.5 rounded-xl min-w-[40px] min-h-[40px]',
  };

  return (
    <button 
      ref={ref}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      ) : (
        <React.Fragment>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </React.Fragment>
      )}
    </button>
  );
});

Button.displayName = 'Button';
