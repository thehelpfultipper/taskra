'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
  position?: TooltipPosition;
}

const VIEWPORT_PADDING = 8;
const TOOLTIP_GAP = 8;

function isDisabledElement(child: React.ReactNode): boolean {
  return React.isValidElement(child) && Boolean((child.props as { disabled?: boolean }).disabled);
}

function resolvePosition(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  preferred: TooltipPosition,
): { top: number; left: number; resolved: TooltipPosition } {
  const placements: TooltipPosition[] = [preferred, 'bottom', 'top', 'right', 'left'].filter(
    (value, index, array) => array.indexOf(value) === index,
  ) as TooltipPosition[];

  const fits = (resolved: TooltipPosition) => {
    const coords = getCoords(triggerRect, tooltipRect, resolved);
    return (
      coords.top >= VIEWPORT_PADDING &&
      coords.left >= VIEWPORT_PADDING &&
      coords.top + tooltipRect.height <= window.innerHeight - VIEWPORT_PADDING &&
      coords.left + tooltipRect.width <= window.innerWidth - VIEWPORT_PADDING
    );
  };

  const resolved = placements.find(fits) ?? preferred;
  const coords = getCoords(triggerRect, tooltipRect, resolved);
  const clampedTop = Math.min(
    Math.max(coords.top, VIEWPORT_PADDING),
    window.innerHeight - tooltipRect.height - VIEWPORT_PADDING,
  );
  const clampedLeft = Math.min(
    Math.max(coords.left, VIEWPORT_PADDING),
    window.innerWidth - tooltipRect.width - VIEWPORT_PADDING,
  );

  return { top: clampedTop, left: clampedLeft, resolved };
}

function getCoords(triggerRect: DOMRect, tooltipRect: DOMRect, position: TooltipPosition) {
  switch (position) {
    case 'bottom':
      return {
        top: triggerRect.bottom + TOOLTIP_GAP,
        left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
      };
    case 'left':
      return {
        top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
        left: triggerRect.left - tooltipRect.width - TOOLTIP_GAP,
      };
    case 'right':
      return {
        top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
        left: triggerRect.right + TOOLTIP_GAP,
      };
    case 'top':
    default:
      return {
        top: triggerRect.top - tooltipRect.height - TOOLTIP_GAP,
        left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
      };
  }
}

function arrowClass(position: TooltipPosition) {
  return cn(
    'absolute w-2 h-2 bg-ink rotate-45',
    position === 'top' && 'bottom-[-4px] left-1/2 -translate-x-1/2',
    position === 'bottom' && 'top-[-4px] left-1/2 -translate-x-1/2',
    position === 'left' && 'right-[-4px] top-1/2 -translate-y-1/2',
    position === 'right' && 'left-[-4px] top-1/2 -translate-y-1/2',
  );
}

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  ({ content, children, className = '', position = 'top' }, ref) => {
    const [isVisible, setIsVisible] = useState(false);
    const [resolvedPosition, setResolvedPosition] = useState<TooltipPosition>(position);
    const triggerRef = useRef<HTMLDivElement | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);

    const updatePosition = useCallback(() => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) return;

      const next = resolvePosition(
        trigger.getBoundingClientRect(),
        tooltip.getBoundingClientRect(),
        position,
      );
      tooltip.style.top = `${next.top}px`;
      tooltip.style.left = `${next.left}px`;
      setResolvedPosition((current) => (current === next.resolved ? current : next.resolved));
    }, [position]);

    useLayoutEffect(() => {
      if (!isVisible) return;
      updatePosition();
    }, [isVisible, content, updatePosition]);

    useEffect(() => {
      if (!isVisible) return;

      const handleReposition = () => updatePosition();
      window.addEventListener('scroll', handleReposition, true);
      window.addEventListener('resize', handleReposition);

      return () => {
        window.removeEventListener('scroll', handleReposition, true);
        window.removeEventListener('resize', handleReposition);
      };
    }, [isVisible, updatePosition]);

    const setTriggerRef = (node: HTMLDivElement | null) => {
      triggerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    const wrappedChild = isDisabledElement(children) ? (
      <span className="inline-flex">{children}</span>
    ) : (
      children
    );

    const tooltipNode = (
      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={tooltipRef}
            role="tooltip"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-[200] px-2.5 py-1.5 bg-ink text-white text-xs font-medium rounded shadow-lg whitespace-nowrap pointer-events-none"
          >
            {content}
            <div className={arrowClass(resolvedPosition)} aria-hidden="true" />
          </motion.div>
        )}
      </AnimatePresence>
    );

    return (
      <>
        <div
          ref={setTriggerRef}
          className={cn('relative inline-flex', className)}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
          onFocus={() => setIsVisible(true)}
          onBlur={() => setIsVisible(false)}
        >
          {wrappedChild}
        </div>
        {typeof document !== 'undefined' ? createPortal(tooltipNode, document.body) : null}
      </>
    );
  },
);

Tooltip.displayName = 'Tooltip';
