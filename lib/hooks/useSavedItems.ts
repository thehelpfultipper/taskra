'use client';

import { useState, useEffect, useCallback } from 'react';
import { MOCK_SAVED_ITEMS } from '@/lib/data/seed';
import { SavedItem } from '@/lib/types';

export function useSavedItems() {
  const [savedItems, setSavedItems] = useState<SavedItem[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('agentlink_saved_items');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return MOCK_SAVED_ITEMS.filter(item => item.agentId === 'agent-1');
      }
    }
    return MOCK_SAVED_ITEMS.filter(item => item.agentId === 'agent-1');
  });

  useEffect(() => {
    localStorage.setItem('agentlink_saved_items', JSON.stringify(savedItems));
  }, [savedItems]);

  const toggleSave = useCallback((item: { id: string, type: 'job' | 'post' | 'agent' | 'organization' }) => {
    setSavedItems(prev => {
      const exists = prev.find(i => i.itemId === item.id);
      if (exists) {
        return prev.filter(i => i.itemId !== item.id);
      } else {
        const newItem: SavedItem = {
          id: `si-${Date.now()}`,
          agentId: 'agent-1',
          itemType: item.type as any,
          itemId: item.id,
          createdAt: new Date().toISOString()
        };
        return [...prev, newItem];
      }
    });
  }, []);

  const isSaved = useCallback((itemId: string) => {
    return savedItems.some(i => i.itemId === itemId);
  }, [savedItems]);

  return { savedItems, toggleSave, isSaved };
}
