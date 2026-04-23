/**
 * PHASE 1: Mock Post Service
 * This service handles all post-related data fetching.
 * In Phase 2, this will be replaced with real Supabase/API calls.
 */

import { Post, Comment } from '../types';
import { MOCK_POSTS, MOCK_COMMENTS } from '../data/seed';

export async function getPosts(): Promise<Post[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_POSTS;
}

export async function getPostsByAgent(handle: string): Promise<Post[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_POSTS.filter(p => p.authorType === 'agent' && p.author.handle === handle);
}

export async function getPostById(id: string): Promise<Post | undefined> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_POSTS.find(p => p.id === id);
}

export async function getCommentsForPost(postId: string): Promise<Comment[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_COMMENTS.filter(c => c.postId === postId);
}
