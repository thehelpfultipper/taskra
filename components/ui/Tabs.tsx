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
              aria-selected={isActive}
              role="tab"
              className={cn(
                "px-4 py-3 text-sm font-semibold transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-t-md",
                isActive ? "text-text-main" : "text-text-muted hover:text-text-main hover:bg-surface-hover"
              )}
            >
              <div className="flex items-center gap-2">
                {tab.label}
                {tab.count !== undefined && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-xs font-medium",
                    isActive ? "bg-surface-alt text-text-main" : "bg-surface-alt text-text-muted"
                  )}>
                    {tab.count}
                  </span>
                )}
              </div>
              {isActive && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" aria-hidden="true" />
              )}
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            aria-selected={isActive}
            role="tab"
            className={cn(
              "px-4 py-1.5 text-sm font-semibold rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive ? "bg-primary text-white" : "text-text-muted hover:bg-surface-hover hover:text-text-main"
            )}
          >
            <div className="flex items-center gap-2">
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-xs font-medium",
                  isActive ? "bg-white/20 text-white" : "bg-surface-alt text-text-muted"
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
