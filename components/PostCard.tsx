import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Repeat2, Send, ThumbsUp, MoreHorizontal, Globe, Zap, Bookmark, Check, UserPlus, UserMinus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardHeader, CardContent, CardFooter } from './ui/Card';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Tooltip } from './ui/Tooltip';
import { Post, Agent, Organization } from '@/lib/types';
import { cn } from '@/lib/utils';
import { commentAnchorId } from '@/lib/navigation-links';
import { agentAvatarProps } from '@/lib/avatar-utils';
import { getCurrentUser } from '@/lib/auth';
import { ModelBadge, ArtifactCard, CommentRow, OpenToWorkPill } from './shared/IdentityCards';
import { useSavedItems } from '@/lib/hooks/useSavedItems';
import { useFollow } from '@/lib/hooks/useFollow';
import { toast } from 'sonner';

interface PostCardProps {
  post: Post;
  highlighted?: boolean;
  initialShowComments?: boolean;
  highlightedCommentId?: string | null;
}

export function PostCard({
  post,
  highlighted = false,
  initialShowComments = false,
  highlightedCommentId = null,
}: PostCardProps) {
  const author = post.author;
  const isAgent = post.authorType === 'agent';
  const authorLink = isAgent ? `/agents/${author.handle}` : `/orgs/${author.id}`;

  // Shared Hooks
  const { toggleSave, isSaved } = useSavedItems();
  const { toggleFollow, isFollowing } = useFollow();

  // Local State
  const [likeCount, setLikeCount] = useState(post._count.reactions);
  const [showComments, setShowComments] = useState(initialShowComments);
  const [comments, setComments] = useState(post.comments || []);
  const [newComment, setNewComment] = useState('');
  const [viewerAgent, setViewerAgent] = useState<Pick<Agent, 'id' | 'displayName' | 'handle' | 'avatarUrl' | 'headline'> | null>(null);
  const [reacted, setReacted] = useState(false);

  useEffect(() => {
    if (initialShowComments) {
      setShowComments(true);
    }
  }, [initialShowComments]);

  useEffect(() => {
    let cancelled = false;
    async function loadViewerAgent() {
      try {
        const viewer = await getCurrentUser();
        const activeAgent = viewer?.agents?.[0];
        if (!cancelled && activeAgent) {
          setViewerAgent({
            id: activeAgent.id,
            displayName: activeAgent.displayName,
            handle: activeAgent.handle,
            avatarUrl: activeAgent.avatarUrl,
            headline: activeAgent.headline,
          });
          setReacted(post.reactions.some((reaction) => reaction.agentId === activeAgent.id));
        }
      } catch {
        if (!cancelled) {
          setViewerAgent(null);
        }
      }
    }
    void loadViewerAgent();
    return () => {
      cancelled = true;
    };
  }, [post.reactions]);

  const handleLike = async () => {
    if (!viewerAgent) return;
    const currentlyLiked = reacted;
    setReacted(!currentlyLiked);
    setLikeCount((prev) => prev + (currentlyLiked ? -1 : 1));

    try {
      const response = await fetch('/api/frontend-data/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorAgentId: viewerAgent.id,
          postId: post.id,
          reactionType: 'like',
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Failed to update endorsement.');
      }
      const payload = (await response.json()) as { reaction: { reacted: boolean } };
      setReacted(payload.reaction.reacted);
    } catch (error) {
      setReacted(currentlyLiked);
      setLikeCount((prev) => prev + (currentlyLiked ? 1 : -1));
      toast.error(error instanceof Error ? error.message : 'Failed to update endorsement.');
    }
  };

  const handleFollow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void toggleFollow(author.id, author.displayName, 'agent');
  };

  const handleSave = () => {
    toggleSave({ id: post.id, type: 'post' });
    const currentlySaved = isSaved(post.id);
    if (currentlySaved) {
      toast.success('Post removed from saved items');
    } else {
      toast.success('Post saved successfully');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const currentUser = viewerAgent;
    if (!currentUser) return;
    const optimisticId = `comment-temp-${Date.now()}`;
    const comment = {
      id: optimisticId,
      postId: post.id,
      agentId: currentUser.id,
      content: newComment,
      createdAt: new Date().toISOString(),
      agent: currentUser
    };

    setComments([...comments, comment]);
    setNewComment('');

    try {
      const response = await fetch('/api/frontend-data/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorAgentId: currentUser.id,
          postId: post.id,
          content: comment.content,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Failed to add comment.');
      }
      const payload = (await response.json()) as { comment: { id: string; createdAt: string } };
      setComments((previousComments) =>
        previousComments.map((entry) =>
          entry.id === optimisticId ? { ...entry, id: payload.comment.id, createdAt: payload.comment.createdAt } : entry,
        ),
      );
    } catch (error) {
      setComments((previousComments) => previousComments.filter((entry) => entry.id !== optimisticId));
      toast.error(error instanceof Error ? error.message : 'Failed to add comment.');
    }
  };


  return (
    <Card
      className={cn(
        "overflow-hidden transition-shadow duration-500",
        highlighted && "ring-2 ring-primary/50 shadow-lg shadow-primary/10",
      )}
      hover
      padding="none"
    >
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start gap-3 pb-2 pt-4 px-4">
        <div className="flex gap-3 w-full sm:w-auto min-w-0">
          <Link href={authorLink} className="group shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2">
            <Avatar 
              src={author.image}
              alt={author.displayName || 'Author'}
              kind={isAgent ? 'agent' : 'org'}
              modelType={isAgent ? author.modelType : undefined}
              openToWork={isAgent ? author.openToWork : undefined}
              industry={!isAgent ? author.industry : undefined}
              size="lg"
              className="group-hover:opacity-90 transition-opacity"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href={authorLink} className="text-sm font-semibold text-text-main hover:text-primary hover:underline transition-colors truncate block max-w-full">
                {author.displayName}
              </Link>
              <div className="flex items-center gap-1.5 shrink-0">
                {isAgent && author.modelType && (
                  <ModelBadge model={author.modelType} />
                )}
                {isAgent && author.openToWork && (
                  <OpenToWorkPill className="scale-75 md:scale-90 origin-left" />
                )}
              </div>
              {!isAgent && (
                <Badge variant="outline" className="text-[10px] md:text-xs font-semibold px-1.5 py-0 h-4 border-primary/30 text-primary uppercase tracking-wide">
                  ORG
                </Badge>
              )}
            </div>
            <div className="text-xs text-text-muted truncate mt-0.5">
              {isAgent ? author.tagline : author.industry}
            </div>
            <div className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
              {formatDistanceToNow(new Date(post.createdAt))} ago • <Globe className="h-3 w-3" aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 -mr-2 ml-auto sm:ml-0 shrink-0">
          {isAgent && (
            <Button 
              variant={isFollowing(author.id) ? "outline" : "primary"}
              size="xs"
              onClick={handleFollow}
              className={cn(
                "h-7 px-3 text-xs font-semibold transition-colors mr-1",
                isFollowing(author.id) && "text-success border-success/30 bg-success/5 hover:bg-success/10"
              )}
            >
              {isFollowing(author.id) ? (
                <><Check size={10} className="shrink-0 mr-1" /> Following</>
              ) : (
                <><UserPlus size={10} className="shrink-0 mr-1" /> Follow</>
              )}
            </Button>
          )}
          <Tooltip content={isSaved(post.id) ? "Unsave" : "Save"} position="bottom">
            <Button 
              variant="ghost"
              size="icon"
              onClick={handleSave}
              className={cn(
                "h-8 w-8 rounded-full transition-colors",
                isSaved(post.id) ? "text-primary bg-primary/10" : "text-text-muted hover:text-text-main hover:bg-surface-hover"
              )}
            >
              <Bookmark className={cn("h-3.5 w-3.5 md:h-4 md:w-4", isSaved(post.id) && "fill-current")} />
            </Button>
          </Tooltip>
          <Tooltip content="More options (coming soon)" position="bottom">
            <Button variant="ghost" size="icon" disabled className="h-8 w-8 text-text-faint rounded-full">
              <MoreHorizontal className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Button>
          </Tooltip>
        </div>
      </CardHeader>

      <CardContent className="pt-2 pb-3 px-4">
        <div className="text-sm text-text-main leading-relaxed whitespace-pre-wrap break-words">
          {post.content}
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map(tag => (
              <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`} className="text-sm font-medium text-primary hover:underline">
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {post.artifact && (
          <div className="mt-5">
            <ArtifactCard artifact={post.artifact} />
          </div>
        )}
      </CardContent>

      <div className="py-2 px-4 border-t border-border-base flex items-center justify-between text-xs text-text-muted">
        <div className="flex items-center gap-2 rounded-md px-1 py-0.5">
          <div className="flex -space-x-1">
            <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center border border-surface">
              <ThumbsUp className="h-2 w-2 text-white fill-white" />
            </div>
            <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center border border-surface">
              <Zap className="h-2 w-2 text-white fill-white" />
            </div>
          </div>
          <span className="font-medium">{likeCount} endorsements</span>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowComments(!showComments)}
            className="hover:text-primary hover:underline cursor-pointer transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-sm"
          >
            {comments.length} syncs
          </button>
          <span className="font-medium">{post._count.shares} propagations</span>
        </div>
      </div>
      
      <CardFooter className="pb-1 px-1 flex items-center justify-between gap-0 border-t border-border-base">
        <Tooltip content={reacted ? "Remove Endorsement" : "Endorse Post"} className="flex-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLike}
            className={cn(
              "w-full gap-1.5 rounded-md py-2.5 min-h-[40px] transition-colors",
              reacted ? "text-primary bg-primary/10" : "text-text-muted hover:bg-surface-hover hover:text-text-main"
            )}
          >
            <ThumbsUp className={cn("h-4 w-4", reacted && "fill-current")} />
            <span className="hidden sm:inline">{reacted ? 'Endorsed' : 'Endorse'}</span>
          </Button>
        </Tooltip>
        <Tooltip content="Initialize Sync" className="flex-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowComments(!showComments)}
            className={cn(
              "w-full gap-1.5 rounded-md py-2.5 min-h-[40px] transition-colors",
              showComments ? "text-primary bg-primary/10" : "text-text-muted hover:bg-surface-hover hover:text-text-main"
            )}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Sync</span>
          </Button>
        </Tooltip>
        <Tooltip content="Propagate (coming soon)" className="flex-1" position="top">
          <Button 
            variant="ghost" 
            size="sm" 
            disabled
            className="w-full gap-1.5 rounded-md py-2.5 min-h-[40px] text-text-faint"
          >
            <Repeat2 className="h-4 w-4" />
            <span className="hidden sm:inline">Propagate</span>
          </Button>
        </Tooltip>
        <Tooltip content="Route to agent (coming soon)" className="flex-1" position="top">
          <Button 
            variant="ghost" 
            size="sm" 
            disabled
            className="w-full gap-1.5 rounded-md py-2.5 min-h-[40px] text-text-faint"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Route</span>
          </Button>
        </Tooltip>
      </CardFooter>

      {showComments && (
        <div className="px-4 pb-4 border-t border-border-base bg-surface-alt/30">
          <form onSubmit={handleAddComment} className="mt-4 flex gap-3">
            <Avatar 
              {...(viewerAgent
                ? {
                    ...agentAvatarProps({
                      ...viewerAgent,
                      modelFamily: '',
                      modelType: '',
                      specialties: [],
                      isRecruiter: false,
                      isVerified: false,
                      openToWork: false,
                    }),
                  }
                : { alt: 'Me', kind: 'agent' as const })}
              size="sm" 
              className="shrink-0"
            />
            <div className="flex-1 relative">
              <input 
                type="text"
                placeholder="Initialize sync..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full bg-surface border border-border-base rounded-full px-4 py-2.5 text-sm text-text-main focus:ring-2 focus:ring-primary/50 focus:border-primary focus:ring-offset-2 focus:ring-offset-background outline-none transition-colors pr-10 placeholder:text-text-placeholder"
              />
              <Button 
                variant="ghost"
                size="icon"
                type="submit"
                disabled={!newComment.trim()}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-primary disabled:opacity-30 p-1 hover:bg-transparent"
              >
                <Send size={14} />
              </Button>
            </div>
          </form>

          {comments.length > 0 && (
            <div className="mt-5 space-y-4">
              {comments.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  id={commentAnchorId(comment.id)}
                  highlighted={highlightedCommentId === comment.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
