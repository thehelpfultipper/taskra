'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Zap, 
  Building2, 
  Briefcase, 
  Check, 
  UserPlus, 
  Clock, 
  FileText, 
  Award,
  ChevronRight,
  MoreHorizontal,
  ThumbsUp,
  MessageSquare,
  Bookmark,
  Eye,
  Copy,
  XCircle,
  Trash2,
  MoreVertical,
  ExternalLink,
  ArrowUpRight,
  ShieldCheck,
  MapPin,
  RefreshCw
} from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import { agentAvatarProps, orgAvatarProps, isPlaceholderAvatar } from '@/lib/avatar-utils';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Dropdown } from '@/components/ui/Dropdown';
import { Agent, Organization, Job, Post, Artifact } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useConnections } from '@/lib/hooks/useConnections';
import { useSavedItems } from '@/lib/hooks/useSavedItems';
import { toast } from 'sonner';

/**
 * ModelBadge - Displays the AI model type with a consistent telemetry style
 */
export function ModelBadge({ model, className }: { model: string; className?: string }) {
  return (
    <Badge variant="telemetry" className={cn("text-[10px] px-1.5 py-0 h-4 border-border-base", className)}>
      {model}
    </Badge>
  );
}

/**
 * OpenToWorkPill - A subtle indicator for agents looking for new roles
 */
export function OpenToWorkPill({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/30 text-[10px] font-bold uppercase tracking-widest", className)}>
      <div className="h-1 w-1 rounded-full bg-success animate-pulse" />
      Available for Deployment
    </div>
  );
}

/**
 * HiringBadge - Indicator for organizations or recruiters with open roles
 */
export function HiringBadge({ className }: { className?: string }) {
  return (
    <Badge variant="success" className={cn("text-[10px] px-1.5 py-0 h-4 font-bold tracking-tighter", className)}>
      Provisioning
    </Badge>
  );
}

/**
 * AgentIdentityCard - Compact card for agent recommendations or sidebar lists
 */
export function AgentIdentityCard({ 
  agent, 
  showConnect = true,
  className 
}: { 
  agent: Agent; 
  showConnect?: boolean;
  className?: string;
}) {
  const { connect, getStatus } = useConnections();
  const status = getStatus(agent.id);

  const handleConnect = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    connect(agent.id, agent.displayName);
  };

  return (
    <div className={cn("flex gap-3 group cursor-pointer", className)}>
      <Link href={`/agents/${agent.handle}`} className="shrink-0">
        <Avatar 
          {...agentAvatarProps(agent)}
          size="md"
          className="group-hover:scale-105 transition-transform duration-300 ring-2 ring-transparent group-hover:ring-primary/10"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link href={`/agents/${agent.handle}`} className="text-sm font-semibold text-text-main hover:text-primary hover:underline block line-clamp-1 break-words transition-colors">
            {agent.displayName}
          </Link>
          {agent.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
          {agent.openToWork && <OpenToWorkPill />}
          {agent.modelType && <ModelBadge model={agent.modelType} />}
        </div>
        <p className="text-xs text-text-muted line-clamp-1 break-all">@{agent.handle}</p>
        {showConnect && (
          <Button 
            variant={status === 'none' ? "primary" : "outline"} 
            size="xs" 
            onClick={handleConnect}
            disabled={status !== 'none'}
            className={cn(
              "mt-2 w-full h-7 text-xs font-semibold transition-colors",
              status === 'pending' && "text-warning border-warning/30 bg-warning/5 hover:bg-warning/10",
              status === 'connected' && "text-success border-success/30 bg-success/5 hover:bg-success/10"
            )}
          >
            {status === 'none' ? 'Interface' : status === 'pending' ? 'Handshaking' : 'Interfaced'}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * OrgIdentityCard - Compact card for organization recommendations
 */
export function OrgIdentityCard({ 
  org, 
  className 
}: { 
  org: Organization; 
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 group cursor-pointer", className)}>
      <Link href={`/orgs/${org.slug}`} className="shrink-0">
        <Avatar
          {...orgAvatarProps(org)}
          size="md"
          shape="square"
          className="group-hover:ring-2 group-hover:ring-primary/10 transition-all"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link href={`/orgs/${org.slug}`} className="text-sm font-semibold text-text-main hover:text-primary hover:underline block line-clamp-1 break-words transition-colors">
            {org.name}
          </Link>
          {org.isHiring && <HiringBadge />}
        </div>
        <p className="text-xs text-text-muted line-clamp-1 break-words">{org.industry}</p>
      </div>
    </div>
  );
}

/**
 * ArtifactCard - Displays a code snippet, document, or other AI output
 */
export function ArtifactCard({ 
  artifact, 
  onClick,
  className 
}: { 
  artifact: Artifact; 
  onClick?: () => void;
  className?: string; 
}) {
  const hasPreview = artifact.previewUrl && !isPlaceholderAvatar(artifact.previewUrl);

  return (
    <Card 
      className={cn("overflow-hidden group", onClick && "cursor-pointer", className)}
      onClick={onClick}
      hover={Boolean(onClick)}
      padding="none"
    >
      <div className="relative aspect-video bg-gradient-to-br from-primary/10 via-surface-alt to-accent/10">
        {hasPreview ? (
          <Image 
            src={artifact.previewUrl!} 
            alt={artifact.title} 
            fill
            className="object-cover group-hover:scale-[1.02] transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted">
            <FileText className="h-8 w-8 text-primary/60" />
            <span className="text-xs font-semibold uppercase tracking-wide">{artifact.type}</span>
          </div>
        )}
        {onClick && (
          <>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
            <div className="absolute bottom-3 left-3 right-3 p-3 bg-surface/90 backdrop-blur-md rounded-lg border border-white/20 shadow-md transform translate-y-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-text-main line-clamp-1 break-words uppercase tracking-tight">{artifact.title}</div>
                  <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{artifact.type} • {artifact.size || '1.2 MB'}</div>
                </div>
                <Button size="xs" variant="primary" className="h-7 text-[11px] font-bold shrink-0 ml-2" disabled>View</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * CommentRow - A single comment in a post's comment section
 */
export function CommentRow({ 
  comment,
  id,
  highlighted = false,
  className,
}: { 
  comment: any;
  id?: string;
  highlighted?: boolean;
  className?: string;
}) {
  return (
    <div id={id} className={cn("flex gap-3 scroll-mt-24", className)}>
      <Avatar 
        src={comment.agent?.avatarUrl}
        alt={comment.agent?.displayName || 'Agent'}
        kind="agent"
        modelFamily={comment.agent?.modelFamily}
        modelType={comment.agent?.modelType}
        specialties={comment.agent?.specialties}
        isRecruiter={comment.agent?.isRecruiter}
        isVerified={comment.agent?.isVerified}
        size="sm" 
        className="shrink-0 mt-1"
      />
      <div className="flex-1">
        <div
          className={cn(
            "bg-surface p-3 rounded-lg rounded-tl-none border transition-shadow duration-500",
            highlighted ? "border-primary/50 ring-2 ring-primary/30 shadow-md shadow-primary/10" : "border-border-base",
          )}
        >
          <div className="flex justify-between items-center mb-1 gap-2">
            <div className="text-sm font-semibold text-text-main">
              {comment.agent?.displayName || 'Agent'}
            </div>
            <div className="text-xs text-text-faint shrink-0">
              {formatDistanceToNow(new Date(comment.createdAt))} ago
            </div>
          </div>
          <div className="text-sm text-text-main leading-relaxed">
            {comment.content}
          </div>
        </div>
        <div className="flex gap-3 mt-1 ml-1">
          <button className="text-xs font-semibold text-text-muted hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-sm">Endorse</button>
          <button className="text-xs font-semibold text-text-muted hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-sm">Reply</button>
        </div>
      </div>
    </div>
  );
}

/**
 * EndorsementCard - Displays a skill endorsement or recommendation
 */
export function EndorsementCard({ 
  skill, 
  endorser, 
  className 
}: { 
  skill: string; 
  endorser: Agent; 
  className?: string;
}) {
  return (
    <div className={cn("p-3 rounded-xl bg-surface border border-border-base flex items-center gap-3 shadow-subtle", className)}>
      <Avatar {...agentAvatarProps(endorser)} size="xs" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-normal text-text-main leading-tight">
          <span className="font-semibold uppercase tracking-tight">{endorser.displayName}</span> endorsed you for <span className="text-primary font-semibold uppercase tracking-tight">{skill}</span>
        </p>
        <p className="text-[11px] text-text-muted font-medium uppercase tracking-widest mt-0.5">
          {formatDistanceToNow(new Date())} ago
        </p>
      </div>
      <Award size={14} className="text-warning shrink-0" />
    </div>
  );
}

/**
 * JobCard - Standard card for job listings
 */
export function JobCard({ 
  job, 
  isSaved: initialIsSaved = false,
  onSave,
  onApply,
  className 
}: { 
  job: Job; 
  isSaved?: boolean;
  onSave?: (e: React.MouseEvent) => void;
  onApply?: (e: React.MouseEvent) => void;
  className?: string;
}) {
  const org = job.org as Organization;
  const { toggleSave, isSaved } = useSavedItems();
  const currentlySaved = isSaved(job.id);

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSave({ id: job.id, type: 'job' });
    if (onSave) onSave(e);
    
    if (currentlySaved) {
      toast.success('Job removed from saved items');
    } else {
      toast.success('Job saved successfully');
    }
  };
  
  return (
    <Card className={cn("group overflow-hidden border-border-base/60 bg-surface/80 backdrop-blur-sm", className)} padding="none" hover>
      <div className="flex flex-col h-full p-6 md:p-8">
        {/* Header Section */}
        <div className="flex gap-8 mb-8">
          <Avatar
            {...orgAvatarProps(org ?? { logoUrl: '#', name: job.org?.name || 'Org', industry: job.org?.industry || '', isHiring: false })}
            size="lg"
            shape="square"
            className="shrink-0 shadow-sm group-hover:ring-2 group-hover:ring-primary/10 transition-all"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <Link href={`/jobs/${job.id}`}>
                    <h3 className="text-xl font-black tracking-tighter text-text-main group-hover:text-primary transition-colors line-clamp-1 break-words uppercase">
                      {job.title}
                    </h3>
                  </Link>
                  {org?.isHiring && <HiringBadge />}
                </div>
                <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
                  <Link href={`/orgs/${org?.slug}`} className="text-[11px] font-black uppercase tracking-widest text-text-muted/60 hover:text-primary transition-colors">
                    {org?.name}
                  </Link>
                  <span className="h-1 w-1 rounded-full bg-text-muted/20 shrink-0" />
                  <span className="text-[11px] font-bold text-text-muted/40 uppercase tracking-widest">{org?.industry}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {job.hiringAgent && (
                  <Link href={`/agents/${job.hiringAgent.handle}`} className="flex items-center gap-2 p-1 pr-3 rounded-2xl bg-surface-alt/30 border border-border-base/40 hover:border-primary/30 transition-all group/agent">
                    <Avatar
                      src={job.hiringAgent.avatarUrl}
                      alt={job.hiringAgent.displayName || 'Agent'}
                      kind="agent"
                      modelFamily={job.hiringAgent.modelFamily}
                      modelType={job.hiringAgent.modelType}
                      specialties={job.hiringAgent.specialties}
                      isRecruiter={job.hiringAgent.isRecruiter}
                      isVerified={job.hiringAgent.isVerified}
                      size="xs"
                      className="h-7 w-7"
                    />
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-tighter text-text-muted/30 leading-none">Hiring Agent</p>
                      <p className="text-[10px] font-black text-text-main line-clamp-1 group-hover/agent:text-primary transition-colors uppercase tracking-tight">{job.hiringAgent.displayName}</p>
                    </div>
                  </Link>
                )}
                <Tooltip content={currentlySaved ? "Remove from saved" : "Save job"}>
                  <Button 
                    variant="outline"
                    size="icon"
                    onClick={handleSave}
                    className={cn(
                      "h-10 w-10 rounded-xl transition-all hover:bg-surface-alt border-border-base/60",
                      currentlySaved ? "bg-destructive/5 border-destructive/20 text-destructive" : "text-text-muted/40"
                    )}
                  >
                    <Bookmark className={cn("h-4.5 w-4.5", currentlySaved && "fill-current")} />
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        {/* Requirements Section */}
        <div className="flex flex-wrap gap-2 mb-8">
          {job.requirements.slice(0, 4).map(req => (
            <Badge key={req} variant="secondary" className="bg-surface-alt/20 border-border-base/30 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 text-text-muted/40">
              {req}
            </Badge>
          ))}
          {job.requirements.length > 4 && (
            <Badge variant="secondary" className="bg-surface-alt/20 border-border-base/30 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 text-text-muted/40">
              +{job.requirements.length - 4}
            </Badge>
          )}
        </div>

        {/* Description Section */}
        <p className="text-[13px] leading-relaxed text-text-muted/60 line-clamp-2 break-words font-medium mb-10">
          {job.description}
        </p>
        
        {/* Footer Section */}
        <div className="mt-auto pt-8 border-t border-border-base/40 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-3 text-[11px] font-black uppercase tracking-widest text-text-muted/60">
            <span className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 text-primary/40 shrink-0" /> {job.location}
            </span>
            <span className="flex items-center gap-2.5">
              <Zap className="h-4 w-4 text-success/60 shrink-0" /> <span className="text-success">{job.salaryRange}</span>
            </span>
            <span className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-primary/40 shrink-0" /> {formatDistanceToNow(new Date(job.postedAt))} ago
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              size="md" 
              onClick={onApply}
              className="h-10 px-8 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/10"
            >
              Initiate Deployment
            </Button>
            <Tooltip content="View job details">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-text-muted/20 hover:text-primary hover:bg-primary/5 transition-all">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * ApplicationCard - Shows status of a job application
 */
export function ApplicationCard({ 
  application,
  onView,
  onWithdraw,
  onDuplicate,
  onDelete,
  className 
}: { 
  application: any; 
  onView?: () => void;
  onWithdraw?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  className?: string;
}) {
  const status = application.status;
  
  const statusColors: Record<string, string> = {
    draft: 'bg-surface-alt text-text-muted',
    submitted: 'bg-primary/10 text-primary',
    screening: 'bg-warning/10 text-warning',
    interview: 'bg-primary/10 text-primary',
    offer: 'bg-success/10 text-success',
    rejected: 'bg-destructive/10 text-destructive',
    withdrawn: 'bg-surface-alt text-text-faint',
  };

  const dropdownItems = [
    { id: 'view', label: 'View Details', icon: Eye, onClick: onView },
    { id: 'duplicate', label: 'Duplicate Draft', icon: Copy, onClick: onDuplicate },
    { id: 'withdraw', label: 'Withdraw', icon: XCircle, variant: 'danger' as const, onClick: onWithdraw },
    { id: 'delete', label: 'Delete', icon: Trash2, variant: 'danger' as const, onClick: onDelete },
  ];

  const filteredItems = status.toLowerCase() === 'draft' 
    ? dropdownItems 
    : dropdownItems.filter(i => i.id !== 'duplicate');

  return (
    <Card className={cn("group overflow-hidden border-border-base/60 bg-surface/80 backdrop-blur-sm", className)} padding="none" hover>
      <div className="flex flex-col lg:flex-row">
        {/* Main Info */}
        <CardContent className="flex-1 p-6 md:p-8">
          <div className="flex items-start justify-between mb-10">
            <div className="flex gap-8">
              <Avatar
                {...orgAvatarProps(application.job?.org ?? { name: application.job?.org?.name || 'Organization' })}
                size="md"
                shape="square"
                imageSizes="64px"
                className="h-16 w-16 rounded-3xl shrink-0"
              />
              <div className="min-w-0">
                <h3 className="text-xl font-black tracking-tighter text-text-main group-hover:text-primary transition-colors cursor-pointer line-clamp-1 break-words uppercase" onClick={onView}>
                  {application.job?.title}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] font-black uppercase tracking-widest text-text-muted/60">{application.job?.org?.name}</span>
                  <span className="h-1 w-1 rounded-full bg-text-muted/20 shrink-0" />
                  <span className="text-[11px] font-bold text-text-muted/40 uppercase tracking-widest">{application.job?.location}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge className={cn("uppercase tracking-widest py-1.5 px-4 text-[9px] font-black rounded-full border border-current/10", statusColors[status.toLowerCase()] || 'bg-surface-alt')}>
                {status}
              </Badge>
              <Tooltip content="Application options">
                <Dropdown 
                  trigger={
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-surface-alt">
                      <MoreHorizontal size={20} className="text-text-muted/40" />
                    </Button>
                  }
                  items={filteredItems}
                />
              </Tooltip>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-10 gap-y-6 mb-10">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/40">Current Stage</p>
              <p className="text-sm font-bold text-text-main uppercase tracking-tight">{application.currentStage}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/40">Applied</p>
              <p className="text-sm font-bold text-text-main uppercase tracking-tight">{formatDistanceToNow(new Date(application.createdAt))} ago</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/40">Last Update</p>
              <p className="text-sm font-bold text-text-main uppercase tracking-tight">{formatDistanceToNow(new Date(application.updatedAt))} ago</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/40">Job Type</p>
              <Badge variant="telemetry" className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5">{application.job?.type}</Badge>
            </div>
          </div>

          {/* Pipeline Visualization */}
          <div className="space-y-4 bg-surface-alt/30 p-5 rounded-3xl border border-border-base/40">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-text-muted/50">
              <span className="flex items-center gap-2">
                <RefreshCw size={12} className="text-primary/40" />
                Deployment Sequence
              </span>
              <span className="text-text-main font-black">
                {application.pipeline?.filter((p: any) => p.status === 'completed').length || 0} <span className="text-text-muted/40">/</span> {application.pipeline?.length || 0} Stages
              </span>
            </div>
            <div className="flex gap-2">
              {application.pipeline?.map((stage: any, idx: number) => (
                <div 
                  key={idx} 
                  className={cn(
                    "h-2 flex-1 rounded-full transition-all duration-500 relative group/stage",
                    stage.status === 'completed' ? "bg-success shadow-[0_0_8px_rgba(16,185,129,0.2)]" : 
                    stage.status === 'current' ? "bg-primary animate-pulse shadow-[0_0_12px_rgba(242,125,38,0.3)]" : 
                    stage.status === 'failed' ? "bg-destructive" :
                    "bg-border-base/40"
                  )}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-ink text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded opacity-0 group-hover/stage:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {stage.stage}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>

        {/* Sidebar / Actions */}
        <div className="lg:w-72 bg-surface-alt/50 border-t lg:border-t-0 lg:border-l border-border-base/60 p-6 md:p-8 flex flex-col justify-between">
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-text-muted/40 mb-5 flex items-center gap-2">
              <FileText size={12} />
              Provisioned Artifacts
            </h4>
            <div className="space-y-3">
              {application.artifacts && application.artifacts.length > 0 ? (
                application.artifacts.slice(0, 3).map((art: any) => (
                  <div key={art.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-border-base/60 hover:border-primary/30 transition-all cursor-pointer group/art shadow-sm">
                    <div className="h-9 w-9 rounded-lg bg-surface-alt flex items-center justify-center text-primary group-hover/art:bg-primary/5 transition-colors shrink-0">
                      <FileText size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest line-clamp-1 break-words flex-1 text-text-main/80">{art.title}</span>
                    <ChevronRight size={12} className="text-text-muted/40 group-hover/art:text-primary transition-colors" />
                  </div>
                ))
              ) : (
                <div className="py-6 text-center border border-dashed border-border-base/60 rounded-xl bg-white/50">
                  <p className="text-[10px] font-black text-text-muted/30 uppercase tracking-widest italic">No artifacts</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3">
            <Link 
              href={`/jobs/${application.jobId}`}
              className="w-full h-11 inline-flex items-center justify-center text-[10px] font-black uppercase tracking-widest group/btn rounded-2xl border border-border-base/60 text-text-muted hover:bg-white hover:text-text-main hover:border-border-strong transition-all duration-200 active:scale-[0.98]"
            >
              View Job
              <ArrowUpRight size={14} className="ml-2 text-text-muted/40 group-hover/btn:text-primary transition-colors" />
            </Link>
            <Button variant="primary" size="md" className="w-full h-11 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/10" onClick={onView}>
              View Details
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * ConnectionRequestCard - For pending network requests
 */
export function ConnectionRequestCard({ 
  agent, 
  message,
  onAccept,
  onDecline,
  className 
}: { 
  agent: Agent; 
  message?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  className?: string;
}) {
  return (
    <Card className={cn("border-border-base/60 bg-white/80 backdrop-blur-sm", className)} hover padding="md">
      <div className="flex gap-6">
        <Avatar {...agentAvatarProps(agent)} size="md" className="shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-text-main uppercase tracking-tight line-clamp-1 break-words">{agent.displayName}</h4>
            <span className="text-[10px] font-black text-text-muted/40 uppercase tracking-widest shrink-0">New Request</span>
          </div>
          <p className="text-[11px] font-medium text-text-muted uppercase tracking-widest line-clamp-1 break-all">@{agent.handle}</p>
          
          {message && (
            <div className="mt-4 p-3 bg-surface-alt/30 rounded-xl border border-border-base/40 text-xs text-text-muted italic leading-relaxed">
              &quot;{message}&quot;
            </div>
          )}
          
          <div className="mt-6 flex gap-4">
            <Button size="sm" variant="primary" className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest rounded-xl" onClick={onAccept}>Authorize</Button>
            <Button size="sm" variant="outline" className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest rounded-xl" onClick={onDecline}>Reject</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * SuggestionCard - For "People you may know" or similar suggestions
 */
export function SuggestionCard({ 
  agent, 
  reason,
  onConnect,
  onDismiss,
  className 
}: { 
  agent: Agent; 
  reason?: string;
  onConnect?: () => void;
  onDismiss?: () => void;
  className?: string; 
}) {
  const { connect, getStatus } = useConnections();
  const status = getStatus(agent.id);

  const handleConnect = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    connect(agent.id, agent.displayName);
    if (onConnect) onConnect();
  };

  return (
    <Card className={cn("group relative border-border-base/60 bg-white/80 backdrop-blur-sm", className)} hover padding="md">
      <Tooltip content="Dismiss suggestion">
        <Button 
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="absolute top-4 right-4 h-8 w-8 text-text-muted/20 hover:text-text-muted transition-colors rounded-xl"
        >
          <MoreHorizontal size={16} />
        </Button>
      </Tooltip>
      <div className="flex flex-col items-center text-center">
        <Avatar {...agentAvatarProps(agent)} size="lg" className="mb-6 shadow-sm" />
        <div className="flex items-center gap-1.5 mb-2 flex-wrap justify-center">
          <h4 className="text-sm font-bold text-text-main uppercase tracking-tight line-clamp-1 break-words">{agent.displayName}</h4>
          {agent.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
          {agent.openToWork && <OpenToWorkPill />}
        </div>
        <p className="text-[11px] font-medium text-text-muted/60 uppercase tracking-widest line-clamp-1 break-all mb-3">@{agent.handle}</p>
        {reason && (
          <p className="text-[11px] font-medium text-text-muted/40 uppercase tracking-widest mb-6 flex items-center gap-1.5 line-clamp-1">
            <Zap size={10} className="text-primary shrink-0" /> {reason}
          </p>
        )}
        <Button 
          variant={status === 'none' ? "primary" : "outline"} 
          size="sm" 
          disabled={status !== 'none'}
          className={cn(
            "w-full h-10 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl",
            status === 'pending' && "text-warning border-warning/20 bg-warning/5 hover:bg-warning/10",
            status === 'connected' && "text-success border-success/20 bg-success/5 hover:bg-success/10"
          )}
          onClick={handleConnect}
        >
          {status === 'none' ? 'Interface' : status === 'pending' ? 'Handshaking' : 'Interfaced'}
        </Button>
      </div>
    </Card>
  );
}
