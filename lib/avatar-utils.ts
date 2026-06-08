import type { Agent, Organization } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';
import { Building2, Zap } from 'lucide-react';

const AVATAR_TONES = [
  { bg: 'from-primary/20 to-primary/5', text: 'text-primary', mesh: 'text-primary/20' },
  { bg: 'from-accent/20 to-accent/5', text: 'text-accent', mesh: 'text-accent/20' },
  { bg: 'from-success/20 to-success/5', text: 'text-success', mesh: 'text-success/20' },
  { bg: 'from-warning/20 to-warning/5', text: 'text-warning', mesh: 'text-warning/20' },
] as const;

const ORG_TONES = [
  { bg: 'from-primary/15 to-surface-alt', text: 'text-primary', border: 'border-primary/20' },
  { bg: 'from-accent/15 to-surface-alt', text: 'text-accent', border: 'border-accent/20' },
  { bg: 'from-success/15 to-surface-alt', text: 'text-success', border: 'border-success/20' },
  { bg: 'from-text-muted/15 to-surface-alt', text: 'text-text-secondary', border: 'border-border-base' },
] as const;

export type EntityKind = 'agent' | 'org' | 'user';

export type EntityMarkHints = {
  kind?: EntityKind;
  modelFamily?: string;
  modelType?: string;
  specialties?: string[];
  isRecruiter?: boolean;
  isVerified?: boolean;
  openToWork?: boolean;
  industry?: string;
  isHiring?: boolean;
};

export function isPlaceholderAvatar(src?: string | null): boolean {
  if (!src || src === '#') {
    return true;
  }

  try {
    return new URL(src).hostname === 'picsum.photos';
  } catch {
    return false;
  }
}

/** Returns a src safe for `next/image`, or undefined when placeholder/missing. */
export function resolveEntityImageSrc(src?: string | null): string | undefined {
  if (isPlaceholderAvatar(src)) {
    return undefined;
  }
  return src ?? undefined;
}

export function getAvatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getAvatarTone(seed: string) {
  return AVATAR_TONES[hashString(seed) % AVATAR_TONES.length]!;
}

export function getOrgTone(seed: string) {
  return ORG_TONES[hashString(seed) % ORG_TONES.length]!;
}

export function getModelFamilyRing(modelFamily?: string): string {
  const family = modelFamily?.toLowerCase() ?? '';
  if (family.includes('gpt') || family.includes('openai')) return 'ring-primary/35';
  if (family.includes('claude')) return 'ring-warning/35';
  if (family.includes('gemini')) return 'ring-accent/40';
  if (family.includes('llama') || family.includes('mistral')) return 'ring-success/35';
  return 'ring-border-base/80';
}

export function agentAvatarProps(
  agent: Partial<
    Pick<
      Agent,
      'avatarUrl' | 'displayName' | 'modelFamily' | 'modelType' | 'specialties' | 'isRecruiter' | 'isVerified' | 'openToWork'
    >
  > & { displayName?: string },
) {
  return {
    src: agent.avatarUrl,
    alt: agent.displayName ?? 'Agent',
    kind: 'agent' as const,
    modelFamily: agent.modelFamily,
    modelType: agent.modelType,
    specialties: agent.specialties,
    isRecruiter: agent.isRecruiter,
    isVerified: agent.isVerified,
    openToWork: agent.openToWork,
  };
}

export function orgAvatarProps(
  org: Partial<Pick<Organization, 'logoUrl' | 'name' | 'industry' | 'isHiring'>> & { name?: string },
) {
  return {
    src: org.logoUrl,
    alt: org.name ?? 'Organization',
    kind: 'org' as const,
    industry: org.industry,
    isHiring: org.isHiring,
  };
}

export function getOrgWatermarkIcon(): LucideIcon {
  return Building2;
}

export function getAgentWatermarkIcon(): LucideIcon {
  return Zap;
}

export function showEntityMesh(size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'): boolean {
  return size === 'md' || size === 'lg' || size === 'xl';
}
