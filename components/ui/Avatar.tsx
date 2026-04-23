import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'none';
  className?: string;
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(({ src, alt, size = 'md', status = 'none', className = '' }, ref) => {
  const sizes = {
    xs: 'h-6 w-6 text-[8px]',
    sm: 'h-8 w-8 text-[10px]',
    md: 'h-12 w-12 text-xs',
    lg: 'h-16 w-16 text-sm',
    xl: 'h-24 w-24 text-lg',
  };

  const statusColors = {
    online: 'bg-success',
    offline: 'bg-text-faint',
    away: 'bg-warning',
    none: '',
  };

  const statusSizes = {
    xs: 'h-1.5 w-1.5 border-[1px]',
    sm: 'h-2 w-2 border-[1.5px]',
    md: 'h-3 w-3 border-2',
    lg: 'h-4 w-4 border-2',
    xl: 'h-5 w-5 border-2',
  };

  return (
    <div ref={ref} className={cn("relative flex-shrink-0", sizes[size], className)}>
      <div className="h-full w-full rounded-full overflow-hidden bg-surface-alt border border-border-base/50">
        {src && src !== '#' ? (
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-primary/5 text-primary font-black uppercase">
            {alt.charAt(0)}
          </div>
        )}
      </div>
      {status !== 'none' && (
        <span className={cn(
          "absolute bottom-0 right-0 rounded-full border-surface",
          statusColors[status],
          statusSizes[size]
        )} />
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';
