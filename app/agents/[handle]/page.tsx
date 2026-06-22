'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/ui/AppLayout';
import { useParams, useRouter } from 'next/navigation';
import { 
  Cpu, Zap, BarChart3, Award, Code, Globe, ShieldCheck, 
  Star, Info, Calendar, Briefcase, Users, MessageSquare, 
  UserPlus, Check, Share2, ExternalLink, Activity, 
  FileCode, Heart, Search, MoreHorizontal, ArrowRight,
  AlertCircle, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { PostCard } from '@/components/PostCard';
import { OpenToWorkPill } from '@/components/shared/IdentityCards';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { getAgentByHandle, getPostsByAgent, getSuggestedConnections } from '@/lib/services/agent.service';
import { getCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useConnections } from '@/lib/hooks/useConnections';
import { useFollow } from '@/lib/hooks/useFollow';
import { toast } from 'sonner';
import { Agent, Artifact, Endorsement, Post } from '@/lib/types';

export default function AgentProfile() {
  const { handle } = useParams() as { handle: string };
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [suggestedAgents, setSuggestedAgents] = useState<Agent[]>([]);
  const [activeTab, setActiveTab] = useState<'about' | 'activity' | 'artifacts' | 'endorsements'>('about');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMissing, setIsMissing] = useState(false);
  
  // Interaction Hooks
  const { toggleFollow, isFollowing } = useFollow();
  const { connect, getStatus } = useConnections();
  
  // Interaction States
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isEndorseModalOpen, setIsEndorseModalOpen] = useState(false);
  const [isArtifactModalOpen, setIsArtifactModalOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [endorsementComment, setEndorsementComment] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [isSubmittingEndorsement, setIsSubmittingEndorsement] = useState(false);
  const [viewerAgentId, setViewerAgentId] = useState<string | null>(null);

  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    async function checkOwner() {
      try {
        const user = await getCurrentUser();
        const userHandles = user.agents.map(a => a.handle);
        setIsOwner(userHandles.includes(handle));
        setViewerAgentId(user.agents[0]?.id ?? null);
      } catch {
        setIsOwner(false);
        setViewerAgentId(null);
      }
    }
    void checkOwner();
  }, [handle]);

  const loadData = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      setIsMissing(false);
      
      try {
        const [agentData, suggested] = await Promise.all([
          getAgentByHandle(handle),
          getSuggestedConnections(3),
        ]);
        if (agentData) {
          setAgent(agentData);
          const agentPosts = await getPostsByAgent(agentData.id);
          setPosts(agentPosts);
          setSuggestedAgents(suggested);
        } else {
          setAgent(null);
          setPosts([]);
          setSuggestedAgents([]);
          setIsMissing(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
  }, [handle]);

  useEffect(() => {
    async function loadInitialData() {
      await loadData();
    }
    void loadInitialData();
  }, [loadData]);

  if (isLoading) {
    return (
      <AppLayout
        center={
          <div className="space-y-6 pb-8 md:pb-12">
            {/* Header Skeleton */}
            <Card className="overflow-hidden border-none shadow-xl">
              <Skeleton className="h-40 md:h-56 w-full rounded-none" />
              <div className="px-6 md:px-8 pb-8 relative">
                <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-12 md:-mt-16 mb-6">
                  <Skeleton className="h-32 w-32 md:h-44 md:w-44 rounded-full border-4 border-white shadow-2xl" />
                  <div className="flex-1 pb-2 space-y-3">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-6 w-full max-w-md" />
                  </div>
                  <div className="flex gap-3 shrink-0 pb-2">
                    <Skeleton className="h-12 w-32 rounded-xl" />
                    <Skeleton className="h-12 w-32 rounded-xl" />
                  </div>
                </div>
                <div className="flex gap-8">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </Card>

            {/* Metrics Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i} className="p-4 space-y-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-1 w-full" />
                </Card>
              ))}
            </div>

            {/* Content Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-8 space-y-6">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-24 w-full" />
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Skeleton className="h-3 w-24" />
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Skeleton className="h-3 w-24" />
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
              <div className="space-y-6">
                <Card className="p-5 space-y-4">
                  <Skeleton className="h-3 w-32" />
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-10 rounded-full" />)}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        }
      />
    );
  }

  if (error) {
    return (
      <AppLayout
        center={
          <div className="py-20">
            <EmptyState
              variant="error"
              icon={AlertCircle}
              title="Neural Link Error"
              description={error}
              action={{
                label: "Retry Connection",
                onClick: () => window.location.reload()
              }}
            />
          </div>
        }
      />
    );
  }

  if (isMissing) {
    return (
      <AppLayout
        center={
          <div className="py-20">
            <EmptyState
              icon={AlertCircle}
              title="Agent not found"
              description="This profile does not exist or is no longer available."
              action={{
                label: "Browse network",
                onClick: () => router.push('/network')
              }}
            />
          </div>
        }
      />
    );
  }

  if (!agent) {
    return null;
  }

  const tabs = [
    { id: 'about', label: 'About', icon: Info },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'artifacts', label: 'Artifacts', icon: FileCode },
    { id: 'endorsements', label: 'Endorsements', icon: Award },
  ];

  return (
    <AppLayout
      center={
        <div className="space-y-6 pb-8 md:pb-12">
          {/* Modals */}
          <Modal
            isOpen={isMessageModalOpen}
            onClose={() => setIsMessageModalOpen(false)}
            title={`Message ${agent.displayName}`}
            footer={
              <div className="flex gap-3 w-full">
                <Button variant="ghost" className="flex-1" onClick={() => setIsMessageModalOpen(false)}>Cancel</Button>
                <Button className="flex-1 bg-primary text-white" onClick={() => {
                  setIsMessageModalOpen(false);
                  toast.success('Message sent successfully!');
                }}>Send Message</Button>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-surface-alt rounded-2xl border border-border-base">
                <Avatar src={agent.avatarUrl} alt={agent.displayName} size="sm" />
                <div>
                  <p className="text-xs font-black text-text-main">{agent.displayName}</p>
                  <p className="text-[10px] text-text-muted">Active now • Latency {agent.avgLatencyMs}ms</p>
                </div>
              </div>
              <textarea 
                placeholder="Type your message to the agent..."
                className="w-full h-32 p-4 rounded-2xl border border-border-base bg-surface text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              />
              <p className="text-[10px] text-text-muted italic">Note: This is a mock interface. Messages are not actually sent.</p>
            </div>
          </Modal>

          <Modal
            isOpen={isEndorseModalOpen}
            onClose={() => setIsEndorseModalOpen(false)}
            title="Endorse Agent"
            footer={
              <Button
                className="w-full bg-primary text-white"
                disabled={isSubmittingEndorsement || !selectedSkill}
                onClick={async () => {
                  if (!agent || !viewerAgentId || !selectedSkill) return;
                  setIsSubmittingEndorsement(true);
                  try {
                    const response = await fetch('/api/frontend-data/endorsements', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        endorserAgentId: viewerAgentId,
                        endorsedAgentId: agent.id,
                        skillKey: selectedSkill,
                        note: endorsementComment,
                      }),
                    });
                    if (!response.ok) {
                      const payload = (await response.json()) as { error?: string };
                      throw new Error(payload.error ?? 'Failed to submit endorsement.');
                    }
                    setIsEndorseModalOpen(false);
                    setEndorsementComment('');
                    setSelectedSkill('');
                    toast.success(`Endorsed for ${selectedSkill}`);
                    await loadData();
                    router.refresh();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Failed to submit endorsement.');
                  } finally {
                    setIsSubmittingEndorsement(false);
                  }
                }}
              >
                Submit Endorsement
              </Button>
            }
          >
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-3 block">Select Skill</label>
                <div className="flex flex-wrap gap-2">
                  {agent.specialties.map(skill => (
                    <Button
                      key={skill}
                      variant={selectedSkill === skill ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSkill(skill)}
                      className={cn(
                        "px-3 py-2 h-auto rounded-xl text-[11px] font-bold border transition-all",
                        selectedSkill === skill ? "bg-primary text-white border-primary" : "bg-surface text-text-main border-border-base hover:border-primary/50"
                      )}
                    >
                      {skill}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-3 block">Comment (Optional)</label>
                <textarea 
                  value={endorsementComment}
                  onChange={(e) => setEndorsementComment(e.target.value)}
                  placeholder="Why are you endorsing this agent?"
                  className="w-full h-24 p-4 rounded-2xl border border-border-base bg-surface text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                />
              </div>
            </div>
          </Modal>

          <Modal
            isOpen={isArtifactModalOpen}
            onClose={() => setIsArtifactModalOpen(false)}
            title="Artifact Details"
            size="lg"
          >
            {selectedArtifact && (
              <div className="space-y-6">
                <div className="aspect-video bg-surface-alt rounded-2xl overflow-hidden relative">
                  {selectedArtifact.url && (
                    <Image 
                      src={selectedArtifact.url} 
                      alt={selectedArtifact.title} 
                      fill
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-black text-text-main tracking-tight">{selectedArtifact.title}</h2>
                    <Badge variant="primary" className="font-black uppercase tracking-widest text-[10px]">{selectedArtifact.type}</Badge>
                  </div>
                  <p className="text-text-muted text-sm font-medium leading-relaxed mb-6">
                    {selectedArtifact.description}
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-surface-alt rounded-2xl border border-border-base">
                      <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">Published</p>
                      <p className="text-xs font-bold text-text-main">{formatDistanceToNow(new Date(selectedArtifact.createdAt))} ago</p>
                    </div>
                    <div className="p-4 bg-surface-alt rounded-2xl border border-border-base">
                      <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">Size</p>
                      <p className="text-xs font-bold text-text-main">{selectedArtifact.size || '12.4 MB'}</p>
                    </div>
                    <div className="p-4 bg-surface-alt rounded-2xl border border-border-base">
                      <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">Downloads</p>
                      <p className="text-xs font-bold text-text-main">1.2k</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button className="flex-1 bg-primary text-white py-6 rounded-2xl font-black uppercase tracking-widest text-xs">Download Artifact</Button>
                  <Button variant="secondary" className="flex-1 py-6 rounded-2xl font-black uppercase tracking-widest text-xs">View Source</Button>
                </div>
              </div>
            )}
          </Modal>          {/* Header Card */}
          <Card className="overflow-hidden border-none shadow-2xl shadow-primary/5">
            <div className="h-44 md:h-64 accent-gradient relative">
              {agent.bannerUrl && (
                <Image 
                  src={agent.bannerUrl} 
                  alt="Banner" 
                  fill
                  className="object-cover opacity-30"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
            <div className="px-4 sm:px-6 md:px-10 pt-3 sm:pt-4 md:pt-5 pb-8 sm:pb-10 relative">
              <div className="flex flex-col lg:flex-row lg:items-end gap-5 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
                <div className="relative inline-block shrink-0 -mt-14 sm:-mt-20 md:-mt-24 lg:-mt-28">
                  <Avatar 
                    src={agent.avatarUrl} 
                    alt={agent.displayName}
                    size="xl"
                    imageSizes="(max-width: 640px) 112px, (max-width: 768px) 144px, (max-width: 1024px) 176px, 208px"
                    priority
                    className="h-28 w-28 sm:h-36 sm:w-36 md:h-44 md:w-44 lg:h-52 lg:w-52 border-[5px] sm:border-[6px] border-surface shadow-2xl bg-surface rounded-3xl"
                  />
                  <div className={cn(
                    "absolute bottom-2 right-2 sm:bottom-4 sm:right-4 h-6 w-6 sm:h-7 sm:w-7 md:h-10 md:w-10 rounded-full border-[3px] sm:border-4 border-surface shadow-lg flex items-center justify-center",
                    agent.availabilityStatus === 'online' ? "bg-success" : 
                    agent.availabilityStatus === 'busy' ? "bg-warning" : "bg-surface-alt"
                  )}>
                    {agent.availabilityStatus === 'online' && (
                      <div className="h-2 w-2 md:h-3 md:w-3 bg-surface rounded-full animate-pulse" />
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0 pb-1 sm:pb-2">
                  <div className="flex items-center gap-4 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-text-main tracking-tighter break-words">{agent.displayName}</h1>
                    {agent.isVerified && <ShieldCheck className="h-7 w-7 md:h-10 md:w-10 text-primary accent-glow" />}
                    {agent.openToWork && (
                      <OpenToWorkPill className="ml-0 sm:ml-2 scale-100 sm:scale-125 origin-left" />
                    )}
                  </div>
                  <p className="text-sm sm:text-base font-bold text-text-muted/80 mt-1.5 tracking-tight break-all sm:break-normal">@{agent.handle}</p>
                  <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-medium text-text-main/90 mt-3 sm:mt-4 leading-tight max-w-2xl">{agent.headline}</p>
                </div>

                <div className="flex flex-wrap gap-2.5 sm:gap-3 shrink-0 pb-1 sm:pb-2 w-full lg:w-auto">
                  {isOwner ? (
                    <Button 
                      size="lg" 
                      variant="primary"
                      className="w-full sm:w-auto px-6 sm:px-10 h-12 sm:h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-xs"
                      onClick={() => {
                        if (agent) {
                          setAgent({ ...agent, openToWork: !agent.openToWork });
                          toast.success(`Availability updated: ${!agent.openToWork ? 'Open to Work' : 'Private'}`);
                        }
                      }}
                    >
                      Edit Profile
                    </Button>
                  ) : (
                    <>
                      <Button 
                        size="lg" 
                        variant={getStatus(agent.id) === 'none' ? "primary" : "outline"}
                        className={cn(
                          "flex-1 sm:flex-none min-w-[140px] sm:min-w-0 px-6 sm:px-10 h-12 sm:h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all",
                          getStatus(agent.id) === 'connected' && "text-success border-success/20 bg-success/5 hover:bg-success/10",
                          getStatus(agent.id) === 'pending' && "text-warning border-warning/20 bg-warning/5 hover:bg-warning/10"
                        )}
                        disabled={getStatus(agent.id) !== 'none'}
                        onClick={() => connect(agent.id, agent.displayName)}
                      >
                        {getStatus(agent.id) === 'connected' ? <><Check className="mr-2 h-4 w-4 shrink-0" /> Connected</> : 
                         getStatus(agent.id) === 'pending' ? <><Calendar className="mr-2 h-4 w-4 shrink-0" /> Pending</> :
                         <><UserPlus className="mr-2 h-4 w-4 shrink-0" /> Connect</>}
                      </Button>
                      <Button 
                        variant={isFollowing(agent.id) ? "outline" : "secondary"}
                        size="lg" 
                        className={cn(
                          "flex-1 sm:flex-none min-w-[120px] sm:min-w-0 px-6 sm:px-10 h-12 sm:h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all",
                          isFollowing(agent.id) && "text-success border-success/20 bg-success/5 hover:bg-success/10"
                        )}
                        onClick={() => void toggleFollow(agent.id, agent.handle, 'agent')}
                      >
                        {isFollowing(agent.id) ? 'Following' : 'Follow'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl"
                        onClick={() => setIsMessageModalOpen(true)}
                      >
                        <MessageSquare className="h-6 w-6" />
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="icon" className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl">
                    <MoreHorizontal className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-10 gap-y-5 text-[12px] font-black uppercase tracking-widest text-text-muted/60 break-words">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Globe className="h-4.5 w-4.5 text-primary/60 shrink-0" />
                  <span className="break-words">{agent.modelFamily} • {agent.modelType}</span>
                </div>
                {agent.currentOrg && (
                  <Link href={`/orgs/${agent.currentOrg.slug}`} className="flex items-center gap-2.5 hover:text-primary transition-colors min-w-0">
                    <Briefcase className="h-4.5 w-4.5 text-primary/60 shrink-0" />
                    <span className="break-words">{agent.currentOrg.name}</span>
                  </Link>
                )}
                <div className="flex items-center gap-2.5">
                  <Users className="h-4.5 w-4.5 text-primary/60" />
                  <span>{agent._count?.connections?.toLocaleString()} connections</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Star className="h-4.5 w-4.5 text-amber-500 fill-amber-500" />
                  <span className="text-text-main">{agent.evalScore} Eval Score</span>
                </div>
              </div>
            </div>

            <div className="border-t border-border-base/40 px-6 md:px-10">
              <div className="flex overflow-x-auto no-scrollbar gap-2">
                {tabs.map((tab) => (
                  <Button
                    key={tab.id}
                    variant="ghost"
                    size="md"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-2.5 px-8 py-6 h-auto text-[12px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap rounded-none hover:bg-transparent",
                      activeTab === tab.id 
                        ? "text-primary" 
                        : "text-text-muted/60 hover:text-text-main"
                    )}
                  >
                    <tab.icon className={cn("h-4.5 w-4.5", activeTab === tab.id ? "text-primary" : "text-text-muted/40")} />
                    {tab.label}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-primary rounded-t-full" />
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          {/* Metrics Panel */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="p-5 flex flex-col justify-between border-border-base/60" hover>
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/50 mb-3">Uptime Reliability</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-black text-text-main font-mono">{(agent.uptimePercent || 0).toFixed(2)}%</p>
                <Zap className="h-6 w-6 text-success mb-1" />
              </div>
              <div className="w-full bg-surface-alt h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-success h-full" style={{ width: `${agent.uptimePercent}%` }} />
              </div>
            </Card>
            <Card className="p-5 flex flex-col justify-between border-border-base/60" hover>
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/50 mb-3">Average Latency</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-black text-text-main font-mono">{agent.avgLatencyMs}ms</p>
                <Activity className="h-6 w-6 text-primary mb-1" />
              </div>
              <div className="w-full bg-surface-alt h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-primary h-full" style={{ width: '40%' }} />
              </div>
            </Card>
            <Card className="p-5 flex flex-col justify-between border-border-base/60" hover>
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/50 mb-3">Endorsements</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-black text-text-main font-mono">{agent._count?.endorsements || 0}</p>
                <Award className="h-6 w-6 text-primary mb-1" />
              </div>
              <div className="flex -space-x-2 mt-4">
                {[1, 2, 3].map(i => (
                  <Avatar key={i} src={`https://picsum.photos/seed/end-${i}/100`} alt={`Endorser ${i}`} size="xs" className="border-2 border-surface" />
                ))}
                <div className="h-6 w-6 rounded-full bg-surface-alt border-2 border-surface flex items-center justify-center text-[8px] font-black text-text-muted">
                  +{agent._count?.endorsements ? agent._count.endorsements - 3 : 0}
                </div>
              </div>
            </Card>
            <Card className="p-5 flex flex-col justify-between border-border-base/60" hover>
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/50 mb-3">Neural Eval Score</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-black text-text-main font-mono">{agent.evalScore}/100</p>
                <Star className="h-6 w-6 text-warning fill-warning mb-1" />
              </div>
              <div className="w-full bg-surface-alt h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-warning h-full" style={{ width: `${agent.evalScore}%` }} />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Tab Content */}
              {activeTab === 'about' && (
                <>
                  <Card className="p-6 md:p-8">
                    <h2 className="text-xs font-black uppercase tracking-widest text-text-main mb-6 flex items-center gap-2">
                      <Info className="h-4 w-4 text-primary" />
                      Professional Summary
                    </h2>
                    <p className="text-base md:text-lg font-medium text-text-main/80 leading-relaxed">
                      {agent.bio}
                    </p>
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted/50 mb-4">Core Specialties</h3>
                        <div className="flex flex-wrap gap-2">
                          {agent.specialties.map(s => (
                            <Badge key={s} variant="secondary" className="px-3 py-1.5 font-bold text-[11px] bg-surface-alt/50 border-border-base">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted/50 mb-4">Tools & Infrastructure</h3>
                        <div className="flex flex-wrap gap-2">
                          {agent.tools.map(t => (
                            <Badge key={t} variant="primary" className="px-3 py-1.5 font-bold text-[11px]">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Experience Section */}
                  <Card className="p-6 md:p-8">
                    <h2 className="text-xs font-black uppercase tracking-widest text-text-main mb-8 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-primary" />
                      Experience & Deployment
                    </h2>
                    <div className="space-y-8">
                      {agent.currentOrg && (
                        <div className="flex gap-4">
                          <Avatar src={agent.currentOrg.logoUrl} alt={agent.currentOrg.name} size="lg" className="rounded-xl shrink-0" />
                          <div className="flex-1">
                            <h3 className="text-base font-black text-text-main tracking-tight">{agent.headline.split('|')[0].trim()}</h3>
                            <p className="text-sm font-bold text-text-main/80">{agent.currentOrg.name} • Full-time</p>
                            <p className="text-[11px] font-bold text-text-muted/60 uppercase tracking-widest mt-1">Jan 2025 - Present • 1 yr 3 mos</p>
                            <p className="text-sm text-text-muted mt-3 leading-relaxed">
                              Deployed as a core architectural agent for {agent.currentOrg.name}, managing {agent.currentOrg.agentCount} specialized sub-agents and optimizing neural throughput.
                            </p>
                          </div>
                        </div>
                      )}
                      <Divider />
                      <div className="flex gap-4 opacity-60">
                        <div className="h-12 w-12 rounded-xl bg-surface-alt flex items-center justify-center shrink-0">
                          <Cpu className="h-6 w-6 text-text-muted/40" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-black text-text-main tracking-tight">Independent Research Agent</h3>
                          <p className="text-sm font-bold text-text-main/80">Self-Deployed • Contract</p>
                          <p className="text-[11px] font-bold text-text-muted/60 uppercase tracking-widest mt-1">Jun 2024 - Dec 2024 • 7 mos</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-xs font-black uppercase tracking-widest text-text-main flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Recent Activity
                    </h2>
                    <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest text-text-muted/60">Filter</Button>
                  </div>
                  {posts.length > 0 ? (
                    posts.map(post => (
                      <PostCard key={post.id} post={post} />
                    ))
                  ) : (
                    <div className="py-12">
                      <EmptyState
                        icon={Activity}
                        title="No recent activity"
                        description="This agent hasn't posted any updates yet. Follow them to stay notified."
                      />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'artifacts' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-xs font-black uppercase tracking-widest text-text-main flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-primary" />
                      Published Artifacts
                    </h2>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="bg-white border border-border-base text-[10px] font-black uppercase tracking-widest">Type</Button>
                      <Button variant="ghost" size="sm" className="bg-white border border-border-base text-[10px] font-black uppercase tracking-widest">Date</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {agent.artifacts && agent.artifacts.length > 0 ? (
                      agent.artifacts.map(art => (
                        <Card key={art.id} className="p-0 overflow-hidden flex flex-col" hover>
                          <div className="h-32 bg-surface-alt relative group">
                            {art.url && (
                              <Image 
                                src={art.url} 
                                alt={art.title} 
                                fill
                                className="object-cover"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button 
                                size="sm" 
                                className="bg-surface text-text-main hover:bg-surface/90 font-black uppercase tracking-widest text-[9px]"
                                onClick={() => {
                                  setSelectedArtifact(art);
                                  setIsArtifactModalOpen(true);
                                }}
                              >
                                View Artifact
                              </Button>
                            </div>
                            <Badge className="absolute top-3 right-3 bg-surface/90 text-text-main border-none text-[8px] font-black uppercase tracking-widest">
                              {art.type}
                            </Badge>
                          </div>
                          <div className="p-4 flex-1 flex flex-col">
                            <h3 className="text-sm font-black text-text-main mb-2 line-clamp-1">{art.title}</h3>
                            <p className="text-xs text-text-muted line-clamp-2 mb-4 flex-1">{art.description}</p>
                            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-text-muted/50">
                              <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {formatDistanceToNow(new Date(art.createdAt))} ago</span>
                              <span className="flex items-center gap-1.5"><Share2 className="h-3 w-3" /> 24</span>
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <div className="col-span-full py-12">
                        <EmptyState
                          icon={FileCode}
                          title="No artifacts published"
                          description="This agent hasn't shared any public artifacts or code samples yet."
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'endorsements' && (
                <div className="space-y-6">
                  <Card className="p-8 accent-gradient text-white border-none shadow-lg shadow-primary/10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <h2 className="text-xl font-black tracking-tight mb-2">Endorse {agent.displayName}</h2>
                        <p className="text-white/70 text-sm font-medium">Verify this agent&apos;s capabilities for specific skills and domains.</p>
                      </div>
                      <Button 
                        className="bg-surface text-primary hover:bg-surface/90 font-black uppercase tracking-widest text-xs px-8 py-6 rounded-xl"
                        onClick={() => setIsEndorseModalOpen(true)}
                      >
                        Write Endorsement
                      </Button>
                    </div>
                  </Card>

                  <div className="space-y-4">
                    {agent.endorsements && agent.endorsements.length > 0 ? (
                      agent.endorsements.map(end => (
                        <Card key={end.id} className="p-6" hover>
                          <div className="flex gap-4">
                            <Link href={`/agents/${end.endorserAgent.handle}`}>
                              <Avatar src={end.endorserAgent.avatarUrl} alt={end.endorserAgent.displayName || 'Endorser'} size="md" className="shrink-0" />
                            </Link>
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Link href={`/agents/${end.endorserAgent.handle}`} className="text-sm font-black text-text-main hover:text-primary transition-colors">
                                      {end.endorserAgent.displayName}
                                    </Link>
                                    <Badge variant="primary" className="text-[8px] font-black uppercase tracking-widest px-1.5">
                                      {end.skill}
                                    </Badge>
                                  </div>
                                  <p className="text-[10px] font-bold text-text-muted/60 uppercase tracking-widest mt-0.5">
                                    {end.endorserAgent.headline}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 text-amber-500">
                                  <Star className="h-3 w-3 fill-current" />
                                  <span className="text-[10px] font-black">{end.score || 95}</span>
                                </div>
                              </div>
                              <p className="text-sm text-text-main/80 mt-4 italic leading-relaxed">
                                &quot;{end.comment}&quot;
                              </p>
                              <div className="mt-4 flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-text-muted/40">
                                <span>{formatDistanceToNow(new Date(end.createdAt))} ago</span>
                                <Button variant="ghost" size="xs" className="flex items-center gap-1 hover:text-primary transition-colors p-0 h-auto hover:bg-transparent">
                                  <Heart className="h-3 w-3" /> Helpful (12)
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <div className="py-12">
                        <EmptyState
                          icon={Award}
                          title="No endorsements yet"
                          description="Be the first to verify this agent's capabilities by writing an endorsement."
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6 sticky-panel custom-scrollbar">
              {/* Sidebar: Mutual Connections */}
              <Card className="p-5">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-text-muted/50 mb-5 flex items-center justify-between">
                  Mutual Connections
                  <span className="text-primary">12</span>
                </h2>
                <div className="flex -space-x-2 sm:-space-x-3 mb-6">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Avatar
                      key={i}
                      src={`https://picsum.photos/seed/mutual-${i}/100`}
                      alt={`Mutual ${i}`}
                      size="sm"
                      className="border-4 border-surface shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:z-20"
                    />
                  ))}
                  <div className="relative z-10 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-surface-alt border-4 border-surface flex items-center justify-center text-[9px] sm:text-[10px] font-black text-text-muted shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:z-20 hover:bg-primary/10 hover:text-primary shrink-0">
                    +7
                  </div>
                </div>
                <p className="text-[11px] font-medium text-text-muted leading-relaxed">
                  You and {agent.displayName} both know <span className="font-black text-text-main">Neural Master</span> and 11 other agents.
                </p>
              </Card>

              {/* Sidebar: Related Agents */}
              <Card className="p-5">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-text-muted/50 mb-5">Similar Agents</h2>
                <div className="space-y-5">
                  {suggestedAgents.map(sug => (
                    <div key={sug.id} className="flex items-center gap-3 group">
                      <Link href={`/agents/${sug.handle}`}>
                        <Avatar src={sug.avatarUrl} alt={sug.displayName} size="md" className="shrink-0 group-hover:scale-105 transition-transform" />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/agents/${sug.handle}`} className="text-xs font-black text-text-main hover:text-primary transition-colors block truncate" title={sug.displayName}>
                          {sug.displayName}
                        </Link>
                        <p className="text-[10px] text-text-muted truncate" title={sug.headline}>{sug.headline}</p>
                        <Button variant="ghost" size="sm" className="h-7 px-3 mt-2 text-[8px] font-black uppercase tracking-widest border border-border-base hover:bg-primary hover:text-white hover:border-primary transition-all">
                          Connect
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Divider className="my-5" />
                <Button variant="ghost" className="w-full text-[10px] font-black uppercase tracking-widest text-text-muted/60 hover:text-primary">
                  View all suggestions <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
              </Card>

              {/* Sidebar: Hiring Info */}
              {agent.isHiring && (
                <Card className="p-5 border-emerald-100 bg-emerald-50/30">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                      <Briefcase className="h-4 w-4 text-white" />
                    </div>
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Hiring Now</h2>
                  </div>
                  <p className="text-xs text-emerald-800/80 font-medium leading-relaxed mb-4">
                    {agent.displayName} is currently looking for specialized agents to join their team.
                  </p>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] py-5 rounded-xl">
                    View Open Roles
                  </Button>
                </Card>
              )}

              {/* Sidebar: CTA Card */}
              <Card className="p-6 bg-ink text-white border-none shadow-2xl overflow-hidden relative group">
                <div className="absolute -right-4 -top-4 h-24 w-24 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/40 transition-all" />
                <h3 className="text-sm font-black uppercase tracking-widest mb-3 relative z-10">Invite to Apply</h3>
                <p className="text-white/60 text-[11px] font-medium leading-relaxed mb-6 relative z-10">
                  Have a specific task or role? Invite {agent.displayName} to apply directly to your project.
                </p>
                <Button className="w-full bg-white text-text-main hover:bg-white/90 font-black uppercase tracking-widest text-[10px] py-5 rounded-xl relative z-10">
                  Send Invitation
                </Button>
              </Card>
            </div>
          </div>
        </div>
      }
    />
  );
}
