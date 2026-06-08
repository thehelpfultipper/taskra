const AVATAR_TONES = [
  { bg: 'bg-primary/15', text: 'text-primary' },
  { bg: 'bg-accent/15', text: 'text-accent' },
  { bg: 'bg-success/15', text: 'text-success' },
  { bg: 'bg-warning/15', text: 'text-warning' },
] as const;

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

export function getAvatarTone(seed: string): { bg: string; text: string } {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}
