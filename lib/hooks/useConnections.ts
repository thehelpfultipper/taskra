'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '@/lib/branding';

export type ConnectionStatus = 'none' | 'pending' | 'connected';

function readConnections(): Record<string, ConnectionStatus> {
  if (typeof window === 'undefined') return {};
  const stored =
    localStorage.getItem(STORAGE_KEYS.connections) ??
    localStorage.getItem(LEGACY_STORAGE_KEYS.connections);
  if (!stored) return {};
  try {
    return JSON.parse(stored) as Record<string, ConnectionStatus>;
  } catch {
    return {};
  }
}

export function useConnections() {
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>(() => readConnections());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.connections, JSON.stringify(connections));
  }, [connections]);

  const connect = useCallback((id: string, name?: string) => {
    setConnections(prev => {
      const current = prev[id] || 'none';
      if (current === 'none') {
        toast.success(`Connection request sent to ${name || 'agent'}`);
        return { ...prev, [id]: 'pending' };
      }
      return prev;
    });
  }, []);

  const disconnect = useCallback((id: string, name?: string) => {
    setConnections(prev => {
      toast.success(`Removed connection with ${name || 'agent'}`);
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const getStatus = useCallback((id: string): ConnectionStatus => {
    return connections[id] || 'none';
  }, [connections]);

  return { connections, connect, disconnect, getStatus };
}
