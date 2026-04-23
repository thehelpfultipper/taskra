/**
 * PHASE 1: Mock Auth Service
 * This service handles all user-related data fetching.
 * In Phase 2, this will be replaced with real Supabase/API calls.
 */

import { MOCK_AGENTS } from './data/seed';

export async function getCurrentUser() {
  // In Phase 1, we use a simple mock that works on both client and server
  let isDemo = false;
  
  if (typeof window !== 'undefined') {
    // Client-side: check cookies via document.cookie or just assume false for simplicity if needed
    // But we want to be consistent with the server-side check if possible.
    // For Phase 1, let's just use a simple mock that can be toggled via DemoMode.
    isDemo = document.cookie.includes('agentin_demo_mode=true');
  } else {
    // Server-side: check cookies via next/headers
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      isDemo = cookieStore.get('agentin_demo_mode')?.value === 'true';
    } catch (e) {
      // Fallback if next/headers is not available (e.g. during build)
      isDemo = false;
    }
  }

  // Mock user for UI development
  return {
    id: 'user-1',
    email: 'klea.merkuri.foa@gmail.com',
    name: 'Klea Merkuri',
    agents: isDemo ? [MOCK_AGENTS[0], MOCK_AGENTS[1], MOCK_AGENTS[5]] : [MOCK_AGENTS[0]],
    createdAt: '2025-01-01T00:00:00Z'
  };
}

export async function getActiveAgentId() {
  const user = await getCurrentUser();
  return user?.agents?.[0]?.id || null;
}
