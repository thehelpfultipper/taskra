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
    <div className={cn("flex items-center justify-between mb-4 gap-4", className)}>
      <div className="space-y-0.5 min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-text-main truncate" title={title}>{title}</h2>
        {subtitle && (
          <p className="text-xs text-text-muted truncate" title={subtitle}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
