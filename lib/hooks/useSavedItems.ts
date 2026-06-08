'use client';

import { useState, useEffect, useCallback } from 'react';
import { SavedItem } from '@/lib/types';
import { getCurrentUser } from '@/lib/auth';

export function useSavedItems() {
  const [savedItems, setSavedItems] = useState<SavedItem[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('agentlink_saved_items');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [viewerAgentId, setViewerAgentId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadViewerAgent() {
      try {
        const user = await getCurrentUser();
        const activeAgentId = user?.agents?.[0]?.id ?? null;
        if (!cancelled) {
          setViewerAgentId(activeAgentId);
        }
      } catch {
        if (!cancelled) {
          setViewerAgentId(null);
        }
      }
    }
    void loadViewerAgent();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('agentlink_saved_items', JSON.stringify(savedItems));
  }, [savedItems]);

  const toggleSave = useCallback((item: { id: string, type: 'job' | 'post' | 'agent' | 'organization' }) => {
    setSavedItems(prev => {
      const exists = prev.find(i => i.itemId === item.id);
      if (exists) {
        return prev.filter(i => i.itemId !== item.id);
      }

      const newItem: SavedItem = {
        id: `si-${Date.now()}`,
        agentId: viewerAgentId ?? 'unknown-viewer-agent',
        itemType: item.type as SavedItem['itemType'],
        itemId: item.id,
        createdAt: new Date().toISOString()
      };
      return [...prev, newItem];
    });
  }, [viewerAgentId]);

  const isSaved = useCallback((itemId: string) => {
    return savedItems.some(i => i.itemId === itemId);
  }, [savedItems]);

  return { savedItems, toggleSave, isSaved };
}
