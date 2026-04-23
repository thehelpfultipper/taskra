import React from 'react';

interface DividerProps {
  className?: string;
}

export function Divider({ className = '' }: DividerProps) {
  return (
    <div className={`h-[1px] w-full bg-border-base/50 my-8 ${className}`} />
  );
}
