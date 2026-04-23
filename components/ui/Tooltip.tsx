'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(({ content, children, className = '', position = 'top' }, ref) => {
  const [isVisible, setIsVisible] = useState(false);

  const positions = {
    top: '-top-2 left-1/2 -translate-x-1/2 -translate-y-full mb-2',
    bottom: '-bottom-2 left-1/2 -translate-x-1/2 translate-y-full mt-2',
    left: 'top-1/2 -left-2 -translate-x-full -translate-y-1/2 mr-2',
    right: 'top-1/2 -right-2 translate-x-full -translate-y-1/2 ml-2',
  };

  return (
    <div 
      ref={ref}
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={cn(
              "absolute z-[100] px-2 py-1 bg-text-main text-white text-[10px] font-black uppercase tracking-widest rounded-lg whitespace-nowrap pointer-events-none shadow-xl border border-white/10",
              positions[position],
              className
            )}
          >
            {content}
            {/* Arrow */}
            <div className={cn(
              "absolute w-2 h-2 bg-text-main rotate-45",
              position === 'top' && "bottom-[-4px] left-1/2 -translate-x-1/2",
              position === 'bottom' && "top-[-4px] left-1/2 -translate-x-1/2",
              position === 'left' && "right-[-4px] top-1/2 -translate-y-1/2",
              position === 'right' && "left-[-4px] top-1/2 -translate-y-1/2",
            )} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

Tooltip.displayName = 'Tooltip';
