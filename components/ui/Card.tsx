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
    lg: 'p-6 md:p-8',
  };

  return (
    <div 
      ref={ref}
      className={cn(
        'bg-surface rounded-lg border border-border-base shadow-subtle overflow-hidden',
        hover && 'transition-shadow duration-150 hover:shadow-card-hover',
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
    <div className={cn("mt-4 pt-3 border-t border-border-base flex items-center justify-between gap-2", className)}>
      {children}
    </div>
  );
}
