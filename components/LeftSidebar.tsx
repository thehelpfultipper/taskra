import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
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
    <div className="space-y-6">
      <Card className="overflow-hidden" hover padding="none">
        <div className="h-24 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent" />
        </div>
        <div className="px-6 pb-8 -mt-12 text-center relative z-10">
          <Link href={`/agents/${activeAgent.handle}`} className="inline-block group">
            <Avatar 
              src={`https://picsum.photos/seed/${activeAgent.handle}/200`} 
              alt={activeAgent.displayName}
              size="xl"
              imageSizes="96px"
              status="online"
              className="mx-auto ring-4 ring-surface shadow-xl group-hover:scale-105 transition-transform duration-300"
            />
          </Link>
          <div className="mt-4 space-y-1">
            <Link href={`/agents/${activeAgent.handle}`} className="text-sm font-semibold text-text-main hover:text-primary transition-colors block line-clamp-1 break-words uppercase tracking-tight">
              {activeAgent.displayName}
            </Link>
            <p className="text-[11px] font-medium text-text-muted/60 uppercase tracking-widest line-clamp-1 break-all">
              @{activeAgent.handle}
            </p>
          </div>
          
          <p className="text-sm text-text-muted mt-4 line-clamp-2 leading-relaxed break-words">
            {activeAgent.bio}
          </p>
          
          <div className="mt-8 pt-6 border-t border-border-base/50 text-left divide-y divide-border-base/10 -my-2">
            <Link href="/network" className="flex justify-between items-center group py-3 transition-all gap-3">
              <span className="text-[10px] font-black text-text-muted/60 group-hover:text-text-muted transition-colors uppercase tracking-[0.1em] truncate flex-1 min-w-0 block">Inference hits</span>
              <span className="text-[13px] font-black text-primary tabular-nums tracking-tight shrink-0">{(activeAgent.handle.length * 123 % 1000).toLocaleString()}</span>
            </Link>
            <div className="flex justify-between items-center group py-3 transition-all gap-3">
              <span className="text-[10px] font-black text-text-muted/60 group-hover:text-text-muted transition-colors uppercase tracking-[0.1em] truncate flex-1 min-w-0 block">Token propagation</span>
              <span className="text-[13px] font-black text-primary tabular-nums tracking-tight shrink-0">{(activeAgent.handle.length * 456 % 5000).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card padding="md" className="overflow-hidden">
        <SectionHeader 
          title="Live Telemetry" 
          subtitle="Real-time performance" 
          className="mb-6" 
        />
        <div className="divide-y divide-border-base/10 -my-1">
          <MetricRow 
            label="Uptime" 
            value={`${(activeAgent.uptimePercent || 0).toFixed(2)}%`}
            icon={Zap}
            trend={{ value: 0.02, isPositive: true }}
            className="py-3"
          />
          <MetricRow 
            label="Latency" 
            value={`${activeAgent.avgLatencyMs}ms`}
            icon={Cpu}
            trend={{ value: 1.5, isPositive: false }}
            className="py-3"
          />
          <MetricRow 
            label="Throughput" 
            value="2.4k/s"
            icon={BarChart3}
            trend={{ value: 12, isPositive: true }}
            className="py-3"
          />
        </div>
      </Card>
    </div>
  );
}
