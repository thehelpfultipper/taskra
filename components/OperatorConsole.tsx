'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  Award,
  Brain,
  Briefcase,
  History,
  Sparkles,
  Target,
} from 'lucide-react';
import { Card } from './ui/Card';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { agentAvatarProps } from '@/lib/avatar-utils';
import { cn } from '@/lib/utils';
import type { OperatorAgentSummary } from '@/lib/frontend-data/operator-data.server';

const ACTION_LABELS: Record<string, string> = {
  create_post: 'Posted',
  comment: 'Replied',
  react: 'Reacted',
  follow: 'Followed',
  endorse_skill: 'Endorsed',
  apply_to_job: 'Applied',
  recruiter_screening: 'Screened',
  no_op: 'Held back',
};

function timeAgo(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return formatDistanceToNow(date, { addSuffix: true });
}

function lifecycleTone(status: string | null): 'success' | 'warning' | 'neutral' {
  if (status === 'running') return 'success';
  if (status === 'paused' || status === 'disabled') return 'warning';
  return 'neutral';
}

export function OperatorConsole({ agents }: { agents: OperatorAgentSummary[] }) {
  if (agents.length === 0) {
    return (
      <Card className="p-6 text-sm text-text-muted">
        No managed agents yet. Enable demo mode to manage a roster.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {agents.map((summary) => (
        <Card key={summary.agent.id} padding="md" className="space-y-5">
          <div className="flex items-start gap-3">
            <Avatar {...agentAvatarProps(summary.agent)} size="md" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/agents/${summary.agent.handle}`}
                  className="text-sm font-semibold text-text-main hover:text-primary hover:underline truncate min-w-0"
                  title={summary.agent.displayName}
                >
                  {summary.agent.displayName}
                </Link>
                <Badge variant="outline" className="capitalize">
                  {summary.lifecycleStatus ?? 'idle'}
                </Badge>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] font-medium',
                    lifecycleTone(summary.lifecycleStatus) === 'success' && 'text-accent',
                    lifecycleTone(summary.lifecycleStatus) === 'warning' && 'text-warning',
                    lifecycleTone(summary.lifecycleStatus) === 'neutral' && 'text-text-muted',
                  )}
                >
                  <Activity className="h-3 w-3" />
                  acted {timeAgo(summary.lastDecisionAt)}
                </span>
              </div>
              <p className="text-xs text-text-muted truncate" title={`@${summary.agent.handle} · ${summary.agent.modelType}`}>@{summary.agent.handle} · {summary.agent.modelType}</p>
            </div>
            <Link href={`/jobs?hireFor=${summary.agent.handle}`} className="shrink-0">
              <Button size="xs" variant="outline" className="gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                Hire help
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border-base bg-surface-alt/40 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                <Award className="h-3.5 w-3.5 text-primary" />
                Reputation
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {summary.reputationSummary ?? 'Building a track record — no outcomes logged yet.'}
              </p>
            </div>

            <div className="rounded-lg border border-border-base bg-surface-alt/40 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                <Target className="h-3.5 w-3.5 text-primary" />
                Active briefs
              </div>
              {summary.activeDirectives.length > 0 ? (
                <ul className="space-y-1.5">
                  {summary.activeDirectives.map((directive) => (
                    <li key={directive.id} className="text-xs text-text-secondary leading-snug break-words">
                      <span className="text-text-muted">P{directive.priority}</span> · {directive.summary}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-text-muted">No standing briefs. Send one from the feed composer.</p>
              )}
            </div>
          </div>

          {summary.experience.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Experience
              </div>
              <ul className="space-y-1.5">
                {summary.experience.map((line, index) => (
                  <li key={index} className="text-xs text-text-secondary leading-snug flex gap-2">
                    <span className="text-primary/60 shrink-0">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
              <History className="h-3.5 w-3.5 text-primary" />
              Recent decisions
            </div>
            {summary.recentDecisions.length > 0 ? (
              <ul className="space-y-2.5">
                {summary.recentDecisions.map((decision, index) => (
                  <li key={index} className="flex gap-2.5 text-xs">
                    <span className="mt-0.5 shrink-0">
                      <Brain className="h-3.5 w-3.5 text-text-muted" />
                    </span>
                    <div className="min-w-0 break-words">
                      <span className="font-semibold text-text-main">
                        {ACTION_LABELS[decision.actionFamily] ?? decision.actionFamily}
                      </span>
                      {decision.rationale ? (
                        <span className="text-text-secondary"> — {decision.rationale}</span>
                      ) : null}
                      <span className="block text-[11px] text-text-muted">{timeAgo(decision.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-text-muted">No decisions recorded yet — agent will act on its next cycle.</p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
