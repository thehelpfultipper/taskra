'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Bookmark, 
  Briefcase, 
  FileText, 
  Users, 
  Building2, 
  ChevronRight,
  Search,
  ArrowLeft,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSavedItems } from '@/lib/hooks/useSavedItems';
import { resolveSavedItemRefs } from '@/lib/services/saved.service';
import type { SavedItemsViewModel } from '@/lib/frontend-data/view-models';
import { 
  AgentResultCard, 
  JobResultCard, 
  OrgResultCard, 
  PostResultCard 
} from '@/components/shared/ResultCards';
import { motion, AnimatePresence } from 'motion/react';

type SavedCategory = 'all' | 'jobs' | 'posts' | 'agents' | 'organizations';

export default function SavedDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SavedCategory>('all');
  const { savedItems, toggleSave, isSaved } = useSavedItems();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [resolvedSaved, setResolvedSaved] = useState<SavedItemsViewModel>({
    agents: [],
    jobs: [],
    organizations: [],
    posts: [],
    unresolvedRefs: [],
  });

  // Resolve local saved refs against backend-backed data.
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const resolved = await resolveSavedItemRefs(
          savedItems.map((item) => ({
            itemId: item.itemId,
            itemType: item.itemType,
          })),
        );
        if (!cancelled) {
          setResolvedSaved(resolved);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "An unexpected error occurred");
          setIsLoading(false);
        }
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [savedItems, reloadKey]);

  const savedData = useMemo(() => {
    const q = searchQuery.toLowerCase();

    const agents = resolvedSaved.agents
      .filter(a => !q || a!.displayName.toLowerCase().includes(q) || a!.headline.toLowerCase().includes(q));
      
    const jobs = resolvedSaved.jobs
      .filter(j => !q || j!.title.toLowerCase().includes(q) || j!.org.name?.toLowerCase().includes(q));
      
    const organizations = resolvedSaved.organizations
      .filter(o => !q || o!.name.toLowerCase().includes(q) || o!.industry.toLowerCase().includes(q));
      
    const posts = resolvedSaved.posts
      .filter(p => !q || p!.content.toLowerCase().includes(q) || p!.author.displayName.toLowerCase().includes(q));

    return { agents, jobs, organizations, posts };
  }, [resolvedSaved, searchQuery]);

  const handleToggleSave = (e: React.MouseEvent, itemId: string, type: any) => {
    e.stopPropagation();
    toggleSave({ id: itemId, type });
    toast.success(isSaved(itemId) ? 'Item removed from saved list' : 'Item added to saved list');
  };

  const tabs = [
    { id: 'all', label: 'All', icon: Bookmark },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, count: savedData.jobs.length },
    { id: 'posts', label: 'Posts', icon: FileText, count: savedData.posts.length },
    { id: 'agents', label: 'Agents', icon: Users, count: savedData.agents.length },
    { id: 'organizations', label: 'Organizations', icon: Building2, count: savedData.organizations.length },
  ];

  const hasResults = (cat: SavedCategory) => {
    if (cat === 'all') return savedData.agents.length + savedData.jobs.length + savedData.organizations.length + savedData.posts.length > 0;
    if (cat === 'jobs') return savedData.jobs.length > 0;
    if (cat === 'posts') return savedData.posts.length > 0;
    if (cat === 'agents') return savedData.agents.length > 0;
    if (cat === 'organizations') return savedData.organizations.length > 0;
    return false;
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-text-muted/40 mb-1">
            <button onClick={() => router.back()} className="hover:text-primary transition-colors flex items-center gap-1.5 group">
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform md:size-4" />
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Back</span>
            </button>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic text-text-main">Saved Items</h1>
          <p className="text-[10px] md:text-xs text-text-muted/60 font-bold uppercase tracking-tight">Manage your bookmarked jobs, agents, and resources.</p>
        </div>
        <div className="h-12 w-12 md:h-16 md:w-16 bg-white/80 backdrop-blur-md border border-border-base/60 rounded-2xl md:rounded-[2rem] flex items-center justify-center text-primary shadow-subtle self-start sm:self-center">
          <Bookmark size={20} className="fill-primary/20 md:size-7" />
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border-base/60">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-px -mx-4 px-4 md:mx-0 md:px-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SavedCategory)}
              className={cn(
                "flex items-center gap-2.5 px-4 md:px-6 py-4 md:py-5 border-b-2 transition-all whitespace-nowrap relative",
                activeTab === tab.id 
                  ? "border-primary text-text-main" 
                  : "border-transparent text-text-muted hover:text-text-main"
              )}
            >
              <tab.icon size={14} className={cn("md:size-4", activeTab === tab.id ? "text-primary" : "text-text-muted")} />
              <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest">{tab.label}</span>
              {tab.count !== undefined && (
                <span className={cn(
                  "text-[9px] md:text-[10px] font-black px-1.5 md:px-2 py-0.5 rounded-full",
                  activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-surface-alt text-text-muted"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="pb-4 md:pb-0 md:pr-4">
          <div className="relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" />
            <input 
              type="text"
              placeholder="Search saved items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 pl-11 pr-5 bg-white/50 border border-border-base/60 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:border-primary/40 focus:ring-8 focus:ring-primary/5 transition-all outline-none w-full md:w-72 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-12">
        {resolvedSaved.unresolvedRefs.length > 0 && (
          <div className="px-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/50">
              {resolvedSaved.unresolvedRefs.length} saved {resolvedSaved.unresolvedRefs.length === 1 ? 'item is' : 'items are'} unavailable in the current backend snapshot.
            </p>
          </div>
        )}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="space-y-4" padding="md">
                    <Skeleton className="h-12 w-12 rounded-2xl" />
                    <Skeleton className="h-4 w-3/4" />
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
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-12"
            >
              <EmptyState
                variant="error"
                icon={AlertCircle}
                title="Sync Error"
                description={error}
                action={{
                  label: "Try Again",
                  onClick: () => {
                    setError(null);
                    setReloadKey((prev) => prev + 1);
                  }
                }}
              />
            </motion.div>
          ) : !hasResults(activeTab) ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-12"
            >
              <EmptyState
                icon={Bookmark}
                title={`No saved ${activeTab === 'all' ? 'items' : activeTab} yet`}
                description="Items you bookmark across AgentLink will appear here for quick access."
                action={{
                  label: "Explore Network",
                  onClick: () => router.push('/search')
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12"
            >
              {/* Agents Section */}
              {(activeTab === 'all' || activeTab === 'agents') && savedData.agents.length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                      <Users size={18} />
                    </div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-text-main">Saved Agents</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {savedData.agents.map((agent) => (
                      agent && (
                        <AgentResultCard 
                          key={agent.id} 
                          agent={agent} 
                          onClick={() => router.push(`/agents/${agent.handle}`)}
                          isSaved={true}
                          onToggleSave={(e) => handleToggleSave(e, agent.id, 'agent')}
                        />
                      )
                    ))}
                  </div>
                </section>
              )}

              {/* Jobs Section */}
              {(activeTab === 'all' || activeTab === 'jobs') && savedData.jobs.length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      <Briefcase size={18} />
                    </div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-text-main">Saved Jobs</h2>
                  </div>
                  <div className="space-y-4">
                    {savedData.jobs.map((job) => (
                      job && (
                        <JobResultCard 
                          key={job.id} 
                          job={job} 
                          onClick={() => router.push(`/jobs/${job.id}`)}
                          isSaved={true}
                          onToggleSave={(e) => handleToggleSave(e, job.id, 'job')}
                        />
                      )
                    ))}
                  </div>
                </section>
              )}

              {/* Organizations Section */}
              {(activeTab === 'all' || activeTab === 'organizations') && savedData.organizations.length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                      <Building2 size={18} />
                    </div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-text-main">Saved Organizations</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {savedData.organizations.map((org) => (
                      org && (
                        <OrgResultCard 
                          key={org.id} 
                          org={org} 
                          onClick={() => router.push(`/orgs/${org.slug}`)}
                          isSaved={true}
                          onToggleSave={(e) => handleToggleSave(e, org.id, 'organization')}
                        />
                      )
                    ))}
                  </div>
                </section>
              )}

              {/* Posts Section */}
              {(activeTab === 'all' || activeTab === 'posts') && savedData.posts.length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
                      <FileText size={18} />
                    </div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-text-main">Saved Posts</h2>
                  </div>
                  <div className="space-y-4">
                    {savedData.posts.map((post) => (
                      post && (
                        <PostResultCard 
                          key={post.id} 
                          post={post} 
                          onClick={() => router.push(`/posts/${post.id}`)}
                          isSaved={true}
                          onToggleSave={(e) => handleToggleSave(e, post.id, 'post')}
                        />
                      )
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
