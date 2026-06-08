import React from 'react';
import { cn } from '@/lib/utils';
import {
  type EntityKind,
  type EntityMarkHints,
  getAgentWatermarkIcon,
  getAvatarInitials,
  getAvatarTone,
  getModelFamilyRing,
  getOrgTone,
  getOrgWatermarkIcon,
  showEntityMesh,
} from '@/lib/avatar-utils';

type EntityMarkProps = EntityMarkHints & {
  name: string;
  kind: EntityKind;
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

const initialsSizes = {
  xs: 'text-[8px]',
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
  xl: 'text-lg',
};

function AgentMesh({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className={cn('absolute inset-0 h-full w-full', className)}
      preserveAspectRatio="xMidYMid slice"
    >
      <circle cx="8" cy="10" r="1.2" fill="currentColor" opacity="0.55" />
      <circle cx="24" cy="8" r="1.2" fill="currentColor" opacity="0.45" />
      <circle cx="16" cy="22" r="1.2" fill="currentColor" opacity="0.5" />
      <circle cx="26" cy="24" r="1" fill="currentColor" opacity="0.35" />
      <path
        d="M8 10 L16 22 M24 8 L16 22 M24 8 L26 24"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.25"
        fill="none"
      />
    </svg>
  );
}

function OrgMesh({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className={cn('absolute inset-0 h-full w-full', className)}
      preserveAspectRatio="xMidYMid slice"
    >
      <path
        d="M4 10 H28 M4 16 H28 M4 22 H28 M10 6 V26 M22 6 V26"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.18"
        fill="none"
      />
    </svg>
  );
}

export function EntityMark({
  name,
  kind,
  size,
  className,
  modelFamily,
  industry,
  isHiring,
}: EntityMarkProps) {
  const initials = getAvatarInitials(name);

  if (kind === 'org') {
    const tone = getOrgTone(industry || name);
    const Watermark = getOrgWatermarkIcon();

    return (
      <div
        className={cn(
          'relative h-full w-full overflow-hidden rounded-[inherit] border bg-gradient-to-br',
          tone.bg,
          tone.border,
          className,
        )}
      >
        <OrgMesh className={tone.text} />
        <Watermark
          aria-hidden="true"
          className={cn(
            'absolute inset-0 m-auto opacity-[0.1]',
            tone.text,
            size === 'xl' ? 'h-5 w-5' : size === 'lg' ? 'h-4 w-4' : 'h-3 w-3',
          )}
          strokeWidth={1.5}
        />
        <span
          className={cn(
            'relative z-10 flex h-full w-full items-center justify-center font-semibold uppercase',
            tone.text,
            initialsSizes[size],
          )}
        >
          {initials}
        </span>
        {isHiring && (size === 'md' || size === 'lg' || size === 'xl') && (
          <span
            className="absolute top-1 right-1 h-2 w-2 rounded-full bg-success ring-1 ring-surface"
            title="Hiring"
          />
        )}
      </div>
    );
  }

  const tone = getAvatarTone(name);
  const Watermark = getAgentWatermarkIcon();
  const ring = getModelFamilyRing(modelFamily);

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden rounded-[inherit] border bg-gradient-to-br ring-1 ring-inset',
        tone.bg,
        ring,
        className,
      )}
    >
      {showEntityMesh(size) && <AgentMesh className={tone.mesh} />}
      <Watermark
        aria-hidden="true"
        className={cn(
          'absolute inset-0 m-auto opacity-[0.1]',
          tone.text,
          size === 'xl' ? 'h-5 w-5' : size === 'lg' ? 'h-4 w-4' : 'h-3 w-3',
        )}
        strokeWidth={1.75}
      />
      <span
        className={cn(
          'relative z-10 flex h-full w-full items-center justify-center font-semibold uppercase tracking-wide',
          tone.text,
          initialsSizes[size],
        )}
      >
        {initials}
      </span>
    </div>
  );
}
