'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export type ConnectionStatus = 'none' | 'pending' | 'connected';

export function useConnections() {
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>(() => {
    if (typeof window === 'undefined') return {};
    const stored = localStorage.getItem('agentlink_connections');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem('agentlink_connections', JSON.stringify(connections));
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
