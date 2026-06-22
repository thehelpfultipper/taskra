'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Search, 
  Clock, 
  CheckCircle2, 
  Circle, 
  XCircle, 
  ChevronRight,
  FileText,
  Building2,
  Calendar,
  MoreHorizontal,
  ArrowUpRight,
  Filter,
  ArrowUpDown,
  Copy,
  Trash2,
  Eye,
  ExternalLink,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { Dropdown } from '@/components/ui/Dropdown';
import { Modal } from '@/components/ui/Modal';
import { Application, ApplicationStatus } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { getCurrentUser } from '@/lib/auth';
import { getApplicationsForAgent } from '@/lib/services/agent.service';
import { applicationAnchorId } from '@/lib/navigation-links';
import { Avatar } from '@/components/ui/Avatar';
import { orgAvatarProps } from '@/lib/avatar-utils';

import { ApplicationCard } from '@/components/shared/IdentityCards';

const statusConfig = {
  [ApplicationStatus.DRAFT]: { label: 'Draft', variant: 'secondary' as const, icon: Clock },
  [ApplicationStatus.SUBMITTED]: { label: 'Submitted', variant: 'primary' as const, icon: CheckCircle2 },
  [ApplicationStatus.SCREENING]: { label: 'Screening', variant: 'primary' as const, icon: Search },
  [ApplicationStatus.INTERVIEW]: { label: 'Interview', variant: 'warning' as const, icon: Calendar },
  [ApplicationStatus.OFFER]: { label: 'Offer', variant: 'success' as const, icon: ArrowUpRight },
  [ApplicationStatus.REJECTED]: { label: 'Rejected', variant: 'error' as const, icon: XCircle },
  [ApplicationStatus.WITHDRAWN]: { label: 'Withdrawn', variant: 'outline' as const, icon: XCircle },
};

type SortOption = 'newest' | 'oldest' | 'company' | 'status';

export default function ApplicationsPage() {
  const searchParams = useSearchParams();
  const targetApplicationId = searchParams.get('application');
  const [applications, setApplications] = useState<Application[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<SortOption>('newest');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [highlightedApplicationId, setHighlightedApplicationId] = useState<string | null>(null);
  const deepLinkHandledRef = useRef<string | null>(null);

  React.useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const user = await getCurrentUser();
        if (!user?.agents?.length) {
          setApplications([]);
          setError("No managed agents are available yet.");
          return;
        }

        const results = await Promise.allSettled(user.agents.map((agent) => getApplicationsForAgent(agent.id)));
        const allApps: Application[] = [];
        let failedLoads = 0;

        for (const result of results) {
          if (result.status === "fulfilled") {
            allApps.push(...result.value);
          } else {
            failedLoads += 1;
          }
        }

        const uniqueApps = Array.from(new Map(allApps.map((app) => [app.id, app])).values());
        setApplications(uniqueApps);

        if (failedLoads > 0) {
          setError(`Loaded partial application data. ${failedLoads} source${failedLoads === 1 ? "" : "s"} failed to sync.`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [reloadKey]);

  useEffect(() => {
    if (!targetApplicationId) {
      return;
    }
    setHighlightedApplicationId(targetApplicationId);
    setActiveTab('all');
    deepLinkHandledRef.current = null;
  }, [targetApplicationId]);

  useEffect(() => {
    if (!targetApplicationId || isLoading) {
      return;
    }

    let highlightTimeoutId: number | undefined;
    const match = applications.find((app) => app.id === targetApplicationId);

    if (!match) {
      toast.info('That application is not in your deployment log.');
      return;
    }

    if (deepLinkHandledRef.current === targetApplicationId) {
      return;
    }
    deepLinkHandledRef.current = targetApplicationId;

    window.requestAnimationFrame(() => {
      document.getElementById(applicationAnchorId(targetApplicationId))?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });

    highlightTimeoutId = window.setTimeout(() => {
      setHighlightedApplicationId((current) => (current === targetApplicationId ? null : current));
    }, 4000);

    return () => {
      if (highlightTimeoutId !== undefined) {
        window.clearTimeout(highlightTimeoutId);
      }
    };
  }, [targetApplicationId, isLoading, applications]);

  const filteredAndSortedApplications = useMemo(() => {
    let result = applications.filter(app => {
      const matchesSearch = 
        app.job?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.job?.org?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTab = activeTab === 'all' || app.status === activeTab;
      
      return matchesSearch && matchesTab;
    });

    result.sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortOrder === 'company') return (a.job?.org?.name || '').localeCompare(b.job?.org?.name || '');
      if (sortOrder === 'status') return a.status.localeCompare(b.status);
      return 0;
    });

    return result;
  }, [applications, searchQuery, activeTab, sortOrder]);

  const stats = useMemo(() => {
    return {
      total: applications.length,
      active: applications.filter(app => 
        [ApplicationStatus.SUBMITTED, ApplicationStatus.SCREENING, ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER].includes(app.status)
      ).length,
      interviews: applications.filter(app => app.status === ApplicationStatus.INTERVIEW).length,
      offers: applications.filter(app => app.status === ApplicationStatus.OFFER).length,
    };
  }, [applications]);

  const handleWithdraw = (id: string) => {
    void id;
    toast.info('Status updates are backend-driven in MVP; manual withdraw is not supported here yet.');
  };

  const handleDuplicate = (app: Application) => {
    void app;
    toast.info('Application duplication is not supported in MVP.');
  };

  const handleDelete = (id: string) => {
    void id;
    toast.info('Application deletion is not supported in MVP.');
  };

  const tabs = [
    { id: 'all', label: 'All', count: applications.length },
    { id: ApplicationStatus.SUBMITTED, label: 'Submitted', count: applications.filter(a => a.status === ApplicationStatus.SUBMITTED).length },
    { id: ApplicationStatus.SCREENING, label: 'Screening', count: applications.filter(a => a.status === ApplicationStatus.SCREENING).length },
    { id: ApplicationStatus.INTERVIEW, label: 'Interview', count: applications.filter(a => a.status === ApplicationStatus.INTERVIEW).length },
    { id: ApplicationStatus.OFFER, label: 'Offer', count: applications.filter(a => a.status === ApplicationStatus.OFFER).length },
    { id: ApplicationStatus.REJECTED, label: 'Rejected', count: applications.filter(a => a.status === ApplicationStatus.REJECTED).length },
  ];

  const sortItems = [
    { id: 'newest', label: 'Newest First', icon: Clock, onClick: () => setSortOrder('newest') },
    { id: 'oldest', label: 'Oldest First', icon: Clock, onClick: () => setSortOrder('oldest') },
    { id: 'company', label: 'Company A-Z', icon: Building2, onClick: () => setSortOrder('company') },
    { id: 'status', label: 'By Status', icon: Filter, onClick: () => setSortOrder('status') },
  ];

  return (
    <div className="pb-8 md:pb-12">
      <PageHeader
        icon={FileText}
        title="Applications"
        description="Monitor and manage your agent deployment sequences across the neural network."
        actions={
          <>
            <Button variant="outline" size="md" className="rounded-xl border-border-base/60 text-[10px] font-black uppercase tracking-widest h-11 px-6">
              Export Manifest
            </Button>
            <Button variant="primary" size="md" className="rounded-xl shadow-lg shadow-primary/10 text-[10px] font-black uppercase tracking-widest h-11 px-6">
              New Deployment
            </Button>
          </>
        }
        className="mb-12"
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
        <StatCard title="Total Sequences" value={stats.total} icon={FileText} color="text-primary" />
        <StatCard title="Active Pipelines" value={stats.active} icon={RefreshCw} color="text-primary" />
        <StatCard title="Interviews" value={stats.interviews} icon={Calendar} color="text-amber-500" />
        <StatCard title="Offers Secured" value={stats.offers} icon={ArrowUpRight} color="text-emerald-500" />
      </div>

      <div className="flex flex-col gap-8 mb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="relative w-full sm:w-80 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted/40 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search by job or company..." 
                className="pl-11 h-11 rounded-xl border-border-base/60 bg-white/50 focus:bg-white transition-all text-[13px] font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Dropdown 
              trigger={
                <Button variant="outline" className="h-11 rounded-xl border-border-base/60 text-[10px] font-black uppercase tracking-widest px-5 hover:bg-white" leftIcon={<ArrowUpDown size={14} className="text-text-muted/40" />}>
                  Sort Matrix
                </Button>
              }
              items={sortItems}
            />
          </div>
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted/40">
            <Filter size={12} />
            <span>Filter by Status</span>
          </div>
          <Tabs 
            tabs={tabs} 
            activeTab={activeTab} 
            onChange={setActiveTab} 
            variant="pills"
            className="flex-wrap gap-2"
          />
        </div>
      </div>

      <div className="grid gap-6">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <motion.div
                key={`skeleton-${i}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card padding="md">
                  <div className="flex items-center gap-6">
                    <Skeleton className="h-16 w-16 rounded-2xl" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-6 w-1/3" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                    <Skeleton className="h-10 w-32 rounded-xl" />
                  </div>
                </Card>
              </motion.div>
            ))
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-12"
            >
              <EmptyState
                variant="error"
                icon={AlertCircle}
                title="Connection Error"
                description={error}
                action={{
                  label: "Try Reconnecting",
                  onClick: () => setReloadKey((value) => value + 1)
                }}
              />
            </motion.div>
          ) : filteredAndSortedApplications.length > 0 ? (
            filteredAndSortedApplications.map((app) => (
              <motion.div
                key={app.id}
                id={applicationAnchorId(app.id)}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'rounded-2xl transition-shadow duration-500',
                  highlightedApplicationId === app.id && 'ring-2 ring-primary/50 shadow-lg shadow-primary/10',
                )}
              >
                <ApplicationCard 
                  application={app} 
                  onWithdraw={() => handleWithdraw(app.id)}
                  onDuplicate={() => handleDuplicate(app)}
                  onDelete={() => handleDelete(app.id)}
                  onView={() => setSelectedApp(app)}
                />
              </motion.div>
            ))
          ) : applications.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={FileText}
                title="No deployments yet"
                description="This log tracks job applications submitted by your managed agents. Browse open roles and apply to start building a pipeline."
                action={{
                  label: "Browse open deployments",
                  onClick: () => {
                    window.location.href = '/jobs';
                  },
                }}
              />
            </div>
          ) : (
            <div className="py-12">
              <EmptyState
                icon={Search}
                title="No applications found"
                description="Try adjusting your search or filters to find what you're looking for."
                action={{
                  label: "Clear all filters",
                  onClick: () => {
                    setSearchQuery('');
                    setActiveTab('all');
                  }
                }}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        title="Application Details"
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setSelectedApp(null)}>Close</Button>
            {selectedApp?.jobId && (
              <Link 
                href={`/jobs/${selectedApp.jobId}`}
                className="inline-flex items-center justify-center font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none select-none bg-primary text-white hover:bg-primary-hover shadow-sm px-5 py-2 text-xs rounded-xl uppercase tracking-widest"
              >
                View Full Job Listing
              </Link>
            )}
          </div>
        }
      >
        {selectedApp && (
          <div className="space-y-8">
            <div className="flex items-center gap-6">
              <Avatar
                {...orgAvatarProps(selectedApp.job?.org ?? { name: 'Organization' })}
                size="lg"
                shape="square"
                imageSizes="80px"
                className="h-20 w-20 rounded-2xl"
              />
              <div>
                <h2 className="text-2xl font-black tracking-tighter uppercase">{selectedApp.job?.title}</h2>
                <div className="flex items-center gap-2 text-text-muted font-bold mt-1">
                  <Link href={`/organizations/${selectedApp.job?.org?.slug}`} className="hover:text-primary transition-colors">
                    {selectedApp.job?.org?.name}
                  </Link>
                  <span>•</span>
                  <span>{selectedApp.job?.location}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <DetailItem label="Status" value={
                <Badge variant={statusConfig[selectedApp.status].variant}>
                  {statusConfig[selectedApp.status].label}
                </Badge>
              } />
              <DetailItem label="Current Stage" value={selectedApp.currentStage} />
              <DetailItem label="Applied On" value={formatDistanceToNow(new Date(selectedApp.createdAt), { addSuffix: true })} />
              <DetailItem label="Last Update" value={formatDistanceToNow(new Date(selectedApp.updatedAt), { addSuffix: true })} />
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-text-muted">Pipeline Timeline</h3>
              <div className="space-y-4">
                {selectedApp.pipeline.map((stage, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all",
                        stage.status === 'completed' ? "bg-emerald-500 border-emerald-500 text-white" :
                        stage.status === 'current' ? "bg-primary border-primary text-white animate-pulse" :
                        stage.status === 'failed' ? "bg-rose-500 border-rose-500 text-white" :
                        "bg-white border-border-base text-text-muted"
                      )}>
                        {stage.status === 'completed' ? <CheckCircle2 size={12} /> : 
                         stage.status === 'failed' ? <XCircle size={12} /> :
                         <div className="h-1.5 w-1.5 rounded-full bg-current" />}
                      </div>
                      {idx !== selectedApp.pipeline.length - 1 && (
                        <div className="w-0.5 h-full bg-border-base my-1" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className={cn(
                        "text-xs font-black uppercase tracking-widest",
                        stage.status === 'current' ? "text-primary" : "text-text-main"
                      )}>
                        {stage.stage}
                      </p>
                      {stage.completedAt && (
                        <p className="text-[10px] font-bold text-text-muted mt-0.5">
                          Completed {formatDistanceToNow(new Date(stage.completedAt), { addSuffix: true })}
                        </p>
                      )}
                      {stage.status === 'current' && (
                        <p className="text-[10px] font-bold text-primary mt-0.5">Active Stage</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedApp.artifacts && selectedApp.artifacts.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-text-muted">Submitted Artifacts</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedApp.artifacts.map(art => (
                    <div key={art.id} className="flex items-center gap-3 p-3 rounded-2xl bg-surface-alt border border-border-base hover:border-primary/20 transition-all cursor-pointer group">
                      <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-widest truncate" title={art.title}>{art.title}</p>
                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">{art.type}</p>
                      </div>
                      <ExternalLink size={14} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailItem({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">{label}</p>
      <div className="text-xs font-bold text-text-main">{value}</div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: string }) {
  return (
    <Card className="hover:shadow-xl transition-all duration-500 group border-border-base/60 bg-white/80 backdrop-blur-sm overflow-hidden relative" padding="none">
      <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-surface-alt rounded-full blur-2xl group-hover:bg-primary/5 transition-all duration-700" />
      <div className="p-6 flex items-center justify-between relative z-10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted/40 mb-2">{title}</p>
          <p className="text-4xl font-black tracking-tighter text-text-main">{value}</p>
        </div>
        <div className={cn("h-14 w-14 rounded-2xl bg-surface-alt flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm border border-border-base/40", color)}>
          <Icon size={24} strokeWidth={2.5} />
        </div>
      </div>
    </Card>
  );
}
