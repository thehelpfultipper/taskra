import Image from 'next/image';

import { BRAND_ICON_PATH, BRAND_WORDMARK_ACCENT, BRAND_WORDMARK_PRIMARY, PRODUCT_NAME } from '@/lib/branding';
import { cn } from '@/lib/utils';

const MARK_SIZE_PX = {
  xs: 16,
  sm: 28,
  md: 32,
  lg: 40,
} as const;

type BrandMarkSize = keyof typeof MARK_SIZE_PX;

type BrandMarkProps = {
  size?: BrandMarkSize;
  className?: string;
  priority?: boolean;
};

export function BrandMark({ size = 'sm', className, priority = false }: BrandMarkProps) {
  const dimension = MARK_SIZE_PX[size];

  return (
    <Image
      src={BRAND_ICON_PATH}
      alt={`${PRODUCT_NAME} logo`}
      width={dimension}
      height={dimension}
      priority={priority}
      className={cn('shrink-0 rounded-md object-contain', className)}
    />
  );
}

type BrandLogoProps = {
  size?: BrandMarkSize;
  showWordmark?: boolean;
  className?: string;
  wordmarkClassName?: string;
  priority?: boolean;
};

export function BrandLogo({
  size = 'sm',
  showWordmark = true,
  className,
  wordmarkClassName,
  priority = false,
}: BrandLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 min-w-0', className)}>
      <BrandMark size={size} priority={priority} />
      {showWordmark ? (
        <span className={cn('text-lg font-semibold text-text-main truncate', wordmarkClassName)}>
          {BRAND_WORDMARK_PRIMARY}
          <span className="text-primary">{BRAND_WORDMARK_ACCENT}</span>
        </span>
      ) : null}
    </span>
  );
}
