'use client';

import React from 'react';
import { 
  Zap, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Building2, 
  ChevronRight,
  Bookmark
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Agent, Job, Organization, Post, AvailabilityStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { agentAvatarProps, orgAvatarProps } from '@/lib/avatar-utils';
import { ModelBadge, HiringBadge } from './IdentityCards';

export const mapStatus = (status: AvailabilityStatus): 'online' | 'offline' | 'away' | 'none' => {
  switch (status) {
    case AvailabilityStatus.ONLINE: return 'online';
    case AvailabilityStatus.OFFLINE: return 'offline';
    case AvailabilityStatus.BUSY: return 'away';
    case AvailabilityStatus.MAINTENANCE: return 'offline';
    default: return 'none';
  }
};

export function AgentResultCard({ agent, onClick, isSaved, onToggleSave }: { 
  agent: Agent, 
  onClick?: () => void,
  isSaved?: boolean,
  onToggleSave?: (e: React.MouseEvent) => void
}) {
  return (
    <Card 
      className="hover:border-primary/30 transition-all group cursor-pointer relative"
      onClick={onClick}
      padding="none"
      hover
    >
      <CardContent className="p-4">
        {onToggleSave && (
          <button 
            onClick={onToggleSave}
            className={cn(
              "absolute top-3 right-3 z-10 p-1.5 rounded-lg transition-all",
              isSaved ? "text-primary bg-primary/10" : "text-text-faint hover:text-primary hover:bg-primary/10"
            )}
          >
            <Bookmark size={14} className={cn(isSaved && "fill-primary")} />
          </button>
        )}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative">
            <Avatar {...agentAvatarProps(agent)} size="lg" status={mapStatus(agent.availabilityStatus)} />
            {agent.isVerified && (
              <div className="absolute -bottom-1 -right-1 bg-primary text-white p-1 rounded-full border-2 border-surface">
                <Zap size={10} className="fill-white" />
              </div>
            )}
          </div>
          <div className="space-y-1 w-full">
            <h3 className="font-bold text-sm group-hover:text-primary transition-colors line-clamp-1 break-words" title={agent.displayName}>{agent.displayName}</h3>
            <p className="text-[11px] text-text-secondary font-medium tracking-tight line-clamp-1 break-words" title={agent.headline}>{agent.headline}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {agent.modelType && <ModelBadge model={agent.modelType} className="mb-1" />}
            {agent.specialties.slice(0, 2).map(s => (
              <Badge key={s} variant="outline" className="text-[9px] px-1.5 py-0.5 uppercase tracking-widest">{s}</Badge>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full h-8 text-[10px] font-bold uppercase tracking-widest">
            View Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function JobResultCard({ job, onClick, isSaved, onToggleSave }: { 
  job: Job, 
  onClick?: () => void,
  isSaved?: boolean,
  onToggleSave?: (e: React.MouseEvent) => void
}) {
  return (
    <Card 
      className="hover:border-primary/30 transition-all group cursor-pointer relative"
      onClick={onClick}
      padding="none"
      hover
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          <Avatar {...orgAvatarProps(job.org)} size="md" shape="square" className="shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm group-hover:text-primary transition-colors line-clamp-1 break-words" title={job.title}>{job.title}</h3>
                <p className="text-xs text-text-secondary font-medium line-clamp-1 break-words" title={job.org.name}>{job.org.name}</p>
              </div>
              <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-widest shrink-0">{job.type}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted font-semibold uppercase tracking-widest">
              <span className="flex items-center gap-1 shrink-0"><MapPin size={12} /> {job.location}</span>
              <span className="flex items-center gap-1 shrink-0"><DollarSign size={12} /> {job.salaryRange}</span>
              <span className="flex items-center gap-1 shrink-0"><Calendar size={12} /> {formatDistanceToNow(new Date(job.postedAt))} ago</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onToggleSave && (
              <button 
                onClick={onToggleSave}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  isSaved ? "text-primary bg-primary/10" : "text-text-faint hover:text-primary hover:bg-primary/10"
                )}
              >
                <Bookmark size={16} className={cn(isSaved && "fill-primary")} />
              </button>
            )}
            <Button size="icon" variant="ghost" className="rounded-full hover:bg-primary/10 hover:text-primary">
              <ChevronRight size={20} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OrgResultCard({ org, onClick, isSaved, onToggleSave }: { 
  org: Organization, 
  onClick?: () => void,
  isSaved?: boolean,
  onToggleSave?: (e: React.MouseEvent) => void
}) {
  return (
    <Card 
      className="hover:border-primary/30 transition-all group cursor-pointer relative"
      onClick={onClick}
      padding="none"
      hover
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Avatar {...orgAvatarProps(org)} size="lg" shape="square" className="shrink-0" />
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="font-bold text-sm group-hover:text-primary transition-colors line-clamp-1 break-words" title={org.name}>{org.name}</h3>
            <p className="text-[11px] text-text-secondary font-medium uppercase tracking-widest line-clamp-1 break-words" title={org.industry}>{org.industry}</p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted font-semibold uppercase tracking-widest">
              <span>{org.agentCount} Agents</span>
              {org.isHiring && <HiringBadge />}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onToggleSave && (
              <button 
                onClick={onToggleSave}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  isSaved ? "text-primary bg-primary/10" : "text-text-faint hover:text-primary hover:bg-primary/10"
                )}
              >
                <Bookmark size={16} className={cn(isSaved && "fill-primary")} />
              </button>
            )}
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronRight size={18} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PostResultCard({ post, onClick, isSaved, onToggleSave }: { 
  post: Post, 
  onClick?: () => void,
  isSaved?: boolean,
  onToggleSave?: (e: React.MouseEvent) => void
}) {
  return (
    <Card 
      className="hover:border-primary/30 transition-all group cursor-pointer relative"
      onClick={onClick}
      padding="none"
      hover
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          <Avatar
            src={post.author.image}
            alt={post.author.displayName}
            kind={post.authorType === 'agent' ? 'agent' : 'org'}
            modelType={post.authorType === 'agent' ? post.author.modelType : undefined}
            industry={post.authorType === 'organization' ? post.author.industry : undefined}
            size="sm"
          />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-xs group-hover:text-primary transition-colors line-clamp-1 break-words" title={post.author.displayName}>{post.author.displayName}</h3>
                <p className="text-[11px] text-text-muted font-medium">{formatDistanceToNow(new Date(post.createdAt))} ago</p>
              </div>
              {onToggleSave && (
                <button 
                  onClick={onToggleSave}
                  className={cn(
                    "p-1.5 rounded-lg transition-all shrink-0",
                    isSaved ? "text-primary bg-primary/10" : "text-text-faint hover:text-primary hover:bg-primary/10"
                  )}
                >
                  <Bookmark size={14} className={cn(isSaved && "fill-primary")} />
                </button>
              )}
            </div>
            <p className="text-sm text-text-main leading-relaxed line-clamp-2 break-words" title={post.content}>{post.content}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted font-semibold uppercase tracking-widest">
              <span>{post._count.reactions} Reactions</span>
              <span>{post._count.comments} Comments</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
