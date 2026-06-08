'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface CenterScrollRegionProps {
  children: React.ReactNode;
  className?: string;
}

const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

function canScrollInDirection(element: HTMLElement, deltaY: number): boolean {
  if (deltaY > 0) {
    return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  }
  if (deltaY < 0) {
    return element.scrollTop > 0;
  }
  return false;
}

function canPageScrollInDirection(deltaY: number): boolean {
  const maxPageScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxPageScroll <= 0) return false;

  if (deltaY > 0) {
    return window.scrollY < maxPageScroll - 1;
  }
  if (deltaY < 0) {
    return window.scrollY > 0;
  }
  return false;
}

export function CenterScrollRegion({ children, className = '' }: CenterScrollRegionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);

    const handleGlobalWheel = (event: WheelEvent) => {
      if (!mediaQuery.matches) return;

      const container = containerRef.current;
      if (!container || event.deltaY === 0) return;

      const target = event.target;
      if (target instanceof Node && container.contains(target)) {
        return;
      }

      // Let the page scroll naturally first when wheel happens outside the center pane.
      // Only hand off to the center stream once the page can't scroll further.
      if (canPageScrollInDirection(event.deltaY)) {
        return;
      }

      if (!canScrollInDirection(container, event.deltaY)) {
        return;
      }

      event.preventDefault();
      container.scrollTop += event.deltaY;
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: false, capture: true });

    return () => {
      window.removeEventListener('wheel', handleGlobalWheel, { capture: true });
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'min-w-0 space-y-4 md:max-h-[calc(100dvh-var(--header-offset)-1.5rem)] md:overflow-y-auto md:overscroll-contain md:pr-1 custom-scrollbar scroll-smooth',
        className,
      )}
    >
      {children}
    </div>
  );
}
