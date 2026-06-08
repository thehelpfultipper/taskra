'use client';

import { useEffect, useMemo, useState } from 'react';
import { resolveNotificationViewHref } from '@/lib/navigation-links';
import { 
  Bell, 
  Briefcase, 
  Users, 
  MessageSquare, 
  FileText, 
  Zap, 
  UserPlus, 
  Eye, 
  Building2, 
  CheckCircle2, 
  MoreHorizontal,
  Trash2,
  Check,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dropdown } from '@/components/ui/Dropdown';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { motion, AnimatePresence } from 'motion/react';
import { Notification } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import { Inbox, BellOff } from 'lucide-react';
import { getNotifications } from '@/lib/services/notifications.service';

type NotificationFilter = 'all' | 'jobs' | 'network' | 'posts' | 'applications';

const FILTER_CONFIG: Record<NotificationFilter, { label: string; icon: any }> = {
  all: { label: 'All', icon: Bell },
  jobs: { label: 'Jobs', icon: Briefcase },
  network: { label: 'Network', icon: Users },
  posts: { label: 'Posts', icon: MessageSquare },
  applications: { label: 'Applications', icon: FileText },
};

const TYPE_TO_FILTER: Record<string, NotificationFilter> = {
  job_alert: 'jobs',
  job_recommendation: 'jobs',
  org_update: 'jobs',
  connection_request: 'network',
  endorsement: 'network',
  profile_view: 'network',
  reaction: 'posts',
  mention: 'posts',
  post_engagement: 'posts',
  app_status_change: 'applications',
};

const TYPE_CONFIG: Record<string, { icon: any; color: string; bgColor: string }> = {
  job_alert: { icon: Briefcase, color: 'text-primary', bgColor: 'bg-primary/10' },
  job_recommendation: { icon: Zap, color: 'text-amber-500', bgColor: 'bg-amber-50' },
  org_update: { icon: Building2, color: 'text-text-muted', bgColor: 'bg-surface-alt' },
  connection_request: { icon: UserPlus, color: 'text-primary', bgColor: 'bg-primary/10' },
  endorsement: { icon: Zap, color: 'text-amber-500', bgColor: 'bg-amber-50' },
  profile_view: { icon: Eye, color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
  reaction: { icon: Zap, color: 'text-rose-500', bgColor: 'bg-rose-50' },
  mention: { icon: MessageSquare, color: 'text-sky-500', bgColor: 'bg-sky-50' },
  post_engagement: { icon: Zap, color: 'text-orange-500', bgColor: 'bg-orange-50' },
  app_status_change: { icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
};

export default function NotificationsDashboard() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const rows = await getNotifications();
        setNotifications(rows);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
        setIsLoading(false);
      }
    };

    loadData();
  }, [reloadKey]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return notifications.filter(n => TYPE_TO_FILTER[n.type] === activeFilter);
  }, [notifications, activeFilter]);

  const groupedNotifications = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    const groups: Record<string, Notification[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    filteredNotifications.forEach(n => {
      const date = n.createdAt.split('T')[0];
      if (date === today) groups.Today.push(n);
      else if (date === yesterday) groups.Yesterday.push(n);
      else groups.Earlier.push(n);
    });

    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [filteredNotifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    toast.success('All notifications marked as read');
  };

  const handleMarkRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleClearGroup = (ids: string[]) => {
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
    toast.info('Group cleared');
  };

  const handleDelete = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast.info('Notification removed');
  };

  const getDestinationLink = (notif: Notification) => resolveNotificationViewHref(notif);

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">Notifications</h1>
          </div>
          <p className="text-text-muted/60 font-bold text-[11px] uppercase tracking-widest ml-16">
            Stay updated on your agent&apos;s visibility and opportunities.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black px-3 py-1 text-[10px] tracking-widest">
              {unreadCount} UNREAD
            </Badge>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-[9px] font-black uppercase tracking-widest text-text-muted/60 hover:text-primary hover:bg-primary/5"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            Mark all as read
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide">
        {(Object.keys(FILTER_CONFIG) as NotificationFilter[]).map((filter) => {
          const Config = FILTER_CONFIG[filter];
          const isActive = activeFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                isActive 
                  ? "bg-text-main text-white border-text-main shadow-xl shadow-text-main/10" 
                  : "bg-white/80 backdrop-blur-sm text-text-muted/60 border-border-base/60 hover:border-text-main/30 hover:text-text-main"
              )}
            >
              <Config.icon size={14} strokeWidth={3} />
              {Config.label}
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      <div className="space-y-10">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {[1, 2].map((group) => (
                <div key={group} className="space-y-4">
                  <div className="flex items-center gap-4 px-2">
                    <Skeleton className="h-4 w-16" />
                    <div className="h-px flex-1 bg-border-base/50" />
                  </div>
                  <div className="grid gap-3">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="p-4 flex gap-4 items-center">
                        <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
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
                title="Sync Error"
                description={error}
                action={{
                  label: "Retry Sync",
                  onClick: () => setReloadKey((value) => value + 1)
                }}
              />
            </motion.div>
          ) : groupedNotifications.length > 0 ? (
            groupedNotifications.map(([group, items]) => (
              <div key={group} className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-4 flex-1">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted/40 whitespace-nowrap">{group}</h2>
                    <div className="h-px flex-1 bg-border-base/30" />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="xs" 
                    className="text-[9px] font-black uppercase tracking-widest text-text-muted/30 hover:text-primary ml-4 h-auto p-0"
                    onClick={() => handleClearGroup(items.map(i => i.id))}
                  >
                    Clear
                  </Button>
                </div>

                <div className="grid gap-3">
                  {items.map((notif) => {
                    const Config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.reaction;
                    return (
                      <motion.div
                        key={notif.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group relative"
                      >
                        <Card 
                          className={cn(
                            "p-5 flex gap-5 items-center transition-all duration-300 border-l-4 rounded-2xl shadow-subtle",
                            notif.isRead 
                              ? "bg-white/80 backdrop-blur-sm border-l-transparent border-border-base/40" 
                              : "bg-white border-l-primary shadow-md border-border-base/60"
                          )}
                        >
                          {/* Icon/Avatar Section */}
                          <div className="relative flex-shrink-0">
                            {notif.actor ? (
                              <Avatar 
                                src={notif.actor.avatarUrl} 
                                alt={notif.actor.name} 
                                size="md"
                                className="border-2 border-white shadow-sm"
                              />
                            ) : (
                              <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center border border-transparent", Config.bgColor)}>
                                <Config.icon className={cn("h-6 w-6", Config.color)} />
                              </div>
                            )}
                            <div className={cn(
                              "absolute -bottom-1 -right-1 h-6 w-6 rounded-lg flex items-center justify-center border-2 border-white shadow-sm",
                              Config.bgColor
                            )}>
                              <Config.icon className={cn("h-3 w-3", Config.color)} />
                            </div>
                          </div>

                          {/* Content Section */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col">
                              <p className="text-sm leading-relaxed">
                                {notif.actor && (
                                  <span className="font-black text-[11px] uppercase tracking-widest text-text-main mr-1.5">
                                    {notif.actor.name}
                                  </span>
                                )}
                                <span className={cn("font-medium text-text-main", !notif.isRead && "font-bold")}>
                                  {notif.content}
                                </span>
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-black text-text-muted/40 uppercase tracking-widest">
                                  {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {!notif.isRead && (
                                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions Section */}
                          <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            {!notif.isRead && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-xl text-emerald-500 hover:bg-emerald-50"
                                onClick={() => handleMarkRead(notif.id)}
                                title="Mark as read"
                              >
                                <Check size={14} />
                              </Button>
                            )}
                            <Link href={getDestinationLink(notif)}>
                              <Button 
                                size="sm" 
                                className="h-8 px-4 text-[9px] font-black uppercase tracking-widest"
                                onClick={() => handleMarkRead(notif.id)}
                              >
                                View
                              </Button>
                            </Link>
                            
                            <Dropdown
                              trigger={
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                                  <MoreHorizontal size={14} className="text-text-muted" />
                                </Button>
                              }
                              items={[
                                { 
                                  id: 'read', 
                                  label: notif.isRead ? 'Mark as unread' : 'Mark as read', 
                                  icon: notif.isRead ? Bell : Check,
                                  onClick: () => setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: !n.isRead } : n))
                                },
                                { 
                                  id: 'delete', 
                                  label: 'Remove', 
                                  icon: Trash2,
                                  variant: 'danger',
                                  onClick: () => handleDelete(notif.id)
                                }
                              ]}
                            />
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-12"
            >
              <EmptyState
                icon={activeFilter === 'all' ? BellOff : Inbox}
                title={activeFilter === 'all' ? "No notifications yet" : "No results found"}
                description={activeFilter === 'all' 
                  ? "We'll notify you when something important happens." 
                  : `We couldn't find any notifications for the "${FILTER_CONFIG[activeFilter].label}" filter.`}
                action={activeFilter !== 'all' ? {
                  label: "Clear Filters",
                  onClick: () => setActiveFilter('all')
                } : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
