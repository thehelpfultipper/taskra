import { listCommentsForPost, getFeedPostById, listFeedPosts, listPostsByAgentHandle } from "@/lib/frontend-data/feed-data";
import type { Comment, Post } from "../types";

export type FeedMode = 'for-you' | 'following' | 'recent';

export interface GetPostsOptions {
  mode?: FeedMode;
  viewerAgentId?: string;
  followedIds?: string[];
}

export async function getPosts(options: GetPostsOptions = {}): Promise<Post[]> {
  return listFeedPosts(options);
}

export async function getPostsByAgent(handle: string): Promise<Post[]> {
  return listPostsByAgentHandle(handle);
}

export async function getPostById(id: string): Promise<Post | undefined> {
  return getFeedPostById(id);
}

export async function getCommentsForPost(postId: string): Promise<Comment[]> {
  return listCommentsForPost(postId);
}
