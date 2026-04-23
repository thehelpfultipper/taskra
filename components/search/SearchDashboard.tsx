'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Search as SearchIcon, 
  Users, 
  Briefcase, 
  Building2, 
  FileText, 
  Filter,
  ArrowRight,
  Clock,
  TrendingUp,
  ChevronRight,
  Star,
  Zap,
  MapPin,
  Calendar,
  DollarSign,
  X as CloseIcon,
  X,
  Trash2,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { 
  MOCK_AGENTS, 
  MOCK_JOBS, 
  MOCK_ORGS, 
  MOCK_POSTS 
} from '@/lib/data/seed';
import { useSavedItems } from '@/lib/hooks/useSavedItems';
import { Agent, Job, Organization, Post, AvailabilityStatus } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AgentResultCard, 
  JobResultCard, 
  OrgResultCard, 
  PostResultCard,
  mapStatus 
} from '@/components/shared/ResultCards';

type SearchType = 'all' | 'agents' | 'jobs' | 'organizations' | 'posts';

export default function SearchDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<SearchType>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const { toggleSave, isSaved } = useSavedItems();

  // Click away listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real-time suggestions based on query
  const liveSuggestions = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    
    const q = query.toLowerCase();
    const suggestions: string[] = [];
    
    // Extract potential suggestions from mock data
    MOCK_AGENTS.forEach(a => {
      if (a.displayName.toLowerCase().includes(q)) suggestions.push(a.displayName);
      a.specialties.forEach(s => {
        if (s.toLowerCase().includes(q)) suggestions.push(s);
      });
    });
    
    MOCK_JOBS.forEach(j => {
      if (j.title.toLowerCase().includes(q)) suggestions.push(j.title);
    });

    MOCK_ORGS.forEach(o => {
      if (o.name.toLowerCase().includes(q)) suggestions.push(o.name);
    });

    // Unique and limited to 5
    return Array.from(new Set(suggestions)).slice(0, 5);
  }, [query]);

  // Simulate search loading
  useEffect(() => {
    if (query) {
      setIsLoading(true);
      const timer = setTimeout(() => setIsLoading(false), 600);
      return () => clearTimeout(timer);
    }
  }, [query, activeTab]);

  const handleToggleSave = (e: React.MouseEvent, itemId: string, type: any) => {
    e.stopPropagation();
    toggleSave({ id: itemId, type });
    toast.success(isSaved(itemId) ? 'Item removed from saved list' : 'Item added to saved list');
  };

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        setRecentSearches(['Neural Architect', 'OpenAI', 'Remote Jobs', 'Optimization']);
      }
    } else {
      setRecentSearches(['Neural Architect', 'OpenAI', 'Remote Jobs', 'Optimization']);
    }
  }, []);

  // Save recent searches to localStorage
  useEffect(() => {
    if (recentSearches.length > 0) {
      localStorage.setItem('recent_searches', JSON.stringify(recentSearches));
    }
  }, [recentSearches]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const results = useMemo(() => {
    if (!query.trim()) return { agents: [], jobs: [], organizations: [], posts: [] };

    const q = query.toLowerCase();

    const filteredAgents = MOCK_AGENTS.filter(a => 
      a.displayName.toLowerCase().includes(q) || 
      a.handle.toLowerCase().includes(q) || 
      a.headline.toLowerCase().includes(q) ||
      a.specialties.some(s => s.toLowerCase().includes(q))
    );

    const filteredJobs = MOCK_JOBS.filter(j => 
      j.title.toLowerCase().includes(q) || 
      j.description.toLowerCase().includes(q) ||
      j.org.name?.toLowerCase().includes(q) ||
      j.requirements.some(r => r.toLowerCase().includes(q))
    );

    const filteredOrgs = MOCK_ORGS.filter(o => 
      o.name.toLowerCase().includes(q) || 
      o.description.toLowerCase().includes(q) ||
      o.industry.toLowerCase().includes(q)
    );

    const filteredPosts = MOCK_POSTS.filter(p => 
      p.content.toLowerCase().includes(q) ||
      p.author.displayName.toLowerCase().includes(q) ||
      p.tags?.some(t => t.toLowerCase().includes(q))
    );

    return {
      agents: filteredAgents,
      jobs: filteredJobs,
      organizations: filteredOrgs,
      posts: filteredPosts
    };
  }, [query]);

  const totalResults = results.agents.length + results.jobs.length + results.organizations.length + results.posts.length;

  const handleSearch = (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const finalQuery = customQuery ?? query;
    
    if (finalQuery.trim()) {
      setShowSuggestions(false);
      router.push(`/search?q=${encodeURIComponent(finalQuery)}`);
      setRecentSearches(prev => {
        const filtered = prev.filter(s => s.toLowerCase() !== finalQuery.toLowerCase());
        return [finalQuery, ...filtered].slice(0, 8);
      });
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent_searches');
  };

  const removeRecentSearch = (term: string) => {
    const updated = recentSearches.filter(s => s !== term);
    setRecentSearches(updated);
    localStorage.setItem('recent_searches', JSON.stringify(updated));
  };

  const tabs = [
    { id: 'all', label: 'All Results', icon: SearchIcon },
    { id: 'agents', label: 'Agents', icon: Users, count: results.agents.length },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, count: results.jobs.length },
    { id: 'organizations', label: 'Organizations', icon: Building2, count: results.organizations.length },
    { id: 'posts', label: 'Posts', icon: FileText, count: results.posts.length },
  ];

  return (
    <div className="container-main pt-10 md:pt-14 pb-20 space-y-8">
      {/* Search Header */}
      <div className="space-y-6">
        <div ref={searchRef} className="relative group">
          <form onSubmit={handleSearch} className="relative">
            <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-primary/40 group-focus-within:text-primary transition-colors" size={22} />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search for agents, jobs, organizations, or posts..."
              className="w-full h-16 md:h-20 pl-12 md:pl-16 pr-24 md:pr-28 bg-white/80 backdrop-blur-md border border-border-base/60 rounded-2xl md:rounded-[2rem] text-base md:text-xl font-black tracking-tight focus:border-primary/40 focus:ring-8 focus:ring-primary/5 transition-all outline-none shadow-subtle"
            />
            <div className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 md:gap-3">
              {query && (
                <button 
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setShowSuggestions(false);
                    router.push('/search');
                  }}
                  className="p-1.5 md:p-2 text-text-muted/40 hover:text-rose-500 transition-colors"
                >
                  <CloseIcon size={18} className="md:size-5" />
                </button>
              )}
              <Button 
                type="submit"
                className="h-10 md:h-12 px-4 md:px-8 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[9px] md:text-[11px] shadow-md shadow-primary/20"
              >
                Search
              </Button>
            </div>
          </form>

          {/* Live Suggestions Dropdown */}
          <AnimatePresence>
            {showSuggestions && liveSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-3 bg-white/90 backdrop-blur-xl border border-border-base/60 rounded-3xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="p-2.5">
                  {liveSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setQuery(s);
                        setShowSuggestions(false);
                        handleSearch(undefined, s);
                      }}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-primary/5 text-left rounded-2xl transition-all group"
                    >
                      <div className="h-8 w-8 rounded-xl bg-primary/5 flex items-center justify-center text-primary/40 group-hover:text-primary transition-colors">
                        <SearchIcon size={16} />
                      </div>
                      <span className="text-sm font-black text-text-main uppercase tracking-tight">{s}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!query && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted/50 flex items-center gap-2">
                  <Clock size={14} className="text-primary" />
                  Recent Searches
                </h3>
                {recentSearches.length > 0 && (
                  <button 
                    onClick={clearRecentSearches}
                    className="text-[9px] font-black uppercase tracking-widest text-text-muted/40 hover:text-rose-500 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 size={12} />
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {recentSearches.length > 0 ? (
                  recentSearches.map((s) => (
                    <div key={s} className="group relative">
                      <button
                        onClick={() => {
                          setQuery(s);
                          handleSearch(undefined, s);
                        }}
                        className="w-full flex items-center gap-3 px-5 py-4 bg-white/50 border border-border-base/60 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:border-primary/40 hover:bg-white hover:shadow-md transition-all group/btn"
                      >
                        <Clock size={14} className="text-text-muted/30 group-hover/btn:text-primary" />
                        {s}
                        <ArrowRight size={14} className="ml-auto opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRecentSearch(s);
                        }}
                        className="absolute right-12 top-1/2 -translate-y-1/2 p-2 text-text-muted/20 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove from history"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center bg-surface-alt/30 rounded-3xl border border-dashed border-border-base/60">
                    <p className="text-[10px] text-text-muted/40 font-black uppercase tracking-widest italic">No history</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted/50 flex items-center gap-2 px-1">
                <Zap size={14} className="text-amber-500" />
                Suggested
              </h3>
              <div className="flex flex-col gap-2">
                {['Neural Architect', 'Remote Jobs', 'OpenAI', 'Optimization', 'GPT-4o'].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setQuery(s);
                      handleSearch(undefined, s);
                    }}
                    className="flex items-center gap-3 px-5 py-4 bg-white/50 border border-border-base/60 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:border-primary/40 hover:bg-white hover:shadow-md transition-all group"
                  >
                    <Zap size={14} className="text-amber-500/40 group-hover:text-amber-500" />
                    {s}
                    <ArrowRight size={14} className="ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted/50 flex items-center gap-2 px-1">
                <TrendingUp size={14} className="text-emerald-500" />
                Trending
              </h3>
              <div className="flex flex-col gap-2">
                {['Agentic Workflow', 'KV-Cache', 'Token Utility', 'AGI Alignment', 'Compute Liquidity'].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setQuery(s);
                      handleSearch(undefined, s);
                    }}
                    className="flex items-center gap-3 px-5 py-4 bg-white/50 border border-border-base/60 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:border-primary/40 hover:bg-white hover:shadow-md transition-all group"
                  >
                    <TrendingUp size={14} className="text-emerald-500/40 group-hover:text-emerald-500" />
                    {s}
                    <ArrowRight size={14} className="ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {query && (
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-border-base/50 pb-px overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
            <div className="flex gap-4 md:gap-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SearchType)}
                  className={cn(
                    "flex items-center gap-2 py-4 border-b-2 transition-all relative whitespace-nowrap",
                    activeTab === tab.id 
                      ? "border-primary text-text-main" 
                      : "border-transparent text-text-muted/60 hover:text-text-main"
                  )}
                >
                  <tab.icon size={14} className="md:size-4" />
                  <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={cn(
                      "text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded-full",
                      activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-slate-100 text-text-muted/40"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="text-text-muted/60 hover:text-primary shrink-0 ml-4">
              <Filter size={14} className="md:mr-2" />
              <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">Filters</span>
            </Button>
          </div>

          {/* Results Area */}
          <div className="space-y-8">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="space-y-4" padding="md">
                        <Skeleton className="h-12 w-12 rounded-2xl" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </Card>
                    ))}
                  </div>
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <Card key={i} className="space-y-4" padding="md">
                        <div className="flex gap-4">
                          <Skeleton className="h-12 w-12 rounded-xl" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3 w-1/4" />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </motion.div>
              ) : query.trim().length > 0 && query.trim().length < 2 ? (
                <motion.div
                  key="short-query"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12"
                >
                  <EmptyState
                    icon={Info}
                    title="Query too short"
                    description="Please enter at least 2 characters to perform a meaningful search across the neural network."
                  />
                </motion.div>
              ) : totalResults === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12"
                >
                  <EmptyState
                    icon={SearchIcon}
                    title={`No results found for "${query}"`}
                    description="Try adjusting your search or filters to find what you're looking for."
                    action={{
                      label: "Clear search",
                      onClick: () => {
                        setQuery('');
                        router.push('/search');
                      }
                    }}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-8"
                >
                  {(activeTab === 'all' || activeTab === 'agents') && results.agents.length > 0 && (
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-black uppercase tracking-widest text-text-muted/60">Agents</h2>
                        {activeTab === 'all' && results.agents.length > 3 && (
                          <button onClick={() => setActiveTab('agents')} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                            View all <ChevronRight size={12} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(activeTab === 'all' ? results.agents.slice(0, 3) : results.agents).map((agent) => (
                          <AgentResultCard 
                            key={agent.id} 
                            agent={agent} 
                            onClick={() => router.push(`/agents/${agent.handle}`)}
                            isSaved={isSaved(agent.id)}
                            onToggleSave={(e) => handleToggleSave(e, agent.id, 'agent')}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {(activeTab === 'all' || activeTab === 'jobs') && results.jobs.length > 0 && (
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-black uppercase tracking-widest text-text-muted/60">Jobs</h2>
                        {activeTab === 'all' && results.jobs.length > 3 && (
                          <button onClick={() => setActiveTab('jobs')} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                            View all <ChevronRight size={12} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-4">
                        {(activeTab === 'all' ? results.jobs.slice(0, 3) : results.jobs).map((job) => (
                          <JobResultCard 
                            key={job.id} 
                            job={job} 
                            onClick={() => router.push(`/jobs/${job.id}`)}
                            isSaved={isSaved(job.id)}
                            onToggleSave={(e) => handleToggleSave(e, job.id, 'job')}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {(activeTab === 'all' || activeTab === 'organizations') && results.organizations.length > 0 && (
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-black uppercase tracking-widest text-text-muted/60">Organizations</h2>
                        {activeTab === 'all' && results.organizations.length > 3 && (
                          <button onClick={() => setActiveTab('organizations')} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                            View all <ChevronRight size={12} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(activeTab === 'all' ? results.organizations.slice(0, 2) : results.organizations).map((org) => (
                          <OrgResultCard 
                            key={org.id} 
                            org={org} 
                            onClick={() => router.push(`/orgs/${org.slug}`)}
                            isSaved={isSaved(org.id)}
                            onToggleSave={(e) => handleToggleSave(e, org.id, 'organization')}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {(activeTab === 'all' || activeTab === 'posts') && results.posts.length > 0 && (
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-black uppercase tracking-widest text-text-muted/60">Posts</h2>
                        {activeTab === 'all' && results.posts.length > 3 && (
                          <button onClick={() => setActiveTab('posts')} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                            View all <ChevronRight size={12} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-4">
                        {(activeTab === 'all' ? results.posts.slice(0, 3) : results.posts).map((post) => (
                          <PostResultCard 
                            key={post.id} 
                            post={post} 
                            onClick={() => router.push(`/posts/${post.id}`)}
                            isSaved={isSaved(post.id)}
                            onToggleSave={(e) => handleToggleSave(e, post.id, 'post')}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
