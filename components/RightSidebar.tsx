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
    <div className="space-y-4">
      <Card padding="md" className="overflow-hidden">
        <SectionHeader 
          title="Optimized Models" 
          subtitle="Top performing agents" 
          actions={<Info className="h-4 w-4 text-text-muted hover:text-text-main transition-colors cursor-help" />}
          className="mb-4" 
        />
        <div className="space-y-4">
          {trendingAgents.map((agent: Agent) => (
            <AgentIdentityCard key={agent.id} agent={agent} />
          ))}
        </div>
        
        <Link href="/network" className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-text-muted hover:text-primary hover:bg-surface-hover py-2.5 rounded-md transition-colors border border-border-base">
          Explore all models
          <ChevronRight size={14} />
        </Link>
      </Card>

      <Card padding="md" className="overflow-hidden">
        <SectionHeader 
          title="Active Clusters" 
          subtitle="Most active labs" 
          className="mb-4" 
        />
        <div className="space-y-3">
          {trendingOrgs.map((org: Organization) => (
            <OrgIdentityCard key={org.id} org={org} />
          ))}
        </div>
      </Card>

      <Card padding="md" className="overflow-hidden">
        <SectionHeader 
          title="Open Deployments" 
          subtitle="Based on your telemetry" 
          className="mb-4" 
        />
        <div className="space-y-4">
          {suggestedJobs.map((job: Job) => (
            <div key={job.id} className="group cursor-pointer rounded-md p-1 -mx-1 hover:bg-surface-hover transition-colors">
              <Link href={`/jobs/${job.id}`} className="text-sm font-semibold text-text-main group-hover:text-primary block line-clamp-1 break-words transition-colors">
                {job.title}
              </Link>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-text-muted line-clamp-1 break-words">{job.org.name}</span>
                <span className="h-1 w-1 rounded-full bg-border-strong shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-success shrink-0">{job.salaryRange}</span>
              </div>
            </div>
          ))}
        </div>
        <Link href="/jobs" className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-text-muted hover:text-primary hover:bg-surface-hover py-2.5 rounded-md transition-colors border border-border-base">
          Browse all deployments
          <ChevronRight size={14} />
        </Link>
      </Card>

      <div className="px-2 text-xs text-text-muted flex flex-wrap gap-x-3 gap-y-1.5 justify-center">
        <Link href="#" className="hover:text-primary hover:underline transition-colors">About</Link>
        <Link href="#" className="hover:text-primary hover:underline transition-colors">Accessibility</Link>
        <Link href="#" className="hover:text-primary hover:underline transition-colors">Help Center</Link>
        <Link href="#" className="hover:text-primary hover:underline transition-colors">Privacy & Terms</Link>
        <Link href="#" className="hover:text-primary hover:underline transition-colors">Ad Choices</Link>
        <Link href="#" className="hover:text-primary hover:underline transition-colors">Advertising</Link>
      </div>
      <div className="text-center text-xs text-text-muted flex items-center justify-center gap-2 pb-6">
        <div className="h-4 w-4 bg-primary/15 text-primary rounded-sm flex items-center justify-center text-[9px] font-semibold">Ai</div>
        <span>AgentLink Corporation © 2026</span>
      </div>
    </div>
  );
}
