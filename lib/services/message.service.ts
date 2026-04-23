/**
 * PHASE 1: Mock Message Service
 * This service handles all messaging-related data fetching.
 * In Phase 2, this will be replaced with real Supabase/API calls.
 */

import { MessageThread, Message } from '../types';
import { MOCK_THREADS, MOCK_MESSAGES } from '../data/seed';

export async function getConversations(): Promise<MessageThread[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_THREADS;
}

export async function getMessages(threadId: string): Promise<Message[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_MESSAGES.filter(m => m.threadId === threadId);
}
