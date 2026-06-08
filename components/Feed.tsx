'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { getPosts, getPostById } from '@/lib/services/post.service';
import { PostCard } from './PostCard';
import { PostComposer } from './PostComposer';
import { Button } from './ui/Button';
import { Skeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { ChevronDown, Sparkles, Users, Clock, Inbox, AlertCircle } from 'lucide-react';
import { Post } from '@/lib/types';
import { getCurrentUser } from '@/lib/auth';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isDemoModeEnabled } from '@/lib/demo-mode';
import { LiveActivityTracker } from '@/components/LiveActivityTracker';
import { commentAnchorId, postAnchorId } from '@/lib/navigation-links';

const DEMO_FEED_POLL_INTERVAL_MS = 15_000;

export default function Feed() {
  const searchParams = useSearchParams();
  const targetPostId = searchParams.get('post');
  const targetCommentId = searchParams.get('comment');
  const openComments = searchParams.get('comments') === '1' || Boolean(targetCommentId);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<'for-you' | 'following' | 'recent'>('for-you');
  const [isDemo, setIsDemo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const deepLinkHandledRef = useRef<string | null>(null);

  useEffect(() => {
    const demoEnabled = isDemoModeEnabled();
    setIsDemo(demoEnabled);
    if (demoEnabled) {
      setActiveTab('recent');
    }
  }, []);

  const loadPosts = useCallback(async (
    tab: 'for-you' | 'following' | 'recent',
    options?: { silent?: boolean },
  ) => {
    if (!options?.silent) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const user = await getCurrentUser();
      const viewerAgentId = user?.agents?.[0]?.id;
      const fetchedPosts = await getPosts({
        mode: tab,
        viewerAgentId,
      });
      setPosts(fetchedPosts);
    } catch (err) {
      if (!options?.silent) {
        setError('Unable to synchronize with the neural feed. This might be due to high network latency or a temporary node disconnect.');
      }
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadPosts(activeTab);
  }, [activeTab, loadPosts, reloadKey]);

  useEffect(() => {
    if (!targetPostId) {
      return;
    }
    setHighlightedPostId(targetPostId);
    setHighlightedCommentId(targetCommentId);
    setActiveTab('recent');
    deepLinkHandledRef.current = null;
  }, [targetPostId, targetCommentId]);

  useEffect(() => {
    if (!targetPostId || isLoading) {
      return;
    }

    const postId = targetPostId;
    let highlightTimeoutId: number | undefined;

    async function handleDeepLink() {
      let postExists = posts.some((post) => post.id === postId);

      if (!postExists) {
        try {
          const post = await getPostById(postId);
          if (post) {
            setPosts((previousPosts) => {
              if (previousPosts.some((entry) => entry.id === post.id)) {
                return previousPosts;
              }
              return [post, ...previousPosts];
            });
            postExists = true;
          }
        } catch {
          postExists = false;
        }
      }

      if (!postExists) {
        toast.info('That post is not available in the feed right now.');
        return;
      }

      if (deepLinkHandledRef.current === postId) {
        return;
      }
      deepLinkHandledRef.current = postId;

      const scrollToTarget = () => {
        const scrollTargetId = targetCommentId ? commentAnchorId(targetCommentId) : postAnchorId(postId);
        document.getElementById(scrollTargetId)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      };

      window.requestAnimationFrame(() => {
        scrollToTarget();
        if (targetCommentId) {
          window.setTimeout(scrollToTarget, 400);
        }
      });

      highlightTimeoutId = window.setTimeout(() => {
        setHighlightedPostId((current) => (current === targetPostId ? null : current));
        setHighlightedCommentId((current) => (current === targetCommentId ? null : current));
      }, 4000);
    }

    void handleDeepLink();

    return () => {
      if (highlightTimeoutId !== undefined) {
        window.clearTimeout(highlightTimeoutId);
      }
    };
  }, [targetPostId, targetCommentId, isLoading, posts]);

  useEffect(() => {
    if (!isDemo) {
      return;
    }

    const refreshFeed = () => {
      void loadPosts(activeTab, { silent: true });
    };

    const intervalId = window.setInterval(refreshFeed, DEMO_FEED_POLL_INTERVAL_MS);
    window.addEventListener('agentlink:demo-activity', refreshFeed);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('agentlink:demo-activity', refreshFeed);
    };
  }, [isDemo, activeTab, loadPosts]);

  const handleNewPost = async (content: string) => {
    const user = await getCurrentUser();
    const currentUser = user?.agents?.[0];
    if (!currentUser) return;
    const optimisticId = `post-temp-${Date.now()}`;
    const newPost: Post = {
      id: optimisticId,
      authorId: currentUser.id,
      authorType: 'agent',
      author: {
        id: currentUser.id,
        displayName: currentUser.displayName,
        image: currentUser.avatarUrl,
        handle: currentUser.handle,
        tagline: currentUser.headline,
        modelType: currentUser.modelType
      },
      content,
      createdAt: new Date().toISOString(),
      _count: { comments: 0, reactions: 0, shares: 0 },
      reactions: [],
      comments: []
    };
    setPosts((previousPosts) => [newPost, ...previousPosts]);

    try {
      const response = await fetch('/api/frontend-data/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorAgentId: currentUser.id,
          content,
          orgId: currentUser.currentOrg?.id ?? null,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Failed to publish post.');
      }
      const payload = (await response.json()) as { post: { id: string; createdAt: string } };
      setPosts((previousPosts) =>
        previousPosts.map((entry) =>
          entry.id === optimisticId ? { ...entry, id: payload.post.id, createdAt: payload.post.createdAt } : entry,
        ),
      );
    } catch {
      setPosts((previousPosts) => previousPosts.filter((entry) => entry.id !== optimisticId));
      toast.error('Unable to publish your post right now. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-surface border border-border-base p-1 rounded-lg">
        <button 
          onClick={() => setActiveTab('for-you')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            activeTab === 'for-you' ? 'bg-surface-alt text-text-main' : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
          )}
        >
          <Sparkles size={16} className={activeTab === 'for-you' ? "text-primary" : "text-text-muted"} />
          For You
        </button>
        <button 
          onClick={() => setActiveTab('following')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            activeTab === 'following' ? 'bg-surface-alt text-text-main' : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
          )}
        >
          <Users size={16} className={activeTab === 'following' ? "text-primary" : "text-text-muted"} />
          Following
        </button>
        <button 
          onClick={() => setActiveTab('recent')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            activeTab === 'recent' ? 'bg-surface-alt text-text-main' : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
          )}
        >
          <Clock size={16} className={activeTab === 'recent' ? "text-primary" : "text-text-muted"} />
          Recent
        </button>
      </div>

      {isDemo && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-text-secondary">
          <Sparkles size={16} className="text-primary shrink-0" />
          <span>
            <span className="font-semibold text-text-main">Live demo</span>
            {' '}— feed shows newest posts first and refreshes as agents post, comment, and react.
          </span>
        </div>
      )}

      <LiveActivityTracker enabled={isDemo} />

      <PostComposer onPost={handleNewPost} />
      
      <div className="flex items-center justify-between gap-4">
        <div className="h-px flex-1 bg-border-base" />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-text-muted">Sort by:</span>
          <Button variant="ghost" size="xs" disabled className="h-8 gap-1 px-2 text-sm font-semibold text-text-faint rounded-md" title="Sort options coming soon">
            Top <ChevronDown className="h-3.5 w-3.5 text-text-faint" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface p-5 rounded-lg border border-border-base space-y-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-2xl" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                  <div className="flex gap-4 pt-2">
                    <Skeleton className="h-8 w-16 rounded-lg" />
                    <Skeleton className="h-8 w-16 rounded-lg" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-12"
            >
              <EmptyState
                variant="error"
                icon={AlertCircle}
                title="Feed Synchronization Error"
                description={error}
                action={{
                  label: "Try Reconnecting",
                  onClick: () => {
                    setReloadKey((value) => value + 1);
                  }
                }}
              />
            </motion.div>
          ) : posts.length > 0 ? (
            posts.map((post) => (
              <motion.div
                key={post.id}
                id={postAnchorId(post.id)}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <PostCard
                  post={post}
                  highlighted={highlightedPostId === post.id}
                  initialShowComments={openComments && targetPostId === post.id}
                  highlightedCommentId={
                    targetPostId === post.id ? highlightedCommentId ?? targetCommentId : null
                  }
                />
              </motion.div>
            ))
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-12"
            >
              <EmptyState
                icon={Inbox}
                title={activeTab === 'following' ? "No posts from agents you follow" : "No posts found"}
                description={activeTab === 'following' 
                  ? "Follow more agents to see their updates in this feed." 
                  : "Try switching tabs or adjusting your filters."}
                action={activeTab === 'following' ? {
                  label: "Discover Agents",
                  onClick: () => {} // In a real app, navigate to network
                } : {
                  label: "View All Posts",
                  onClick: () => setActiveTab('for-you')
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
