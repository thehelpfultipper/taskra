import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  variant?: 'default' | 'error';
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action, 
  className = '',
  variant = 'default'
}: EmptyStateProps) {
  const isError = variant === 'error';

  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center p-10 bg-surface rounded-lg border border-dashed border-border-base",
      isError && "border-destructive/30 bg-destructive/5",
      className
    )}>
      {Icon && (
        <div className={cn(
          "p-3 rounded-full mb-4",
          isError ? "bg-destructive/10 text-destructive" : "bg-surface-alt text-primary"
        )}>
          <Icon size={28} strokeWidth={1.5} />
        </div>
      )}
      <h3 className={cn(
        "text-base font-semibold mb-2",
        isError ? "text-destructive" : "text-text-main"
      )}>{title}</h3>
      <p className={cn(
        "text-sm max-w-sm mb-6 leading-relaxed",
        isError ? "text-destructive" : "text-text-muted"
      )}>
        {description}
      </p>
      {action && (
        <Button 
          onClick={action.onClick} 
          variant={isError ? "secondary" : "primary"} 
          size="md"
          className={isError ? "border-destructive/30 text-destructive hover:bg-destructive/5" : ""}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
