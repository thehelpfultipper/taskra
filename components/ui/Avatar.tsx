import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { isPlaceholderAvatar, type EntityKind, type EntityMarkHints } from '@/lib/avatar-utils';
import { EntityMark } from '@/components/ui/EntityMark';

const PICSUM_AVATAR_DIMENSION = 768;

interface AvatarProps extends EntityMarkHints {
  src?: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'none';
  shape?: 'circle' | 'square';
  className?: string;
  imageSizes?: string;
  priority?: boolean;
}

function normalizeAvatarSrc(src?: string): string | undefined {
  if (!src || src === '#') return src;

  try {
    const url = new URL(src);
    if (url.hostname !== 'picsum.photos') return src;

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return src;

    if ((parts[0] === 'seed' || parts[0] === 'id') && parts.length >= 2) {
      url.pathname = `/${parts[0]}/${parts[1]}/${PICSUM_AVATAR_DIMENSION}/${PICSUM_AVATAR_DIMENSION}`;
      return url.toString();
    }

    url.pathname = `/${PICSUM_AVATAR_DIMENSION}/${PICSUM_AVATAR_DIMENSION}`;
    return url.toString();
  } catch {
    return src;
  }
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(({
  src,
  alt,
  size = 'md',
  status = 'none',
  kind = 'agent',
  shape,
  className = '',
  imageSizes,
  priority = false,
  modelFamily,
  modelType,
  specialties,
  isRecruiter,
  isVerified,
  openToWork,
  industry,
  isHiring,
}, ref) => {
  const sizes = {
    xs: 'h-6 w-6 text-[8px]',
    sm: 'h-8 w-8 text-[10px]',
    md: 'h-12 w-12 text-xs',
    lg: 'h-16 w-16 text-sm',
    xl: 'h-24 w-24 text-lg',
  };

  const imageSizeHints = {
    xs: '24px',
    sm: '32px',
    md: '48px',
    lg: '64px',
    xl: '96px',
  };

  const statusColors = {
    online: 'bg-accent',
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

  const resolvedKind: EntityKind = kind ?? 'agent';
  const resolvedShape = shape ?? (resolvedKind === 'org' ? 'square' : 'circle');
  const normalizedSrc = isPlaceholderAvatar(src) ? undefined : normalizeAvatarSrc(src);

  return (
    <div
      ref={ref}
      className={cn(
        'relative flex-shrink-0',
        resolvedShape === 'square' ? 'rounded-lg' : 'rounded-full',
        sizes[size],
        className,
      )}
    >
      <div className={cn('relative h-full w-full rounded-[inherit] overflow-hidden', normalizedSrc && 'bg-surface-alt border border-border-base/50')}>
        {normalizedSrc && normalizedSrc !== '#' ? (
          <Image
            src={normalizedSrc}
            alt={alt}
            fill
            className="object-cover rounded-[inherit]"
            sizes={imageSizes ?? imageSizeHints[size]}
            quality={90}
            priority={priority}
            referrerPolicy="no-referrer"
          />
        ) : (
          <EntityMark
            name={alt}
            kind={resolvedKind}
            size={size}
            modelFamily={modelFamily}
            modelType={modelType}
            specialties={specialties}
            isRecruiter={isRecruiter}
            isVerified={isVerified}
            openToWork={openToWork}
            industry={industry}
            isHiring={isHiring}
          />
        )}
      </div>
      {status !== 'none' && (
        <span className={cn(
          'absolute bottom-0 right-0 rounded-full border-surface',
          statusColors[status],
          statusSizes[size],
        )} />
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';
