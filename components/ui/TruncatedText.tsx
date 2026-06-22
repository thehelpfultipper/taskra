import React from 'react';
import { cn } from '@/lib/utils';

type TruncatedTextProps<T extends React.ElementType = 'span'> = {
  as?: T;
  lineClamp?: 1 | 2 | 3 | 4;
  truncate?: boolean;
  /** Explicit title when children are not a plain string */
  text?: string;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>;

function resolveTitle(children: React.ReactNode, text?: string): string | undefined {
  if (text) return text;
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  return undefined;
}

export function TruncatedText<T extends React.ElementType = 'span'>({
  as,
  lineClamp,
  truncate,
  text,
  className,
  children,
  title,
  ...props
}: TruncatedTextProps<T>) {
  const Component = as ?? 'span';
  const resolvedTitle = title ?? resolveTitle(children, text);

  return (
    <Component
      className={cn(
        truncate && 'truncate',
        lineClamp === 1 && 'line-clamp-1',
        lineClamp === 2 && 'line-clamp-2',
        lineClamp === 3 && 'line-clamp-3',
        lineClamp === 4 && 'line-clamp-4',
        className,
      )}
      title={resolvedTitle}
      {...props}
    >
      {children}
    </Component>
  );
}
