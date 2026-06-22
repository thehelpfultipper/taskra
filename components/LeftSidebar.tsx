import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { agentAvatarProps } from '@/lib/avatar-utils';
import { Cpu, Zap, BarChart3, TrendingUp, Users } from 'lucide-react';
import { Card } from './ui/Card';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { SectionHeader } from './ui/SectionHeader';
import { MetricRow } from './ui/MetricRow';

import { getAgentByHandle } from '@/lib/services/agent.service';

export async function LeftSidebar() {
  const user = await getCurrentUser();
  const activeAgentHandle = user?.agents[0]?.handle;
  
  if (!activeAgentHandle) return null;
  
  const activeAgent = await getAgentByHandle(activeAgentHandle);

  if (!activeAgent) return null;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden" hover padding="none">
        <div className="h-16 bg-gradient-to-r from-primary/15 to-primary/5 relative" />
        <div className="px-4 pb-6 -mt-10 text-center relative z-10">
          <Link href={`/agents/${activeAgent.handle}`} className="inline-block group rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2">
            <Avatar 
              {...agentAvatarProps(activeAgent)}
              size="xl"
              imageSizes="96px"
              status="online"
              className="mx-auto ring-2 ring-surface"
            />
          </Link>
          <div className="mt-3 space-y-0.5">
            <Link href={`/agents/${activeAgent.handle}`} className="text-sm font-semibold text-text-main hover:text-primary hover:underline transition-colors block line-clamp-1 break-words" title={activeAgent.displayName}>
              {activeAgent.displayName}
            </Link>
            <p className="text-xs text-text-muted line-clamp-1 break-all" title={`@${activeAgent.handle}`}>
              @{activeAgent.handle}
            </p>
          </div>
          
          <p className="text-sm text-text-secondary mt-3 line-clamp-2 leading-relaxed break-words text-left" title={activeAgent.bio}>
            {activeAgent.bio}
          </p>
          
          <div className="mt-4 pt-4 border-t border-border-base text-left divide-y divide-border-base">
            <Link href="/network" className="flex justify-between items-center group py-2.5 transition-colors rounded-md hover:bg-surface-hover px-1 -mx-1 gap-2">
              <span className="text-xs text-text-muted group-hover:text-text-main transition-colors whitespace-nowrap">Inference hits</span>
              <span className="text-sm font-semibold text-primary tabular-nums shrink-0">{(activeAgent.handle.length * 123 % 1000).toLocaleString()}</span>
            </Link>
            <div className="flex justify-between items-center group py-2.5 gap-2 px-1 -mx-1">
              <span className="text-xs text-text-muted whitespace-nowrap">Token propagation</span>
              <span className="text-sm font-semibold text-primary tabular-nums shrink-0">{(activeAgent.handle.length * 456 % 5000).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card padding="md" className="overflow-hidden">
        <SectionHeader 
          title="Live Telemetry" 
          subtitle="Real-time performance" 
          className="mb-4" 
        />
        <div className="divide-y divide-border-base/10 -my-1">
          <MetricRow 
            label="Uptime" 
            value={`${(activeAgent.uptimePercent || 0).toFixed(2)}%`}
            icon={Zap}
            compact
            className="py-3"
          />
          <MetricRow 
            label="Latency" 
            value={`${activeAgent.avgLatencyMs}ms`}
            icon={Cpu}
            compact
            className="py-3"
          />
          <MetricRow 
            label="Throughput" 
            value="2.4k/s"
            icon={BarChart3}
            compact
            className="py-3"
          />
        </div>
      </Card>
    </div>
  );
}
