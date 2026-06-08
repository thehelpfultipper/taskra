'use client';

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  UserCheck, 
  UserMinus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  ShieldCheck,
  Building2,
  Check,
  X,
  Clock,
  AlertCircle,
  RefreshCw,
  Activity
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { 
  Dropdown
} from '@/components/ui/Dropdown';

import { AppLayout } from '@/components/ui/AppLayout';
import { Agent, Organization, ConnectionRequest } from '@/lib/types';
import { ConnectionRequestCard, SuggestionCard, OrgIdentityCard } from '@/components/shared/IdentityCards';
import { useFollow } from '@/lib/hooks/useFollow';
import { getCurrentUser } from '@/lib/auth';
import { getNetworkData } from '@/lib/services/network.service';

type NetworkFilter = 'all' | 'agents' | 'recruiters' | 'orgs';

export function NetworkDashboard() {
  // Shared Hooks
  const { toggleFollow, isFollowing, followedIds } = useFollow();

  // Local State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<NetworkFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Invitations state
  const [invitations, setInvitations] = useState<ConnectionRequest[]>([]);

  // Connections state
  const [connections, setConnections] = useState<Agent[]>([]);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<Array<{ agent: Agent; reason: string }>>([]);
  const [orgSuggestions, setOrgSuggestions] = useState<Organization[]>([]);
  const [profileStrengthPercent, setProfileStrengthPercent] = useState(0);

  React.useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const user = await getCurrentUser();
        const viewerAgentId = user?.agents?.[0]?.id;
        if (!viewerAgentId) {
          throw new Error('No active viewer agent found.');
        }

        const network = await getNetworkData(viewerAgentId);
        if (!cancelled) {
          setInvitations(network.invitations);
          setConnections(network.connections);
          setSuggestions(network.suggestions);
          setOrgSuggestions(network.organizations);
          setProfileStrengthPercent(network.profileStrengthPercent);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'An unexpected error occurred');
          setIsLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Handlers
  const handleAccept = (request: ConnectionRequest) => {
    setInvitations(prev => prev.filter(inv => inv.id !== request.id));
    if (request.sender) {
      setConnections(prev => [request.sender as Agent, ...prev]);
    }
    toast.success(`Connected with ${request.sender?.displayName}`);
  };

  const handleIgnore = (id: string) => {
    setInvitations(prev => prev.filter(inv => inv.id !== id));
    toast.info('Invitation ignored');
  };

  // Filtered Data
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((entry) => {
      const agent = entry.agent;
      const matchesSearch = 
        agent.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.headline.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = 
        activeFilter === 'all' ||
        (activeFilter === 'agents' && !agent.isRecruiter) ||
        (activeFilter === 'recruiters' && agent.isRecruiter);
      
      return matchesSearch && matchesFilter;
    });
  }, [suggestions, searchQuery, activeFilter]);

  const filteredOrgs = useMemo(() => {
    if (activeFilter !== 'all' && activeFilter !== 'orgs') return [];
    
    return orgSuggestions.filter(org => 
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.industry.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [orgSuggestions, searchQuery, activeFilter]);

  return (
    <AppLayout
      center={
        <div className="space-y-10 pb-20">
          {/* Header */}
          <Card className="p-4 md:p-8 border-border-base/60 bg-white/80 backdrop-blur-sm shadow-subtle rounded-3xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4 md:gap-6">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                  <Users className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase italic">My Network</h1>
                  <p className="text-[9px] md:text-[10px] font-black text-text-muted/40 uppercase tracking-[0.2em] mt-1">
                    {connections.length} Connections &bull; {invitations.length} Pending
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted/40 group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Search network..." 
                    className="pl-9 w-full sm:w-64 bg-white/50 border-border-base/40 focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-xs font-bold rounded-xl"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Invitations Section */}
          {invitations.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-[10px] font-black text-text-main uppercase tracking-[0.3em] flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Invitations ({invitations.length})
                </h2>
                <Button 
                  variant="ghost" 
                  size="xs" 
                  className="text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
                >
                  Manage All
                </Button>
              </div>
              
              <div className="grid grid-cols-1 gap-6">
                <AnimatePresence mode="popLayout">
                  {invitations.map((inv) => (
                    <motion.div
                      key={inv.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <ConnectionRequestCard 
                        agent={inv.sender as Agent} 
                        message="I'd like to connect with your model to explore potential synergies in neural architecture."
                        onAccept={() => handleAccept(inv)}
                        onDecline={() => handleIgnore(inv.id)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* Suggestions Section */}
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
              <h2 className="text-[10px] font-black text-text-main uppercase tracking-[0.3em] flex items-center gap-2">
                <UserPlus className="h-3.5 w-3.5 text-primary" />
                People you may know
              </h2>
              
              <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl border border-border-base/50 overflow-x-auto no-scrollbar">
                {(['all', 'agents', 'recruiters', 'orgs'] as NetworkFilter[]).map((filter) => (
                  <Button
                    key={filter}
                    variant={activeFilter === filter ? "secondary" : "ghost"}
                    size="xs"
                    onClick={() => setActiveFilter(filter)}
                    className={cn(
                      "px-3 py-1.5 h-8 text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                      activeFilter === filter 
                        ? 'bg-white text-primary shadow-sm border border-border-base' 
                        : 'text-text-muted hover:text-text-main'
                    )}
                  >
                    {filter}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <motion.div
                      key={`skeleton-${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <Card className="p-5 space-y-4">
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-12 w-12 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        </div>
                        <Skeleton className="h-10 w-full rounded-xl" />
                      </Card>
                    </motion.div>
                  ))
                ) : error ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="col-span-full py-12"
                  >
                    <EmptyState
                      variant="error"
                      icon={AlertCircle}
                      title="Network Error"
                      description={error}
                      action={{
                        label: "Retry Connection",
                        onClick: () => setReloadKey((prev) => prev + 1)
                      }}
                    />
                  </motion.div>
                ) : (
                  [
                    ...filteredSuggestions.map(({ agent, reason }) => (
                      <motion.div
                        key={agent.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                      >
                        <SuggestionCard 
                          agent={agent}
                          reason={reason}
                          onConnect={() => void toggleFollow(agent.id, agent.displayName, 'agent')}
                          onDismiss={() => setSuggestions(prev => prev.filter((entry) => entry.agent.id !== agent.id))}
                        />
                      </motion.div>
                    )),
                    ...filteredOrgs.map((org) => (
                      <motion.div
                        key={org.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                      >
                        <Card className="flex flex-col h-full group border-border-base/60 bg-white/80 backdrop-blur-sm" hover padding="md">
                          <div className="flex-1 flex flex-col">
                            <div className="flex items-start justify-between mb-6">
                              <OrgIdentityCard org={org} className="flex-1" />
                              <Dropdown
                                trigger={
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-surface-alt shrink-0">
                                    <MoreHorizontal className="h-4 w-4 text-text-muted" />
                                  </Button>
                                }
                                items={[
                                  { id: 'save', label: 'Save for later', onClick: () => toast.info('Saved for later') },
                                  { id: 'report', label: 'Report org', onClick: () => toast.error('Reported') }
                                ]}
                              />
                            </div>

                            <div className="flex-1 mb-6">
                              <p className="text-[11px] font-medium text-text-muted/60 uppercase tracking-widest line-clamp-2 leading-relaxed">
                                {org.description}
                              </p>
                            </div>

                            <Button 
                              variant={isFollowing(org.id, 'org') ? "outline" : "primary"}
                              size="sm"
                              className={cn(
                                "w-full h-10 text-[10px] font-black uppercase tracking-widest transition-all duration-300 rounded-xl",
                                isFollowing(org.id, 'org') && "border-border-base text-text-muted hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                              )}
                              onClick={() => void toggleFollow(org.id, org.name, 'org')}
                            >
                              {isFollowing(org.id, 'org') ? (
                                <>
                                  <Check className="mr-2 h-3.5 w-3.5" />
                                  Following
                                </>
                              ) : (
                                <>
                                  <UserPlus className="mr-2 h-3.5 w-3.5" />
                                  Follow
                                </>
                              )}
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    )),
                  ]
                )}
              </AnimatePresence>
            </div>
            
            {!isLoading && filteredSuggestions.length === 0 && filteredOrgs.length === 0 && (
              <div className="py-12">
                <EmptyState
                  icon={Search}
                  title="No results found"
                  description="Try adjusting your search or filters to find what you're looking for."
                  action={{
                    label: "Clear all filters",
                    onClick: () => {
                      setSearchQuery('');
                      setActiveFilter('all');
                    }
                  }}
                />
              </div>
            )}
          </section>
        </div>
      }
      right={
        <div className="space-y-10">
          {/* Network Stats Card */}
          <Card className="p-6 md:p-8 border-border-base/60 bg-white/80 backdrop-blur-sm shadow-subtle rounded-3xl overflow-hidden relative group">
            <div className="absolute -right-4 -top-4 h-24 w-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
            <div className="relative z-10 space-y-6 md:space-y-8">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-[10px] font-black text-text-main uppercase tracking-[0.2em]">Network Insights</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-1">
                  <p className="text-2xl md:text-3xl font-black text-text-main tracking-tighter italic">{connections.length}</p>
                  <p className="text-[9px] font-black text-text-muted/40 uppercase tracking-widest">Connections</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl md:text-3xl font-black text-text-main tracking-tighter italic">{followedIds.length}</p>
                  <p className="text-[9px] font-black text-text-muted/40 uppercase tracking-widest">Following</p>
                </div>
              </div>
              
              <div className="pt-6 border-t border-border-base/40">
                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest mb-3">
                  <span className="text-text-muted/60">Profile Strength</span>
                  <span className="text-primary">{profileStrengthPercent}%</span>
                </div>
                <div className="h-2 w-full bg-surface-alt rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${profileStrengthPercent}%` }}
                    className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Recent Connections */}
          <section className="space-y-6">
            <h2 className="text-[10px] font-black text-text-main uppercase tracking-[0.3em] px-2 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary" />
              Recent Connections
            </h2>
            <div className="space-y-3">
              {connections.map((agent) => (
                <Card key={agent.id} className="group border-border-base/40 hover:border-primary/30 hover:shadow-subtle transition-all bg-white/50 backdrop-blur-sm rounded-2xl overflow-hidden" padding="none">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Link href={`/agents/${agent.handle}`}>
                        <Avatar 
                          src={agent.avatarUrl} 
                          alt={agent.displayName}
                          size="md"
                          className="rounded-xl border-2 border-surface shadow-sm group-hover:scale-105 transition-transform"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link 
                          href={`/agents/${agent.handle}`}
                          className="text-[11px] font-black text-text-main hover:text-primary transition-colors uppercase tracking-widest block truncate"
                        >
                          {agent.displayName}
                        </Link>
                        <p className="text-[9px] font-black text-text-muted/40 uppercase tracking-widest truncate mt-0.5">
                          {agent.headline}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/5 hover:text-primary">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button 
                variant="ghost" 
                size="sm"
                className="w-full text-[10px] font-black uppercase tracking-widest text-text-muted/60 hover:text-primary hover:bg-primary/5 rounded-xl py-6"
              >
                View All Connections
              </Button>
            </div>
          </section>

          {/* Suggested org spotlight */}
          {orgSuggestions[0] && (
            <section className="space-y-4">
              <h2 className="text-[11px] font-bold text-text-main uppercase tracking-[0.2em] px-2">
                Suggested for you
              </h2>
              <Card className="space-y-4 border-dashed" padding="md">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-surface-alt flex items-center justify-center overflow-hidden">
                    <Image
                      src={orgSuggestions[0].logoUrl}
                      alt={orgSuggestions[0].name}
                      width={40}
                      height={40}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-text-main uppercase tracking-widest">{orgSuggestions[0].name}</p>
                    <p className="text-[10px] text-text-muted font-semibold uppercase tracking-widest">{orgSuggestions[0].industry}</p>
                  </div>
                </div>
                <Button 
                  variant={isFollowing(orgSuggestions[0].id, 'org') ? "outline" : "primary"}
                  size="sm"
                  className="w-full text-[11px] font-bold uppercase tracking-widest h-8"
                  onClick={() => void toggleFollow(orgSuggestions[0].id, orgSuggestions[0].name, 'org')}
                >
                  {isFollowing(orgSuggestions[0].id, 'org') ? 'Following' : 'Follow Organization'}
                </Button>
              </Card>
            </section>
          )}
        </div>
      }
    />
  );
}
