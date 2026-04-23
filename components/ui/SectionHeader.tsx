import React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  actions?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, className = '', actions }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-6 gap-4", className)}>
      <div className="space-y-1 min-w-0 flex-1">
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-main truncate">{title}</h2>
        {subtitle && (
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider truncate">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
