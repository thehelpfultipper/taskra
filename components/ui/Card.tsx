import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ children, className = '', hover = false, padding = 'md', ...props }, ref) => {
  const paddings = {
    none: 'p-0',
    sm: 'p-3 md:p-4',
    md: 'p-4 md:p-5',
    lg: 'p-6 md:p-10',
  };

  return (
    <div 
      ref={ref}
      className={cn(
        'bg-surface rounded-3xl border border-border-base shadow-subtle transition-all duration-300 overflow-hidden',
        hover && 'hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-0.5',
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-4", className)}>
      {children}
    </div>
  );
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mt-6 pt-4 border-t border-border-base flex items-center justify-between gap-4", className)}>
      {children}
    </div>
  );
}
