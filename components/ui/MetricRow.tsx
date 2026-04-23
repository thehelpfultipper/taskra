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
    <div className={cn("flex items-center justify-between py-3.5 group gap-3", className)}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {Icon && (
          <div className="h-9 w-9 rounded-xl bg-surface-alt/50 flex items-center justify-center text-text-muted/40 group-hover:bg-primary/5 group-hover:text-primary transition-all duration-300 shrink-0">
            <Icon size={16} strokeWidth={2} />
          </div>
        )}
        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-text-muted/60 group-hover:text-text-muted transition-colors truncate block">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[13px] font-black text-text-main tabular-nums tracking-tight">
          {value}
        </span>
        {trend && (
          <span className={cn(
            "text-[9px] font-black px-1.5 py-0.5 rounded-lg uppercase tracking-widest",
            trend.isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {trend.isPositive ? '+' : '-'}{trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}
