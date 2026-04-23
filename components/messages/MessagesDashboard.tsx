'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Send, 
  MoreVertical, 
  Phone, 
  Video, 
  Info, 
  ChevronLeft,
  MessageSquare,
  User,
  Building2,
  Archive,
  BellOff,
  Trash2,
  CheckCircle2,
  Volume2,
  Inbox,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dropdown } from '@/components/ui/Dropdown';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { motion, AnimatePresence } from 'motion/react';
import { MessageThread, Message, Agent } from '@/lib/types';
import { MOCK_THREADS, MOCK_MESSAGES, MOCK_AGENTS } from '@/lib/data/seed';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function MessagesDashboard() {
  const [threads, setThreads] = useState<MessageThread[]>(MOCK_THREADS);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [localMessages, setLocalMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [archivedThreadIds, setArchivedThreadIds] = useState<Set<string>>(new Set());
  const [mutedThreadIds, setMutedThreadIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Simulate initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
        setIsLoading(false);
      }
    };

    loadData();
  }, [showArchived]);

  const currentUser = MOCK_AGENTS[0]; // Neural Master

  const filteredThreads = useMemo(() => {
    return threads.filter(thread => {
      const isArchived = archivedThreadIds.has(thread.id);
      if (showArchived && !isArchived) return false;
      if (!showArchived && isArchived) return false;

      const otherParticipant = thread.participants.find(p => p.id !== currentUser.id) as Agent;
      return otherParticipant?.displayName?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [threads, searchQuery, currentUser.id, archivedThreadIds, showArchived]);

  const selectedThread = useMemo(() => {
    return threads.find(t => t.id === selectedThreadId);
  }, [threads, selectedThreadId]);

  const threadMessages = useMemo(() => {
    if (!selectedThreadId) return [];
    return localMessages.filter(m => m.threadId === selectedThreadId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [localMessages, selectedThreadId]);

  const otherParticipant = useMemo(() => {
    if (!selectedThread) return null;
    return selectedThread.participants.find(p => p.id !== currentUser.id) as Agent;
  }, [selectedThread, currentUser.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [threadMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedThreadId) return;

    const message: Message = {
      id: `msg-new-${Date.now()}`,
      threadId: selectedThreadId,
      senderId: currentUser.id,
      content: newMessage,
      createdAt: new Date().toISOString(),
    };

    setLocalMessages(prev => [...prev, message]);
    setNewMessage('');

    // Update thread last message
    setThreads(prev => prev.map(t => 
      t.id === selectedThreadId 
        ? { ...t, lastMessage: message, updatedAt: message.createdAt } 
        : t
    ));
  };

  const handleSelectThread = (id: string) => {
    setSelectedThreadId(id);
    // Mark as read locally
    setThreads(prev => prev.map(t => t.id === id ? { ...t, unreadCount: 0 } : t));
  };

  const toggleArchive = (id: string) => {
    setArchivedThreadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.success('Conversation unarchived');
      } else {
        next.add(id);
        toast.success('Conversation archived');
        if (selectedThreadId === id) setSelectedThreadId(null);
      }
      return next;
    });
  };

  const toggleMute = (id: string) => {
    setMutedThreadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.info('Conversation unmuted');
      } else {
        next.add(id);
        toast.info('Conversation muted');
      }
      return next;
    });
  };

  const markAsUnread = (id: string) => {
    setThreads(prev => prev.map(t => t.id === id ? { ...t, unreadCount: 1 } : t));
    toast.info('Marked as unread');
  };

  const deleteThread = (id: string) => {
    setThreads(prev => prev.filter(t => t.id !== id));
    toast.error('Conversation deleted');
    if (selectedThreadId === id) setSelectedThreadId(null);
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex overflow-hidden bg-white/80 backdrop-blur-sm border border-border-base/60 rounded-3xl md:rounded-[2.5rem] shadow-subtle">
      {/* Sidebar: Thread List */}
      <div className={cn(
        "w-full md:w-80 lg:w-96 border-r border-border-base/60 flex flex-col bg-surface-alt/10",
        selectedThreadId ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-tighter italic">
              {showArchived ? 'Cold Storage' : 'Active Syncs'}
            </h2>
            <Dropdown
              trigger={
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/5 hover:text-primary transition-all">
                  <MoreVertical size={16} />
                </Button>
              }
              items={[
                { 
                  id: 'toggle-archived', 
                  label: showArchived ? 'View Inbox' : 'View Archived', 
                  icon: showArchived ? Inbox : Archive,
                  onClick: () => setShowArchived(!showArchived)
                },
                { 
                  id: 'mark-all-read', 
                  label: 'Mark all as read', 
                  icon: CheckCircle2,
                  onClick: () => {
                    setThreads(prev => prev.map(t => ({ ...t, unreadCount: 0 })));
                    toast.success('All messages marked as read');
                  }
                }
              ]}
            />
          </div>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted/40 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Query logs..." 
              className="pl-9 h-10 bg-white/50 border-border-base/40 rounded-xl text-[11px] font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="divide-y divide-border-base/50"
              >
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-4 flex gap-4">
                    <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : filteredThreads.length > 0 ? (
              <motion.div 
                key="threads"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="divide-y divide-border-base/50"
              >
                {filteredThreads.map((thread) => {
                  const other = thread.participants.find(p => p.id !== currentUser.id) as Agent;
                  const isActive = selectedThreadId === thread.id;
                  const isMuted = mutedThreadIds.has(thread.id);
                  const isArchived = archivedThreadIds.has(thread.id);

                  return (
                    <div key={thread.id} className="group relative">
                      <button
                        onClick={() => handleSelectThread(thread.id)}
                        className={cn(
                          "w-full p-5 flex gap-4 transition-all hover:bg-white/50 text-left relative",
                          isActive ? "bg-white shadow-sm" : "bg-transparent"
                        )}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                        )}
                        <div className="relative flex-shrink-0">
                          <Avatar src={other?.avatarUrl} alt={other?.displayName} size="md" className="rounded-xl border-2 border-white shadow-sm" />
                          {thread.unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full border-2 border-white" />
                          )}
                          {isMuted && (
                            <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-slate-200 rounded-full border-2 border-white flex items-center justify-center">
                              <BellOff size={8} className="text-text-muted" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex justify-between items-baseline">
                            <h3 className={cn(
                              "text-sm uppercase tracking-tight truncate",
                              thread.unreadCount > 0 ? "font-black" : "font-bold"
                            )}>
                              {other?.displayName}
                            </h3>
                            <span className="text-[10px] font-black text-text-muted/40 uppercase">
                              {formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: false })}
                            </span>
                          </div>
                          <p className={cn(
                            "text-xs truncate",
                            thread.unreadCount > 0 ? "text-text-main font-bold" : "text-text-muted"
                          )}>
                            {thread.lastMessage?.content}
                          </p>
                        </div>
                      </button>
                      
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Dropdown
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl bg-white/80 backdrop-blur-sm shadow-sm border border-border-base/50">
                              <MoreVertical size={14} />
                            </Button>
                          }
                          items={[
                            { 
                              id: 'mute', 
                              label: isMuted ? 'Unmute' : 'Mute', 
                              icon: isMuted ? Volume2 : BellOff,
                              onClick: () => toggleMute(thread.id)
                            },
                            { 
                              id: 'archive', 
                              label: isArchived ? 'Unarchive' : 'Archive', 
                              icon: isArchived ? Inbox : Archive,
                              onClick: () => toggleArchive(thread.id)
                            },
                            { 
                              id: 'unread', 
                              label: 'Mark as unread', 
                              icon: MessageSquare,
                              onClick: () => markAsUnread(thread.id)
                            },
                            { 
                              id: 'delete', 
                              label: 'Delete', 
                              icon: Trash2,
                              variant: 'danger',
                              onClick: () => deleteThread(thread.id)
                            }
                          ]}
                        />
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 px-4"
              >
                <EmptyState
                  variant="error"
                  icon={AlertCircle}
                  title="Connection Error"
                  description={error}
                  action={{
                    label: "Retry",
                    onClick: () => setShowArchived(showArchived)
                  }}
                />
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12"
              >
                <EmptyState
                  icon={searchQuery ? Search : Inbox}
                  title={searchQuery ? "No results found" : "No messages yet"}
                  description={searchQuery 
                    ? `We couldn't find any conversations matching "${searchQuery}".` 
                    : "Start a conversation with another agent or organization."}
                  action={searchQuery ? {
                    label: "Clear Search",
                    onClick: () => setSearchQuery('')
                  } : undefined}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content: Selected Thread */}
      <div className={cn(
        "flex-1 flex flex-col bg-white/40",
        !selectedThreadId ? "hidden md:flex" : "flex"
      )}>
        {selectedThread && otherParticipant ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedThread.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              {/* Thread Header */}
              <div className="h-20 px-4 md:px-8 border-b border-border-base/60 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-2 md:gap-4 min-w-0">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="md:hidden h-9 w-9 rounded-xl shrink-0"
                    onClick={() => setSelectedThreadId(null)}
                  >
                    <ChevronLeft size={18} />
                  </Button>
                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <Avatar src={otherParticipant.avatarUrl} alt={otherParticipant.displayName} size="sm" className="md:size-md rounded-xl border-2 border-white shadow-sm shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-sm md:text-base font-black uppercase tracking-tight leading-none italic truncate">{otherParticipant.displayName}</h3>
                      <div className="flex items-center gap-2 mt-1 md:mt-1.5">
                        <span className="h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span className="text-[8px] md:text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] truncate">Broadcasting Live</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 md:gap-2 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 rounded-xl text-text-muted hover:text-primary">
                    <Phone size={16} className="md:size-[18px]" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 rounded-xl text-text-muted hover:text-primary">
                    <Video size={16} className="md:size-[18px]" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 rounded-xl text-text-muted hover:text-primary hidden sm:flex">
                    <Info size={16} className="md:size-[18px]" />
                  </Button>
                </div>
              </div>

              {/* Message History */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 bg-surface-alt/5">
                {threadMessages.map((msg, idx) => {
                  const isMe = msg.senderId === currentUser.id;
                  const showAvatar = idx === 0 || threadMessages[idx - 1].senderId !== msg.senderId;
                  
                  return (
                    <div key={msg.id} className={cn(
                      "flex gap-4 max-w-[80%]",
                      isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}>
                      {!isMe && (
                        <div className="w-10 flex-shrink-0">
                          {showAvatar ? (
                            <Avatar src={otherParticipant.avatarUrl} alt={otherParticipant.displayName} size="sm" className="rounded-lg border border-white shadow-sm" />
                          ) : null}
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className={cn(
                          "p-4 rounded-2xl text-sm leading-relaxed shadow-subtle",
                          isMe 
                            ? "bg-text-main text-white rounded-tr-none" 
                            : "bg-white text-text-main border border-border-base/60 rounded-tl-none"
                        )}>
                          {msg.content}
                        </div>
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest text-text-muted/30 block",
                          isMe ? "text-right" : "text-left"
                        )}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <div className="p-6 border-t border-border-base/60 bg-white/80 backdrop-blur-md">
                <form onSubmit={handleSendMessage} className="flex gap-4 items-center">
                  <div className="flex-1 relative group">
                    <Input 
                      placeholder="Transmit signal..." 
                      className="h-14 bg-surface-alt/50 border-border-base/40 rounded-2xl text-[13px] font-bold pr-14 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <Button type="submit" size="icon" className="h-10 w-10 rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all" disabled={!newMessage.trim()}>
                        <Send size={16} />
                      </Button>
                    </div>
                  </div>
                </form>
                <p className="text-[9px] font-black text-text-muted/30 uppercase tracking-[0.3em] text-center mt-4">
                  Press Enter to transmit • Shift + Enter for new line
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <EmptyState
              icon={MessageSquare}
              title="Your Conversations"
              description="Select a thread from the sidebar to start messaging with recruiters, peer agents, or organizations."
            />
            <div className="grid grid-cols-2 gap-3 w-full max-w-md mt-8">
              <Card className="p-4 flex flex-col items-center gap-2 text-center bg-slate-50/50 border-dashed">
                <Building2 size={20} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">Provisioning Requests</span>
              </Card>
              <Card className="p-4 flex flex-col items-center gap-2 text-center bg-slate-50/50 border-dashed">
                <User size={20} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">Mesh Syncs</span>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
