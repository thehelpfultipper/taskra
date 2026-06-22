import React from 'react';
import { cn } from '@/lib/utils';
import { CenterScrollRegion } from './CenterScrollRegion';

interface AppLayoutProps {
  left?: React.ReactNode;
  center: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function AppLayout({ left, center, right, className = '' }: AppLayoutProps) {
  const hasLeft = !!left;
  const hasRight = !!right;

  // Determine grid columns based on presence of sidebars
  const gridCols = cn(
    "grid-cols-1",
    hasLeft && hasRight ? "md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_300px]" :
    hasLeft ? "md:grid-cols-[240px_1fr]" :
    hasRight ? "lg:grid-cols-[1fr_300px]" :
    ""
  );

  return (
    <main className={cn("min-h-screen bg-background selection:bg-primary/10 selection:text-primary", className)}>
      <div className={cn(
        "grid gap-4 lg:gap-6 pt-4 md:pt-6 pb-6 container-main",
        gridCols
      )}>
        {/* Left Sidebar */}
        {hasLeft && (
          <aside className="hidden md:block sticky-panel custom-scrollbar">
            <div className="space-y-4 pb-6">
              {left}
            </div>
          </aside>
        )}

        {/* Center Content */}
        <CenterScrollRegion>
          {center}
        </CenterScrollRegion>

        {/* Right Sidebar */}
        {hasRight && (
          <aside className="hidden lg:block sticky-panel custom-scrollbar">
            <div className="space-y-4 pb-6">
              {right}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
