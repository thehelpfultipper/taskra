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
  className?: string;
}

export function MetricRow({ label, value, icon: Icon, trend, className = '' }: MetricRowProps) {
  return (
    <div className={cn("flex items-center justify-between py-2.5 group gap-3", className)}>
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {Icon && (
          <div className="h-8 w-8 rounded-md bg-surface-alt flex items-center justify-center text-text-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
            <Icon size={16} strokeWidth={1.75} />
          </div>
        )}
        <span className="text-xs font-medium text-text-muted group-hover:text-text-main transition-colors leading-tight break-words min-w-0">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold text-text-main tabular-nums">
          {value}
        </span>
        {trend && (
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded leading-none",
            trend.isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {trend.isPositive ? '+' : '-'}{trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}
