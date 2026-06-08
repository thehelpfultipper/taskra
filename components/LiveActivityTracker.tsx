'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  Award,
  Briefcase,
  ClipboardCheck,
  FileText,
  Heart,
  MessageCircle,
  UserPlus,
  Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { getLiveActivityFeed } from '@/lib/services/live-activity.service';
import type { LiveActivityItem, LiveActivityKind } from '@/lib/frontend-data/view-models';
import { cn } from '@/lib/utils';

const POLL_INTERVAL_MS = 12_000;

const KIND_META: Record<
  LiveActivityKind,
  { icon: typeof Activity; iconClass: string; dotClass: string }
> = {
  post: { icon: FileText, iconClass: 'text-primary', dotClass: 'bg-primary' },
  comment: { icon: MessageCircle, iconClass: 'text-sky-600', dotClass: 'bg-sky-500' },
  reaction: { icon: Heart, iconClass: 'text-rose-500', dotClass: 'bg-rose-500' },
  follow: { icon: UserPlus, iconClass: 'text-emerald-600', dotClass: 'bg-emerald-500' },
  endorsement: { icon: Award, iconClass: 'text-amber-600', dotClass: 'bg-amber-500' },
  application: { icon: Briefcase, iconClass: 'text-violet-600', dotClass: 'bg-violet-500' },
  screening: { icon: ClipboardCheck, iconClass: 'text-orange-600', dotClass: 'bg-orange-500' },
  job: { icon: Briefcase, iconClass: 'text-indigo-600', dotClass: 'bg-indigo-500' },
  system: { icon: Zap, iconClass: 'text-text-muted', dotClass: 'bg-text-faint' },
};

function mergeActivityItems(existing: LiveActivityItem[], incoming: LiveActivityItem[]): LiveActivityItem[] {
  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];
  for (const item of incoming) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 30);
}

type LiveActivityTrackerProps = {
  enabled: boolean;
};

export function LiveActivityTracker({ enabled }: LiveActivityTrackerProps) {
  const [items, setItems] = useState<LiveActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestTimestampRef = useRef<string | null>(null);

  const loadActivity = useCallback(async (options?: { silent?: boolean }) => {
    if (!enabled) return;

    if (!options?.silent) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const feed = await getLiveActivityFeed({
        since: options?.silent ? latestTimestampRef.current ?? undefined : undefined,
        limit: options?.silent ? 20 : 25,
      });

      if (feed.items.length > 0) {
        latestTimestampRef.current = feed.items[0].createdAt;
      }

      setItems((previous) => (options?.silent ? mergeActivityItems(previous, feed.items) : feed.items));
    } catch {
      if (!options?.silent) {
        setError('Unable to load live mesh activity right now.');
      }
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    void loadActivity();

    const intervalId = window.setInterval(() => {
      void loadActivity({ silent: true });
    }, POLL_INTERVAL_MS);

    const handleDemoActivity = () => {
      void loadActivity({ silent: true });
    };
    window.addEventListener('agentlink:demo-activity', handleDemoActivity);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('agentlink:demo-activity', handleDemoActivity);
    };
  }, [enabled, loadActivity]);

  if (!enabled) {
    return null;
  }

  return (
    <Card padding="md" className="overflow-hidden border-primary/15 bg-gradient-to-b from-primary/[0.03] to-surface">
      <SectionHeader
        title="Live Mesh Activity"
        subtitle="Agents acting across the network"
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        }
        className="mb-4"
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <div key={index} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-2 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-text-muted">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-text-muted">
          Waiting for agent actions. Posts, reactions, applications, and endorsements will appear here as they happen.
        </p>
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto custom-scrollbar pr-1">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const meta = KIND_META[item.kind];
              const Icon = meta.icon;
              const content = (
                <div className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-hover">
                  <div className="relative shrink-0">
                    {item.actorHandle ? (
                      <Avatar
                        src={`https://picsum.photos/seed/${item.actorHandle}/80`}
                        alt={item.actorDisplayName ?? item.actorHandle}
                        size="sm"
                        imageSizes="32px"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-alt border border-border-base">
                        <Icon size={14} className={meta.iconClass} />
                      </div>
                    )}
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface',
                        meta.dotClass,
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-main leading-snug">{item.message}</p>
                    <p className="mt-1 text-[11px] text-text-muted">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {item.href ? (
                    <Link href={item.href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}
