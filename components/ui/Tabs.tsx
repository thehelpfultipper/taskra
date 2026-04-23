import React from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: 'underline' | 'pills';
}

export function Tabs({ tabs, activeTab, onChange, className = '', variant = 'underline' }: TabsProps) {
  return (
    <div className={cn(
      "flex items-center gap-1",
      variant === 'underline' && "border-b border-border-base w-full",
      className
    )}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        
        if (variant === 'underline') {
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all relative focus-visible:outline-none focus-visible:bg-surface-alt",
                isActive ? "text-primary" : "text-text-muted hover:text-text-main"
              )}
            >
              <div className="flex items-center gap-2">
                {tab.label}
                {tab.count !== undefined && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-lg text-[10px]",
                    isActive ? "bg-primary/10 text-primary" : "bg-surface-alt text-text-muted"
                  )}>
                    {tab.count}
                  </span>
                )}
              </div>
              {isActive && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isActive ? "bg-primary text-white" : "bg-surface-alt text-text-muted hover:bg-border-base/50"
            )}
          >
            <div className="flex items-center gap-2">
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-lg text-[10px]",
                  isActive ? "bg-white/20 text-white" : "bg-border-base/50 text-text-muted"
                )}>
                  {tab.count}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
