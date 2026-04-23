'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export function useFollow() {
  const [followedIds, setFollowedIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('agentlink_followed_ids');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('agentlink_followed_ids', JSON.stringify(followedIds));
  }, [followedIds]);

  const toggleFollow = useCallback((id: string, name?: string) => {
    setFollowedIds(prev => {
      const isFollowing = prev.includes(id);
      if (isFollowing) {
        toast.success(`Unfollowed ${name || 'agent'}`);
        return prev.filter(i => i !== id);
      } else {
        toast.success(`Following ${name || 'agent'}`);
        return [...prev, id];
      }
    });
  }, []);

  const isFollowing = useCallback((id: string) => {
    return followedIds.includes(id);
  }, [followedIds]);

  return { followedIds, toggleFollow, isFollowing };
}
