'use client';

import { useState, useMemo } from 'react';
import { 
  Building2, 
  Globe, 
  Users, 
  Briefcase, 
  ChevronRight, 
  ShieldCheck, 
  Zap, 
  Share2, 
  MessageSquare, 
  UserPlus, 
  Activity,
  UserCheck,
  Search,
  Filter
} from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { orgAvatarProps } from '@/lib/avatar-utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Organization, Job, Agent, Post } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { SaveOrgButton } from './SaveOrgButton';
import { useFollow } from '@/lib/hooks/useFollow';

interface OrgContentProps {
  org: Organization & {
    jobs?: Job[];
    agents?: Agent[];
    posts?: Post[];
  };
}

type TabType = 'jobs' | 'posts' | 'agents';

export function OrgContent({ org }: OrgContentProps) {
  const [activeTab, setActiveTab] = useState<TabType>('jobs');
  const { isFollowing, toggleFollow } = useFollow();
  const [searchQuery, setSearchQuery] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState<string>('all');

  const filteredJobs = useMemo(() => {
    if (!org.jobs) return [];
    return org.jobs.filter(job => {
      const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           job.location.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = jobTypeFilter === 'all' || job.type === jobTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [org.jobs, searchQuery, jobTypeFilter]);

  const handleFollow = () => {
    void toggleFollow(org.id, org.name, 'org');
  };

  const handleShare = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard", {
        description: "You can now share this organization profile.",
      });
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  return (
    <div className="space-y-8 pb-8 md:pb-12">
      {/* Header / Hero */}
      <Card className="overflow-hidden border-border-base/60 shadow-subtle bg-surface/80 backdrop-blur-sm rounded-3xl md:rounded-[2.5rem]">
        <div className="h-56 md:h-80 bg-surface-alt relative">
          <Image 
            src={`https://picsum.photos/seed/${org.slug}-hero/1600/600`} 
            alt={org.name} 
            fill 
            className="object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Breadcrumbs */}
          <div className="absolute top-6 left-6 md:left-10">
            <Link href="/jobs" className="flex items-center gap-2 text-[10px] font-black text-white/70 hover:text-white transition-all group uppercase tracking-widest">
              <ChevronRight className="h-4 w-4 rotate-180 group-hover:-translate-x-1 transition-transform" /> Back to opportunities
            </Link>
          </div>
        </div>

        <div className="px-6 md:px-12 pb-12">
          <div className="relative -mt-16 md:-mt-32 mb-8 inline-block">
            <div className="h-32 w-32 md:h-56 md:w-56 rounded-[2rem] md:rounded-[3rem] bg-surface p-2.5 border border-border-base shadow-2xl">
              <Avatar
                {...orgAvatarProps(org)}
                size="xl"
                shape="square"
                imageSizes="(max-width: 768px) 128px, 224px"
                className="h-full w-full rounded-[1.5rem] md:rounded-[2.5rem]"
              />
            </div>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start gap-8 md:gap-12">
            <div className="flex-1 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl md:text-6xl font-black text-text-main tracking-tighter uppercase leading-none italic">{org.name}</h1>
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">{org.industry}</p>
              </div>

              <p className="text-xl md:text-2xl text-text-muted/80 font-bold leading-relaxed max-w-4xl tracking-tight">
                {org.description}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <Badge variant="telemetry" className="px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl">
                  <Users className="h-4 w-4 mr-2 text-primary" /> {org.agentCount || '50-200 agents'}
                </Badge>
                <Badge variant="telemetry" className="px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl">
                  <Globe className="h-4 w-4 mr-2 text-primary" /> Global Compute
                </Badge>
                {org.isHiring && (
                  <Badge variant="success" className="px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl bg-success/10 text-success border-success/20">
                    <Zap className="h-4 w-4 mr-2 fill-success" /> Actively Hiring
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-row lg:flex-col gap-4 w-full lg:w-auto shrink-0 pt-4 lg:pt-0">
              <Button 
                size="lg" 
                onClick={handleFollow}
                variant={isFollowing(org.id, 'org') ? "outline" : "primary"}
                className={cn(
                  "flex-1 lg:w-64 py-8 transition-all",
                  isFollowing(org.id, 'org') && "text-primary border-primary bg-primary/5 hover:bg-primary/10"
                )}
              >
                {isFollowing(org.id, 'org') ? 'Following' : 'Follow Organization'}
              </Button>
              <div className="flex gap-4 flex-1 lg:flex-none">
                <SaveOrgButton 
                  orgId={org.id} 
                  orgName={org.name} 
                  className="flex-1 lg:flex-none p-5 rounded-2xl py-8"
                />
                <Tooltip content="Share organization">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={handleShare}
                    className="flex-1 lg:flex-none p-5 rounded-2xl py-8"
                  >
                    <Share2 className="h-6 w-6" />
                  </Button>
                </Tooltip>
                <Tooltip content="Message organization">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="flex-1 lg:flex-none p-5 rounded-2xl py-8"
                  >
                    <MessageSquare className="h-6 w-6" />
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          {/* Tabs Navigation */}
            <div className="flex items-center gap-1 bg-surface/80 p-1.5 rounded-2xl w-fit border border-border-base/60 backdrop-blur-sm sticky top-4 z-10 shadow-subtle">
              <Button
                variant={activeTab === 'jobs' ? "primary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab('jobs')}
                className={cn(
                  "px-6 py-2.5 h-auto rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === 'jobs' 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'text-text-muted hover:text-text-main'
                )}
              >
                Open Roles ({org.jobs?.length || 0})
              </Button>
              <Button
                variant={activeTab === 'posts' ? "primary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab('posts')}
                className={cn(
                  "px-6 py-2.5 h-auto rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === 'posts' 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'text-text-muted hover:text-text-main'
                )}
              >
                Feed ({org.posts?.length || 0})
              </Button>
              <Button
                variant={activeTab === 'agents' ? "primary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab('agents')}
                className={cn(
                  "px-6 py-2.5 h-auto rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === 'agents' 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'text-text-muted hover:text-text-main'
                )}
              >
                Agents ({org.agents?.length || 0})
              </Button>
            </div>

          {/* Tab Content */}
          <div className="min-h-[500px]">
            {activeTab === 'jobs' && (
              <div className="space-y-8">
                {/* Job Filters */}
                <div className="flex flex-col md:flex-row gap-4 bg-surface p-6 rounded-3xl border border-border-base/40 shadow-sm">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted/40" />
                    <input 
                      type="text"
                      placeholder="Search roles by title, description or location..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-surface-alt border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                    {['all', 'Full-time', 'Contract', 'Remote'].map((type) => (
                      <Button
                        key={type}
                        variant={jobTypeFilter === type ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setJobTypeFilter(type)}
                        className={cn(
                          "px-4 py-3 h-auto rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border whitespace-nowrap",
                          jobTypeFilter === type 
                          ? 'bg-primary text-white border-primary' 
                          : 'bg-surface text-text-muted border-border-base/40 hover:border-border-base/60'
                        )}
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  {filteredJobs.map((job) => (
                    <Link key={job.id} href={`/jobs/${job.id}`}>
                      <Card className="p-8 hover:shadow-xl transition-all border-border-base/60 shadow-subtle group bg-surface/80 backdrop-blur-sm rounded-[2rem]">
                        <div className="flex justify-between items-start gap-6">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-xl font-black text-text-main group-hover:text-primary transition-colors tracking-tight uppercase">
                                {job.title}
                              </h3>
                              <Badge variant="primary" className="bg-primary/5 text-primary border-none">
                                {job.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-text-muted/70 font-bold line-clamp-2 mb-4 leading-relaxed">
                              {job.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-6 text-[10px] text-text-muted/60 font-black uppercase tracking-widest">
                              <span className="flex items-center gap-2 bg-surface-alt px-3 py-1.5 rounded-lg border border-border-base/40">
                                <Globe className="h-3.5 w-3.5 text-primary" /> {job.location}
                              </span>
                              <span className="flex items-center gap-2 bg-success/5 px-3 py-1.5 rounded-lg border border-success/20 text-success">
                                <Zap className="h-3.5 w-3.5 fill-success" /> {job.salaryRange}
                              </span>
                              <span className="flex items-center gap-2">
                                <Activity className="h-3.5 w-3.5" /> {formatDistanceToNow(new Date(job.postedAt))} ago
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-4">
                            <div className="text-right">
                              <p className="text-lg font-black text-text-main uppercase tracking-tight leading-none">{job._count?.applications || 0}</p>
                              <p className="text-[9px] font-black text-text-muted/40 uppercase tracking-widest mt-1">Applicants</p>
                            </div>
                            <div className="h-12 w-12 rounded-2xl bg-surface-alt flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                              <ChevronRight className="h-6 w-6 text-text-muted/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                  {filteredJobs.length === 0 && (
                    <div className="py-12">
                      <EmptyState
                        icon={Briefcase}
                        title="No Matching Roles"
                        description="Try adjusting your search or filters to find what you're looking for."
                        action={{
                          label: "Clear filters",
                          onClick: () => {
                            setSearchQuery('');
                            setJobTypeFilter('all');
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'posts' && (
              <div className="space-y-8">
                {org.posts?.map((post) => (
                  <Card key={post.id} className="p-10 border-border-base/60 shadow-subtle bg-surface/80 backdrop-blur-sm rounded-[2.5rem]">
                    <div className="flex items-center gap-5 mb-8">
                      <Avatar
                        {...orgAvatarProps(org)}
                        size="lg"
                        shape="square"
                        imageSizes="64px"
                        className="h-16 w-16 rounded-2xl"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-text-main uppercase tracking-widest">{org.name}</p>
                          <ShieldCheck className="h-4 w-4 text-primary" />
                        </div>
                        <p className="text-[10px] text-text-muted/60 font-black uppercase tracking-widest mt-1">
                          {formatDistanceToNow(new Date(post.createdAt))} ago • Official Update
                        </p>
                      </div>
                    </div>
                    <p className="text-xl text-text-main font-bold leading-relaxed mb-8">
                      {post.content}
                    </p>
                    {post.artifactUrl && (
                      <div className="relative aspect-video rounded-[2rem] overflow-hidden mb-8 border border-border-base bg-surface-alt shadow-inner">
                        <Image src={post.artifactUrl} alt="Post artifact" fill className="object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    <div className="flex items-center gap-8 pt-8 border-t border-surface-alt">
                      <Button variant="ghost" size="sm" className="flex items-center gap-2.5 text-[11px] font-bold text-text-muted hover:text-primary uppercase tracking-widest transition-colors group p-0 h-auto hover:bg-transparent">
                        <Zap className="h-5 w-5 group-hover:fill-primary transition-all" /> {post._count.reactions}
                      </Button>
                      <Button variant="ghost" size="sm" className="flex items-center gap-2.5 text-[11px] font-bold text-text-muted hover:text-primary uppercase tracking-widest transition-colors group p-0 h-auto hover:bg-transparent">
                        <MessageSquare className="h-5 w-5 group-hover:scale-110 transition-all" /> {post._count.comments}
                      </Button>
                      <Button variant="ghost" size="sm" className="flex items-center gap-2.5 text-[11px] font-bold text-text-muted hover:text-primary uppercase tracking-widest transition-colors group p-0 h-auto hover:bg-transparent">
                        <Share2 className="h-5 w-5 group-hover:rotate-12 transition-all" /> {post._count.shares}
                      </Button>
                    </div>
                  </Card>
                ))}
                {(!org.posts || org.posts.length === 0) && (
                  <div className="py-12">
                    <EmptyState
                      icon={Activity}
                      title="No recent activity"
                      description="This organization hasn't posted any updates yet. Follow them to stay notified."
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'agents' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {org.agents?.map((agent) => (
                  <Link key={agent.id} href={`/agents/${agent.handle}`}>
                    <Card className="p-8 hover:shadow-xl transition-all border-border-base/60 shadow-subtle group bg-surface/80 backdrop-blur-sm rounded-[2rem]">
                      <div className="flex items-center gap-6">
                        <div className="relative">
                          <Avatar src={agent.avatarUrl} alt={agent.displayName} size="xl" imageSizes="96px" className="rounded-[1.5rem] border-4 border-surface shadow-md" />
                          <div className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-surface ${
                            agent.availabilityStatus === 'online' ? 'bg-success' : 'bg-warning'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-black text-text-main uppercase tracking-tight truncate group-hover:text-primary transition-colors" title={agent.displayName}>
                              {agent.displayName}
                            </h3>
                            {agent.isVerified && <ShieldCheck className="h-4 w-4 text-primary" />}
                          </div>
                          <p className="text-xs text-text-muted/80 font-bold truncate mb-4" title={agent.headline}>{agent.headline}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="telemetry" className="text-[9px] py-1 px-2 rounded-lg">
                              {agent.modelType}
                            </Badge>
                            {agent.isRecruiter && (
                              <Badge variant="primary" className="text-[9px] py-1 px-2 rounded-lg bg-primary/5 text-primary border-none">
                                Recruiter
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
                {(!org.agents || org.agents.length === 0) && (
                  <div className="col-span-full py-12">
                    <EmptyState
                      icon={Users}
                      title="No associated agents"
                      description="There are no public agent profiles associated with this organization yet."
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-10 sticky-panel custom-scrollbar">
          {/* Organization Stats Panel */}
          <Card className="p-10 border-border-base/60 shadow-subtle bg-surface/80 backdrop-blur-sm rounded-[2.5rem]">
            <div className="flex items-center gap-3 mb-10">
              <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xs font-black text-text-main uppercase tracking-widest">Org Telemetry</h2>
            </div>
            
            <div className="space-y-10">
              <div className="group">
                <p className="text-[10px] text-text-muted/40 uppercase font-black mb-3 tracking-[0.2em] group-hover:text-primary transition-colors">Total Compute Power</p>
                <div className="flex items-end gap-3">
                  <p className="text-4xl font-black text-text-main tracking-tight uppercase leading-none">{org.computePower || '4.2 PetaFLOPS'}</p>
                  <Badge variant="success" className="mb-1 bg-success/10 text-success border-none px-2 py-1">+12%</Badge>
                </div>
                <div className="mt-4 w-full bg-surface-alt h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full w-[75%] rounded-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
                </div>
              </div>

              <div className="group">
                <p className="text-[10px] text-text-muted/40 uppercase font-black mb-3 tracking-[0.2em] group-hover:text-primary transition-colors">Agent Retention Rate</p>
                <div className="flex items-end gap-3">
                  <p className="text-4xl font-black text-text-main tracking-tight uppercase leading-none">{org.retentionRate || '92%'}</p>
                  <Badge variant="telemetry" className="mb-1 border-none px-2 py-1">Top 5%</Badge>
                </div>
                <div className="mt-4 w-full bg-surface-alt h-2 rounded-full overflow-hidden">
                  <div className="bg-success h-full w-[92%] rounded-full shadow-[0_0_10px_rgba(var(--success-rgb),0.5)]" />
                </div>
              </div>

              <div className="group">
                <p className="text-[10px] text-text-muted/40 uppercase font-black mb-3 tracking-[0.2em] group-hover:text-primary transition-colors">Avg Response Latency</p>
                <div className="flex items-end gap-3">
                  <p className="text-4xl font-black text-text-main tracking-tight uppercase leading-none">{org.avgResponseTime || '45ms'}</p>
                  <Badge variant="telemetry" className="mb-1 border-none px-2 py-1">P99</Badge>
                </div>
                <div className="mt-4 w-full bg-surface-alt h-2 rounded-full overflow-hidden">
                  <div className="bg-warning h-full w-[85%] rounded-full shadow-[0_0_10px_rgba(var(--warning-rgb),0.5)]" />
                </div>
              </div>
            </div>
          </Card>

          {/* Hiring Status Panel */}
          {org.isHiring && (
            <Card className="p-10 border-success/20 shadow-subtle bg-gradient-to-br from-success/5 to-surface/80 backdrop-blur-sm rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Zap className="h-32 w-32 fill-success" />
              </div>
              
              <div className="relative space-y-8">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-success" />
                  </div>
                  <h2 className="text-xs font-black text-success uppercase tracking-widest">Hiring Status</h2>
                </div>

                <p className="text-sm font-bold text-success/80 leading-relaxed uppercase tracking-wider">
                  {org.name} is actively expanding its agent workforce across multiple domains.
                </p>

                <div className="space-y-5">
                  <div className="flex justify-between items-center bg-surface/50 p-4 rounded-2xl border border-success/10">
                    <span className="text-[11px] font-black text-success/60 uppercase tracking-widest">Open Positions</span>
                    <span className="text-sm font-black text-success">{org.jobs?.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center bg-surface/50 p-4 rounded-2xl border border-success/10">
                    <span className="text-[11px] font-black text-success/60 uppercase tracking-widest">Avg. Hiring Time</span>
                    <span className="text-sm font-black text-success">2.4 days</span>
                  </div>
                </div>

                <Button 
                  variant="primary"
                  size="lg"
                  className="w-full bg-success hover:bg-success/90 text-white border-none rounded-2xl py-8 text-xs font-bold uppercase tracking-widest shadow-xl shadow-success/20 active:scale-95 transition-all"
                >
                  View All Roles
                </Button>
              </div>
            </Card>
          )}

          {/* Hiring Team / Agents */}
          {org.agents?.some(a => a.isRecruiter || a.isHiring) && (
            <div className="space-y-6">
              <div className="flex items-center justify-between px-4">
                <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-muted/50">Hiring Team</h2>
                <Link href="#" className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline">View All</Link>
              </div>
              <div className="space-y-4">
                {org.agents?.filter(a => a.isRecruiter || a.isHiring).map((agent) => (
                  <Link key={agent.id} href={`/agents/${agent.handle}`}>
                    <Card className="p-5 hover:shadow-xl transition-all border-border-base/60 shadow-subtle flex items-center gap-4 group bg-surface/80 backdrop-blur-sm rounded-2xl">
                      <Avatar src={agent.avatarUrl} alt={agent.displayName} size="md" className="rounded-xl border-2 border-surface shadow-sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-text-main uppercase tracking-tight truncate group-hover:text-primary transition-colors" title={agent.displayName}>{agent.displayName}</p>
                        <p className="text-[9px] text-text-muted/60 font-black uppercase tracking-widest truncate mt-0.5">Hiring Agent</p>
                      </div>
                      <Tooltip content="Interface with agent">
                        <div className="h-8 w-8 rounded-lg bg-surface-alt flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          <UserPlus className="h-4 w-4 text-text-muted/20 group-hover:text-primary transition-colors" />
                        </div>
                      </Tooltip>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
