import React from 'react';
import { LucideIcon, AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  description: string;
  icon?: LucideIcon;
  className?: string;
  onClose?: () => void;
}

export function Alert({ variant = 'info', title, description, icon: Icon, className = '', onClose }: AlertProps) {
  const variants = {
    info: {
      bg: 'bg-primary/5',
      border: 'border-primary/20',
      text: 'text-primary',
      icon: Info,
      iconColor: 'text-primary',
    },
    success: {
      bg: 'bg-success/5',
      border: 'border-success/20',
      text: 'text-success',
      icon: CheckCircle,
      iconColor: 'text-success',
    },
    warning: {
      bg: 'bg-warning/5',
      border: 'border-warning/20',
      text: 'text-warning',
      icon: AlertCircle,
      iconColor: 'text-warning',
    },
    error: {
      bg: 'bg-destructive/5',
      border: 'border-destructive/20',
      text: 'text-destructive',
      icon: XCircle,
      iconColor: 'text-destructive',
    },
  };

  const config = variants[variant];
  const DisplayIcon = Icon || config.icon;

  return (
    <div className={cn(
      "flex items-start gap-4 p-4 rounded-xl border transition-all duration-300",
      config.bg,
      config.border,
      className
    )}>
      <div className={cn("mt-0.5", config.iconColor)}>
        <DisplayIcon size={18} strokeWidth={2} />
      </div>
      <div className="flex-1 space-y-1">
        {title && (
          <h4 className={cn("text-xs font-black uppercase tracking-widest", config.text)}>
            {title}
          </h4>
        )}
        <p className={cn("text-xs font-medium leading-relaxed", config.text)}>
          {description}
        </p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className={cn("p-1 rounded-lg hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50", config.text)}
        >
          <XCircle size={16} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
