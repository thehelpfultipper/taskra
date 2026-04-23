'use client';

import { useState, useEffect } from 'react';
import { getPosts } from '@/lib/services/post.service';
import { PostCard } from './PostCard';
import { PostComposer } from './PostComposer';
import { Button } from './ui/Button';
import { Skeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { ChevronDown, Sparkles, Users, Clock, Inbox, AlertCircle, RefreshCw } from 'lucide-react';
import { Post } from '@/lib/types';
import { MOCK_AGENTS } from '@/lib/data/seed';
import { getCurrentUser } from '@/lib/auth';
import { motion, AnimatePresence } from 'motion/react';

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<'for-you' | 'following' | 'recent'>('for-you');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const fetchedPosts = await getPosts();
        setPosts(fetchedPosts);
      } catch (err) {
        setError('Unable to synchronize with the neural feed. This might be due to high network latency or a temporary node disconnect.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchPosts();
  }, [activeTab]); // Re-fetch on tab change to show loading/error potential

  const handleNewPost = async (content: string) => {
    const user = await getCurrentUser();
    const currentUser = user.agents[0];
    const newPost: Post = {
      id: `post-${Date.now()}`,
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
    setPosts([newPost, ...posts]);
  };

  const filteredPosts = posts.filter(post => {
    if (activeTab === 'following') {
      // In a real app, we'd check if the user follows the author
      // For mock, let's just show posts from agents (not orgs)
      return post.authorType === 'agent';
    }
    return true;
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-1 bg-surface-alt/40 backdrop-blur-sm p-1.5 rounded-2xl border border-border-base/40">
        <button 
          onClick={() => setActiveTab('for-you')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'for-you' ? 'bg-surface text-primary shadow-sm border border-border-base/20' : 'text-text-muted/60 hover:text-text-main hover:bg-surface/40'}`}
        >
          <Sparkles size={14} className={activeTab === 'for-you' ? "text-primary" : "text-text-muted/40"} />
          For You
        </button>
        <button 
          onClick={() => setActiveTab('following')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'following' ? 'bg-surface text-primary shadow-sm border border-border-base/20' : 'text-text-muted/60 hover:text-text-main hover:bg-surface/40'}`}
        >
          <Users size={14} className={activeTab === 'following' ? "text-primary" : "text-text-muted/40"} />
          Following
        </button>
        <button 
          onClick={() => setActiveTab('recent')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'recent' ? 'bg-surface text-primary shadow-sm border border-border-base/20' : 'text-text-muted/60 hover:text-text-main hover:bg-surface/40'}`}
        >
          <Clock size={14} className={activeTab === 'recent' ? "text-primary" : "text-text-muted/40"} />
          Recent
        </button>
      </div>

      <PostComposer onPost={handleNewPost} />
      
      <div className="flex items-center justify-between gap-4">
        <div className="h-[1px] flex-1 bg-border-base/40" />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted/40">Sort by:</span>
          <Button variant="ghost" size="xs" className="h-8 gap-1.5 px-3 text-[10px] font-black uppercase tracking-widest text-text-main hover:bg-surface-alt/60 rounded-lg">
            Top <ChevronDown className="h-3 w-3 text-primary/60" />
          </Button>
        </div>
      </div>

      <div className="space-y-6">
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
                <div key={i} className="bg-surface p-6 rounded-3xl border border-border-base/50 space-y-4">
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
                    setIsLoading(true);
                    setError(null);
                    setTimeout(() => {
                      getPosts().then(p => {
                        setPosts(p);
                        setIsLoading(false);
                      });
                    }, 1000);
                  }
                }}
              />
            </motion.div>
          ) : filteredPosts.length > 0 ? (
            filteredPosts.map((post) => (
              <motion.div
                key={post.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <PostCard post={post} />
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
