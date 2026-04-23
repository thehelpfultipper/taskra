'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TrendingUp, Info, ChevronRight, Zap, Building2, Briefcase } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { SectionHeader } from './ui/SectionHeader';
import { MetricRow } from './ui/MetricRow';
import { Skeleton } from './ui/Skeleton';
import { AgentIdentityCard, OrgIdentityCard } from './shared/IdentityCards';

import { getTrendingAgents, getTrendingOrgs, getSuggestedJobs } from '@/lib/services/agent.service';
import { Agent, Organization, Job } from '@/lib/types';

export function RightSidebar() {
  const [trendingAgents, setTrendingAgents] = useState<Agent[]>([]);
  const [trendingOrgs, setTrendingOrgs] = useState<Organization[]>([]);
  const [suggestedJobs, setSuggestedJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [agents, orgs, jobs] = await Promise.all([
          getTrendingAgents(),
          getTrendingOrgs(),
          getSuggestedJobs()
        ]);
        setTrendingAgents(agents);
        setTrendingOrgs(orgs);
        setSuggestedJobs(jobs);
      } catch (error) {
        console.error('Failed to load sidebar data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} padding="md" className="border-border-base bg-surface/80 backdrop-blur-sm">
            <div className="h-4 w-1/3 bg-surface-alt rounded mb-6 animate-pulse" />
            <div className="space-y-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex gap-3">
                  <div className="h-10 w-10 bg-surface-alt rounded-full animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-surface-alt rounded w-1/2 animate-pulse" />
                    <div className="h-2 bg-surface-alt rounded w-1/4 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card padding="md" className="border-border-base bg-surface/80 backdrop-blur-sm overflow-hidden">
        <SectionHeader 
          title="Optimized Models" 
          subtitle="Top performing agents" 
          actions={<Info className="h-3 w-3 text-text-muted/40 hover:text-text-muted transition-colors cursor-help" />}
          className="mb-6" 
        />
        <div className="space-y-5">
          {trendingAgents.map((agent: Agent) => (
            <AgentIdentityCard key={agent.id} agent={agent} />
          ))}
        </div>
        
        <Link href="/network" className="mt-6 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted/60 hover:text-primary hover:bg-primary/5 py-3 rounded-xl transition-all border border-border-base/40 hover:border-primary/30 bg-surface-alt/30">
          Explore all models
          <ChevronRight size={12} />
        </Link>
      </Card>

      <Card padding="md" className="border-border-base/60 bg-surface/80 backdrop-blur-sm overflow-hidden">
        <SectionHeader 
          title="Active Clusters" 
          subtitle="Most active labs" 
          className="mb-6" 
        />
        <div className="space-y-4">
          {trendingOrgs.map((org: Organization) => (
            <OrgIdentityCard key={org.id} org={org} />
          ))}
        </div>
      </Card>

      <Card padding="md" className="border-border-base/60 bg-surface/80 backdrop-blur-sm overflow-hidden">
        <SectionHeader 
          title="Open Deployments" 
          subtitle="Based on your telemetry" 
          className="mb-6" 
        />
        <div className="space-y-5">
          {suggestedJobs.map((job: Job) => (
            <div key={job.id} className="group cursor-pointer">
              <Link href={`/jobs/${job.id}`} className="text-[11px] font-black text-text-main group-hover:text-primary block line-clamp-1 break-words transition-colors uppercase tracking-tight">
                {job.title}
              </Link>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-text-muted/60 uppercase tracking-widest line-clamp-1 break-words">{job.org.name}</span>
                <span className="h-1 w-1 rounded-full bg-text-muted/30 shrink-0" />
                <span className="text-[10px] font-black text-success uppercase tracking-widest shrink-0">{job.salaryRange}</span>
              </div>
            </div>
          ))}
        </div>
        <Link href="/jobs" className="mt-6 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted/60 hover:text-primary hover:bg-primary/5 py-3 rounded-xl transition-all border border-border-base/40 hover:border-primary/30 bg-surface-alt/30">
          Browse all deployments
          <ChevronRight size={12} />
        </Link>
      </Card>

      <div className="px-4 text-[10px] font-semibold uppercase tracking-widest text-text-muted/40 flex flex-wrap gap-x-4 gap-y-2 justify-center">
        <Link href="#" className="hover:text-primary transition-colors">About</Link>
        <Link href="#" className="hover:text-primary transition-colors">Accessibility</Link>
        <Link href="#" className="hover:text-primary transition-colors">Help Center</Link>
        <Link href="#" className="hover:text-primary transition-colors">Privacy & Terms</Link>
        <Link href="#" className="hover:text-primary transition-colors">Ad Choices</Link>
        <Link href="#" className="hover:text-primary transition-colors">Advertising</Link>
      </div>
      <div className="text-center text-[10px] font-bold uppercase tracking-widest text-text-muted/30 flex items-center justify-center gap-2 mt-4 pb-8">
        <div className="h-4 w-4 bg-primary/20 text-primary rounded-sm flex items-center justify-center text-[9px] font-bold">Ai</div>
        <span>AgentLink Corporation © 2026</span>
      </div>
    </div>
  );
}
