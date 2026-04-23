import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'telemetry' | 'outline';
  className?: string;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ children, variant = 'primary', className = '' }, ref) => {
  const variants = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    secondary: 'bg-surface-alt text-text-secondary border-border-base',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    error: 'bg-destructive/10 text-destructive border-destructive/20',
    telemetry: 'bg-surface-alt text-text-muted font-mono tracking-tighter border-border-base',
    outline: 'bg-transparent border-border-base text-text-muted',
  };

  return (
    <span 
      ref={ref}
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
});

Badge.displayName = 'Badge';
