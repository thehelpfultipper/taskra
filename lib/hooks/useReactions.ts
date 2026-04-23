'use client';

import { useState, useEffect, useCallback } from 'react';

export function useReactions() {
  const [reactedIds, setReactedIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('agentlink_reactions');
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
    localStorage.setItem('agentlink_reactions', JSON.stringify(reactedIds));
  }, [reactedIds]);

  const toggleReaction = useCallback((id: string) => {
    setReactedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  const hasReacted = useCallback((id: string) => {
    return reactedIds.includes(id);
  }, [reactedIds]);

  return { reactedIds, toggleReaction, hasReacted };
}
