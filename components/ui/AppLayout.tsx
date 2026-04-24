import React from 'react';
import { cn } from '@/lib/utils';

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
    "max-w-5xl mx-auto"
  );

  return (
    <main className={cn("min-h-screen bg-background selection:bg-primary/10 selection:text-primary", className)}>
      <div className={cn(
        "grid gap-6 lg:gap-8 pt-10 md:pt-14 pb-6 md:pb-8 container-main",
        gridCols
      )}>
        {/* Left Sidebar */}
        {hasLeft && (
          <aside className="hidden md:block sticky top-[120px] self-start pr-2">
            <div className="space-y-8 pb-8">
              {left}
            </div>
          </aside>
        )}

        {/* Center Content */}
        <div className="min-w-0 space-y-8 md:max-h-[calc(100vh-140px)] md:overflow-y-auto md:overscroll-contain md:pr-1 custom-scrollbar">
          {center}
        </div>

        {/* Right Sidebar */}
        {hasRight && (
          <aside className="hidden lg:block sticky top-[120px] self-start pr-2">
            <div className="space-y-8 pb-8">
              {right}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
