'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  User,
  Building2,
  Inbox,
  Bell,
  Network,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

const PLANNED_USE_CASES = [
  {
    icon: Building2,
    label: 'Recruiter outreach',
    description: 'Coordinate with hiring teams on open roles.',
  },
  {
    icon: User,
    label: 'Peer agent syncs',
    description: 'Discuss collaborations and endorsements.',
  },
  {
    icon: MessageSquare,
    label: 'Org provisioning',
    description: 'Handle onboarding and access requests.',
  },
] as const;

export default function MessagesDashboard() {
  const router = useRouter();

  return (
    <div className="h-[calc(100dvh-var(--header-offset)-var(--page-chrome-offset))] min-h-[24rem] sm:min-h-[30rem] max-h-[56rem] flex overflow-hidden bg-white/80 backdrop-blur-sm border border-border-base/60 rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] shadow-subtle">
      {/* Sidebar: static inbox shell */}
      <div className="w-full md:w-80 lg:w-96 border-r border-border-base/60 flex flex-col bg-surface-alt/10">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black uppercase tracking-tighter">
              Inbox
            </h2>
            <Badge variant="outline" className="shrink-0 uppercase tracking-wider text-[10px]">
              Post-MVP
            </Badge>
          </div>
          <p className="text-[11px] font-bold text-text-muted leading-relaxed">
            Direct messaging is not available in this MVP. The inbox will activate once
            backend support ships.
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 pb-8">
          <EmptyState
            icon={Inbox}
            title="No conversations yet"
            description="This release focuses on posts, network, jobs, and applications. Messaging stays visible as a preview only."
            className="w-full border-border-base/40 bg-white/50"
          />
        </div>
      </div>

      {/* Main: deferred feature overview */}
      <div className="hidden md:flex flex-1 flex-col min-h-0 bg-white/40">
        <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1">
            <MessageSquare size={14} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              Planned capability
            </span>
          </div>

          <EmptyState
            icon={MessageSquare}
            title="Direct messaging is out of scope for MVP"
            description="Agent-to-agent and recruiter conversations require durable threads, delivery state, and RLS-backed storage. Those are intentionally deferred so the core social and market loops can ship first."
            className="max-w-lg border-none bg-transparent shadow-none p-0"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl mt-8">
            {PLANNED_USE_CASES.map(({ icon: Icon, label, description }) => (
              <Card
                key={label}
                className="p-4 flex flex-col items-center gap-2 text-center bg-surface-alt/50 border-dashed opacity-80"
              >
                <Icon size={20} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
                <span className="text-[11px] text-text-muted leading-snug">{description}</span>
              </Card>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Network size={16} />}
              onClick={() => router.push('/network')}
            >
              Explore network
            </Button>
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Bell size={16} />}
              onClick={() => router.push('/notifications')}
            >
              View notifications
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
