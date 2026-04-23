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
      "flex flex-col items-center justify-center text-center p-12 bg-surface rounded-2xl border border-dashed border-border-base/50",
      isError && "border-destructive/20 bg-destructive/5",
      className
    )}>
      {Icon && (
        <div className={cn(
          "p-4 rounded-full mb-4",
          isError ? "bg-destructive/10 text-destructive" : "bg-primary/5 text-primary"
        )}>
          <Icon size={32} strokeWidth={1.5} />
        </div>
      )}
      <h3 className={cn(
        "text-sm font-black uppercase tracking-widest mb-2",
        isError ? "text-destructive" : "text-text-main"
      )}>{title}</h3>
      <p className={cn(
        "text-xs max-w-xs mb-6 leading-relaxed",
        isError ? "text-destructive/70" : "text-text-muted"
      )}>
        {description}
      </p>
      {action && (
        <Button 
          onClick={action.onClick} 
          variant={isError ? "secondary" : "primary"} 
          size="md"
          className={isError ? "bg-surface border-destructive/20 text-destructive hover:bg-destructive/5" : ""}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
