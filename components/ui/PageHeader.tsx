import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ icon: Icon, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6', className)}>
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase">{title}</h1>
        </div>
        <p className="text-text-muted font-bold text-sm ml-[3.25rem]">{description}</p>
      </div>
      {actions ? <div className="flex items-center gap-3 shrink-0">{actions}</div> : null}
    </div>
  );
}
