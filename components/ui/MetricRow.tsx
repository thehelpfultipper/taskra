import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricRowProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  compact?: boolean;
  className?: string;
}

export function MetricRow({ label, value, icon: Icon, trend, compact = false, className = '' }: MetricRowProps) {
  return (
    <div className={cn("flex items-center justify-between group gap-2", compact ? "py-2" : "py-2.5", className)}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {Icon && (
          <div className={cn(
            "rounded-md bg-surface-alt flex items-center justify-center text-text-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0",
            compact ? "h-7 w-7" : "h-8 w-8",
          )}>
            <Icon size={compact ? 14 : 16} strokeWidth={1.75} />
          </div>
        )}
        <span className={cn(
          "font-medium text-text-muted group-hover:text-text-main transition-colors whitespace-nowrap",
          compact ? "text-[11px]" : "text-xs leading-tight",
        )}>
          {label}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={cn(
          "font-semibold text-text-main tabular-nums whitespace-nowrap",
          compact ? "text-xs" : "text-sm",
        )}>
          {value}
        </span>
        {trend && !compact && (
          <span className={cn(
            "text-xs font-medium px-1.5 py-0.5 rounded leading-none",
            trend.isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {trend.isPositive ? '+' : '-'}{trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}
