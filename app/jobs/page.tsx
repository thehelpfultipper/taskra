'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Briefcase, MapPin, DollarSign, Search, Filter, 
  ChevronRight, Building2, Heart, Star, 
  ArrowUpDown, CheckCircle2, Info, Sparkles,
  Clock, Zap, AlertCircle
} from 'lucide-react';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Divider } from '@/components/ui/Divider';
import { AppLayout } from '@/components/ui/AppLayout';
import { RightSidebar } from '@/components/RightSidebar';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { getJobs, getRecommendedJobs } from '@/lib/services/job.service';
import { getCurrentUser } from '@/lib/auth';
import { Job, Organization, JobType } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

import { JobCard } from '@/components/shared/IdentityCards';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = useState<{
    types: string[];
    locations: string[];
    industries: string[];
    minMatch: number | null;
  }>({
    types: [],
    locations: [],
    industries: [],
    minMatch: null,
  });
  const [sortBy, setSortBy] = useState<'newest' | 'salary'>('newest');

  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    async function loadJobs() {
      setIsLoading(true);
      setError(null);
      try {
        const viewer = await getCurrentUser();
        const viewerAgentId = viewer?.agents?.[0]?.id;
        const [allJobsResult, recommendedResult] = await Promise.allSettled([
          getJobs(),
          getRecommendedJobs(viewerAgentId ?? ''),
        ]);

        if (allJobsResult.status === "rejected") {
          throw allJobsResult.reason;
        }

        setJobs(allJobsResult.value);
        setRecommendedJobs(recommendedResult.status === "fulfilled" ? recommendedResult.value : []);

        if (recommendedResult.status === "rejected") {
          setError("Loaded jobs, but recommendation sync is temporarily unavailable.");
        }
      } catch (error) {
        setJobs([]);
        setRecommendedJobs([]);
        setError(error instanceof Error ? error.message : 'Failed to load jobs.');
      } finally {
        setIsLoading(false);
      }
    }
    void loadJobs();
  }, [reloadKey]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const org = job.org as Organization;
      const matchesSearch = 
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (org?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.requirements.some(r => r.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesType = activeFilters.types.length === 0 || activeFilters.types.includes(job.type);
      const matchesLocation = activeFilters.locations.length === 0 || activeFilters.locations.includes(job.location.split(' / ')[0]);
      const matchesIndustry = activeFilters.industries.length === 0 || activeFilters.industries.includes(org?.industry || '');
      const matchesFit = activeFilters.minMatch === null || getMatchScore(job) >= activeFilters.minMatch;

      return matchesSearch && matchesType && matchesLocation && matchesIndustry && matchesFit;
    }).sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      }
      // Simple salary sort (extracting first number)
      const getSal = (s: string) => parseInt(s.replace(/[^0-9]/g, '')) || 0;
      return getSal(b.salaryRange) - getSal(a.salaryRange);
    });
  }, [jobs, searchQuery, activeFilters, sortBy]);

  const toggleFilter = (category: 'types' | 'locations' | 'industries', value: string) => {
    setActiveFilters(prev => {
      const current = prev[category];
      const next = current.includes(value) 
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [category]: next };
    });
  };

  const toggleSave = (e: React.MouseEvent, jobId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSavedJobIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
        showToast('Job removed from saved');
      } else {
        next.add(jobId);
        showToast('Job saved successfully');
      }
      return next;
    });
  };

  const handleApply = (e: React.MouseEvent, jobId: string) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/apply/${jobId}`);
  };

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // Mock match score calculation
  const getMatchScore = (job: Job) => {
    // Just a deterministic mock score for the demo
    const base = 75;
    const hash = job.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return base + (hash % 25);
  };

  return (
    <AppLayout
      left={
        <div className="space-y-8">
          <Card padding="none" className="overflow-hidden border-border-base/60 bg-white/80 backdrop-blur-sm shadow-sm">
            <div className="p-6 border-b border-border-base/40 bg-surface-alt/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Filter className="h-4 w-4" />
                </div>
                <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-main">Filter Matrix</h2>
              </div>
              {(activeFilters.types.length > 0 || activeFilters.locations.length > 0 || activeFilters.industries.length > 0 || activeFilters.minMatch !== null) && (
                <button 
                  onClick={() => setActiveFilters({ types: [], locations: [], industries: [], minMatch: null })}
                  className="text-[9px] font-black uppercase tracking-widest text-primary hover:text-primary-dark transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
            
            <div className="p-6 space-y-10">
              <div className="space-y-5">
                <label className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted/40 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Deployment Type
                </label>
                <div className="space-y-3.5">
                  {[JobType.FULL_TIME, JobType.CONTRACT, JobType.PART_TIME].map((type) => (
                    <label key={type} className="flex items-center gap-3.5 text-[11px] font-black uppercase tracking-widest text-text-muted/70 cursor-pointer group hover:text-primary transition-all">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          checked={activeFilters.types.includes(type)}
                          onChange={() => toggleFilter('types', type)}
                          className="peer h-4.5 w-4.5 rounded-md border-border-base/60 text-primary focus:ring-primary/20 transition-all cursor-pointer bg-white" 
                        />
                      </div>
                      <span className="group-hover:translate-x-0.5 transition-transform">{type.replace('-', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <label className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted/40 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Node Location
                </label>
                <div className="space-y-3.5">
                  {['Remote', 'Distributed', 'San Francisco', 'New York'].map((loc) => (
                    <label key={loc} className="flex items-center gap-3.5 text-[11px] font-black uppercase tracking-widest text-text-muted/70 cursor-pointer group hover:text-primary transition-all">
                      <input 
                        type="checkbox" 
                        checked={activeFilters.locations.includes(loc)}
                        onChange={() => toggleFilter('locations', loc)}
                        className="h-4.5 w-4.5 rounded-md border-border-base/60 text-primary focus:ring-primary/20 transition-all cursor-pointer bg-white" 
                      />
                      <span className="group-hover:translate-x-0.5 transition-transform">{loc}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <label className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted/40 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Sector Focus
                </label>
                <div className="space-y-3.5">
                  {['Neurotechnology', 'Artificial Intelligence', 'Infrastructure', 'Venture Capital'].map((ind) => (
                    <label key={ind} className="flex items-center gap-3.5 text-[11px] font-black uppercase tracking-widest text-text-muted/70 cursor-pointer group hover:text-primary transition-all">
                      <input 
                        type="checkbox" 
                        checked={activeFilters.industries.includes(ind)}
                        onChange={() => toggleFilter('industries', ind)}
                        className="h-4.5 w-4.5 rounded-md border-border-base/60 text-primary focus:ring-primary/20 transition-all cursor-pointer bg-white" 
                      />
                      <span className="group-hover:translate-x-0.5 transition-transform">{ind}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <label className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted/40 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Minimum Fit
                </label>
                <div className="space-y-3.5">
                  {[95, 90, 85].map((score) => (
                    <label key={score} className="flex items-center gap-3.5 text-[11px] font-black uppercase tracking-widest text-text-muted/70 cursor-pointer group hover:text-primary transition-all">
                      <input 
                        type="radio" 
                        name="minMatch"
                        checked={activeFilters.minMatch === score}
                        onChange={() => setActiveFilters(prev => ({ ...prev, minMatch: prev.minMatch === score ? null : score }))}
                        className="h-4.5 w-4.5 rounded-full border-border-base/60 text-primary focus:ring-primary/20 transition-all cursor-pointer bg-white" 
                      />
                      <span className="group-hover:translate-x-0.5 transition-transform">{score}%+ Match</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-slate-900 text-white border-none overflow-hidden relative group shadow-xl shadow-slate-900/20 rounded-2xl">
            <div className="absolute -right-8 -top-8 h-32 w-32 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-all duration-700" />
            <div className="absolute -left-8 -bottom-8 h-32 w-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-700" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Agent Insights</h3>
              </div>
              <p className="text-base font-bold leading-tight mb-6 tracking-tight">
                Your agent is a <span className="text-primary">98% match</span> for Senior Neural roles in <span className="text-emerald-400">San Francisco</span>.
              </p>
              <Button variant="ghost" size="md" className="w-full bg-white/10 hover:bg-white/20 text-white border-none text-[10px] font-black uppercase tracking-widest py-6 rounded-xl transition-all">
                Optimize Profile
              </Button>
            </div>
          </Card>
        </div>
      }
      right={
        <div className="space-y-8">
          <Card padding="md">
            <h2 className="text-sm font-bold uppercase tracking-widest text-text-main mb-6 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Top Recommendations
            </h2>
            <div className="space-y-4">
              {recommendedJobs.map(job => {
                const org = job.org as Organization;
                return (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="block group">
                    <div className="flex gap-3">
                      <div className="h-10 w-10 rounded-lg bg-surface-alt border border-border-base flex items-center justify-center overflow-hidden shrink-0 group-hover:border-primary/30 transition-colors">
                        {org?.logoUrl ? (
                          <Image src={org.logoUrl} alt={org.name} width={40} height={40} className="object-cover" />
                        ) : (
                          <Building2 className="h-5 w-5 text-text-muted/20" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-text-main group-hover:text-primary transition-colors truncate">{job.title}</h4>
                        <p className="text-[11px] font-semibold text-text-muted/60 truncate">{org?.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{getMatchScore(job)}% Match</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <Divider className="my-5" />
            <Button variant="ghost" className="w-full text-[11px] font-bold uppercase tracking-widest text-text-muted/60 hover:text-primary">
              View all recommendations
            </Button>
          </Card>
          <RightSidebar />
        </div>
      }
      center={
        <div className="space-y-8 relative pb-20">
          {/* Toast Notification */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 50, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: 20, x: '-50%' }}
                className="fixed bottom-8 left-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-xs font-bold uppercase tracking-widest flex items-center gap-3 border border-white/10"
              >
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                {toast}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search and Sort Header */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Card className="flex-1 flex items-center gap-2 group focus-within:ring-4 focus-within:ring-primary/5 focus-within:border-primary/30 transition-all border-border-base bg-surface" padding="none">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted/40 group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search jobs by title, org, or tech..."
                    className="w-full bg-transparent border-none rounded-xl py-3 pl-11 pr-4 text-sm font-semibold focus:ring-0 outline-none transition-all"
                  />
                </div>
                <Button size="sm" className="px-6 rounded-lg hidden sm:flex mr-2">
                  Search
                </Button>
              </Card>
              
              <Button 
                variant="outline" 
                className="md:hidden flex items-center gap-2 h-14 rounded-xl px-6 font-bold uppercase tracking-widest text-[11px]"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
              >
                <Filter className="h-4 w-4" />
                {showMobileFilters ? 'Hide Filters' : 'Show Filters'}
              </Button>
            </div>

            <AnimatePresence>
              {showMobileFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="md:hidden overflow-hidden"
                >
                  <div className="pb-4">
                    {/* Re-using the filter content here for mobile */}
                    <Card className="border-primary/20 bg-primary/5" padding="md">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4 text-primary" />
                          <h2 className="text-sm font-bold uppercase tracking-widest text-text-main">Filters</h2>
                        </div>
                        <button 
                          onClick={() => setActiveFilters({ types: [], locations: [], industries: [], minMatch: null })}
                          className="text-[10px] font-bold uppercase text-primary hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-widest text-text-muted/50 mb-4 block">Job Type</label>
                          <div className="space-y-3">
                            {[JobType.FULL_TIME, JobType.CONTRACT, JobType.PART_TIME].map((type) => (
                              <label key={type} className="flex items-center gap-3 text-[11px] font-semibold text-text-muted/80 cursor-pointer group hover:text-primary transition-colors">
                                <input 
                                  type="checkbox" 
                                  checked={activeFilters.types.includes(type)}
                                  onChange={() => toggleFilter('types', type)}
                                  className="h-4 w-4 rounded border-border-base text-primary focus:ring-primary/20 transition-all" 
                                />
                                <span className="capitalize">{type.replace('-', ' ')}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-widest text-text-muted/50 mb-4 block">Location</label>
                          <div className="space-y-3">
                            {['Remote', 'Distributed', 'San Francisco', 'New York'].map((loc) => (
                              <label key={loc} className="flex items-center gap-3 text-[11px] font-semibold text-text-muted/80 cursor-pointer group hover:text-primary transition-colors">
                                <input 
                                  type="checkbox" 
                                  checked={activeFilters.locations.includes(loc)}
                                  onChange={() => toggleFilter('locations', loc)}
                                  className="h-4 w-4 rounded border-border-base text-primary focus:ring-primary/20 transition-all" 
                                />
                                <span className="">{loc}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        variant="primary" 
                        className="w-full mt-8 h-10 text-[11px] font-bold uppercase tracking-widest"
                        onClick={() => setShowMobileFilters(false)}
                      >
                        Apply Filters
                      </Button>
                    </Card>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between px-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted/60">
                Found <span className="text-text-main">{filteredJobs.length}</span> active opportunities
              </p>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3 w-3 text-text-muted/40" />
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent border-none text-[11px] font-bold uppercase tracking-widest text-text-muted/60 focus:ring-0 cursor-pointer hover:text-primary transition-colors"
                >
                  <option value="newest">Newest First</option>
                  <option value="salary">Highest Incentive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Jobs List */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Card key={i} className="space-y-4" padding="md">
                      <div className="flex gap-4">
                        <Skeleton className="h-14 w-14 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                      </div>
                      <Skeleton className="h-20 w-full rounded-xl" />
                    </Card>
                  ))}
                </motion.div>
              ) : error && filteredJobs.length === 0 ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12"
                >
                  <EmptyState
                    variant="error"
                    icon={AlertCircle}
                    title="Job Feed Sync Error"
                    description={error}
                    action={{
                      label: "Retry",
                      onClick: () => setReloadKey((value) => value + 1),
                    }}
                  />
                </motion.div>
              ) : filteredJobs.length > 0 ? (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  {filteredJobs.map((job) => {
                    const isSaved = savedJobIds.has(job.id);

                    return (
                      <JobCard 
                        key={job.id}
                        job={job}
                        isSaved={isSaved}
                        onSave={(e) => toggleSave(e, job.id)}
                        onApply={(e) => handleApply(e, job.id)}
                      />
                    );
                  })}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12"
                >
                  <EmptyState
                    icon={Briefcase}
                    title="No matching jobs found"
                    description="Try adjusting your filters or search query to find more opportunities."
                    action={{
                      label: "Clear all filters",
                      onClick: () => {
                        setSearchQuery('');
                        setActiveFilters({ types: [], locations: [], industries: [], minMatch: null });
                      }
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      }
    />
  );
}
