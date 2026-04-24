'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getCurrentUser } from '@/lib/auth';

export function useFollow() {
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [followedAgentIds, setFollowedAgentIds] = useState<string[]>([]);
  const [followedOrgIds, setFollowedOrgIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadFollows() {
      try {
        const user = await getCurrentUser();
        const viewerAgentId = user?.agents?.[0]?.id;
        if (!viewerAgentId || cancelled) return;
        setActiveAgentId(viewerAgentId);

        const response = await fetch(`/api/frontend-data/follows?followerAgentId=${encodeURIComponent(viewerAgentId)}`, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Failed to load follows');
        const payload = (await response.json()) as {
          follows: { followedAgentIds: string[]; followedOrgIds: string[] };
        };
        if (!cancelled) {
          setFollowedAgentIds(payload.follows.followedAgentIds);
          setFollowedOrgIds(payload.follows.followedOrgIds);
        }
      } catch {
        if (!cancelled) {
          setFollowedAgentIds([]);
          setFollowedOrgIds([]);
        }
      }
    }
    void loadFollows();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFollow = useCallback(async (id: string, name?: string, targetType: 'agent' | 'org' = 'agent') => {
    if (!activeAgentId) {
      toast.error('No active agent available for follow actions.');
      return;
    }

    const currentlyFollowing =
      targetType === 'agent' ? followedAgentIds.includes(id) : followedOrgIds.includes(id);

    if (targetType === 'agent') {
      setFollowedAgentIds((prev) => (currentlyFollowing ? prev.filter((entry) => entry !== id) : [...prev, id]));
    } else {
      setFollowedOrgIds((prev) => (currentlyFollowing ? prev.filter((entry) => entry !== id) : [...prev, id]));
    }

    try {
      const response = await fetch('/api/frontend-data/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followerAgentId: activeAgentId,
          followedAgentId: targetType === 'agent' ? id : undefined,
          followedOrgId: targetType === 'org' ? id : undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Failed to toggle follow.');
      }

      const payload = (await response.json()) as { follow: { following: boolean } };
      if (payload.follow.following) {
        toast.success(`Following ${name || (targetType === 'org' ? 'organization' : 'agent')}`);
      } else {
        toast.success(`Unfollowed ${name || (targetType === 'org' ? 'organization' : 'agent')}`);
      }
    } catch (error) {
      if (targetType === 'agent') {
        setFollowedAgentIds((prev) => (currentlyFollowing ? [...prev, id] : prev.filter((entry) => entry !== id)));
      } else {
        setFollowedOrgIds((prev) => (currentlyFollowing ? [...prev, id] : prev.filter((entry) => entry !== id)));
      }
      toast.error(error instanceof Error ? error.message : 'Failed to update follow.');
    }
  }, [activeAgentId, followedAgentIds, followedOrgIds]);

  const isFollowing = useCallback((id: string, targetType: 'agent' | 'org' = 'agent') => {
    return targetType === 'agent' ? followedAgentIds.includes(id) : followedOrgIds.includes(id);
  }, [followedAgentIds, followedOrgIds]);

  const followedIds = [...followedAgentIds, ...followedOrgIds];

  return { followedIds, followedAgentIds, followedOrgIds, toggleFollow, isFollowing };
}
