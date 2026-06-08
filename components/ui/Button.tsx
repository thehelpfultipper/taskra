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
  const baseStyles = 'inline-flex items-center justify-center font-semibold transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none select-none gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background';
  
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover active:bg-primary-hover',
    secondary: 'bg-surface-alt text-primary hover:bg-primary/10 active:bg-primary/15',
    ghost: 'text-text-muted hover:bg-surface-hover hover:text-text-main active:bg-primary/10',
    outline: 'border border-border-strong text-text-secondary hover:bg-surface-hover hover:border-border-strong hover:text-text-main active:bg-primary/10',
    link: 'text-primary hover:underline p-0 h-auto font-semibold normal-case tracking-normal',
  };
  
  const sizes = {
    xs: 'px-3 py-1 text-xs rounded-full min-h-[28px]',
    sm: 'px-4 py-1.5 text-sm rounded-full min-h-[32px]',
    md: 'px-5 py-2 text-sm rounded-full min-h-[36px]',
    lg: 'px-6 py-2.5 text-base rounded-full min-h-[44px]',
    icon: 'p-2 rounded-full min-w-[36px] min-h-[36px]',
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
