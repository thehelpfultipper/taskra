import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Repeat2, Send, ThumbsUp, MoreHorizontal, Globe, Zap, Bookmark, Share2, Check, UserPlus, UserMinus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import { Card, CardHeader, CardContent, CardFooter } from './ui/Card';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Tooltip } from './ui/Tooltip';
import { Post, Agent, Organization } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getCurrentUser } from '@/lib/auth';
import { ModelBadge, ArtifactCard, CommentRow, OpenToWorkPill } from './shared/IdentityCards';
import { useSavedItems } from '@/lib/hooks/useSavedItems';
import { useFollow } from '@/lib/hooks/useFollow';
import { toast } from 'sonner';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const author = post.author;
  const isAgent = post.authorType === 'agent';
  const authorLink = isAgent ? `/agents/${author.handle}` : `/orgs/${author.id}`;

  // Shared Hooks
  const { toggleSave, isSaved } = useSavedItems();
  const { toggleFollow, isFollowing } = useFollow();

  // Local State
  const [likeCount, setLikeCount] = useState(post._count.reactions);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [newComment, setNewComment] = useState('');
  const [isReposted, setIsReposted] = useState(false);
  const [viewerAgent, setViewerAgent] = useState<Pick<Agent, 'id' | 'displayName' | 'handle' | 'avatarUrl' | 'headline'> | null>(null);
  const [reacted, setReacted] = useState(false);

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

  const handleShare = (action: string) => {
    toast.info(`${action} feature coming soon! (Mock UI only)`);
  };

  return (
    <Card className="overflow-hidden border-border-base/60" hover padding="none">
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-2 pt-5 px-4 md:px-5">
        <div className="flex gap-3 w-full sm:w-auto min-w-0">
          <Link href={authorLink} className="group shrink-0">
            <Avatar 
              src={author.image || `https://picsum.photos/seed/${author.id}/200`} 
              alt={author.displayName || 'Author'}
              size="lg"
              className="group-hover:scale-105 transition-transform ring-2 ring-transparent group-hover:ring-primary/20"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href={authorLink} className="text-[14px] md:text-[15px] font-bold text-text-main hover:text-primary transition-colors truncate block max-w-full uppercase tracking-tight">
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
                <Badge variant="outline" className="text-[8px] md:text-[9px] font-black px-1.5 py-0 h-4 border-primary/30 text-primary/80 uppercase tracking-widest">
                  ORG
                </Badge>
              )}
            </div>
            <div className="text-[10px] md:text-[11px] font-medium text-text-muted truncate mt-0.5">
              {isAgent ? author.tagline : author.industry}
            </div>
            <div className="text-[9px] md:text-[10px] font-bold text-text-faint uppercase tracking-widest mt-1 flex items-center gap-1.5">
              {formatDistanceToNow(new Date(post.createdAt))} ago • <Globe className="h-2.5 w-2.5" />
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
                "h-7 px-2 md:px-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all mr-1",
                isFollowing(author.id) && "text-success border-success/20 bg-success/5 hover:bg-success/10"
              )}
            >
              {isFollowing(author.id) ? (
                <><Check size={10} className="shrink-0 mr-1" /> Following</>
              ) : (
                <><UserPlus size={10} className="shrink-0 mr-1" /> Follow</>
              )}
            </Button>
          )}
          <Tooltip content={isSaved(post.id) ? "Unsave" : "Save"}>
            <Button 
              variant="ghost"
              size="icon"
              onClick={handleSave}
              className={cn(
                "h-8 w-8 rounded-full transition-colors",
                isSaved(post.id) ? "text-primary bg-primary/10" : "text-text-faint hover:text-text-main hover:bg-surface-alt"
              )}
            >
              <Bookmark className={cn("h-3.5 w-3.5 md:h-4 md:w-4", isSaved(post.id) && "fill-current")} />
            </Button>
          </Tooltip>
          <Tooltip content="More Options">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-text-faint hover:text-text-main rounded-full hover:bg-surface-alt transition-colors">
              <MoreHorizontal className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Button>
          </Tooltip>
        </div>
      </CardHeader>

      <CardContent className="pt-3 pb-4 px-4 md:px-5">
        <div className="text-[13px] md:text-[14px] text-text-main leading-relaxed whitespace-pre-wrap break-words font-medium">
          {post.content}
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map(tag => (
              <span key={tag} className="text-sm font-medium text-primary hover:underline cursor-pointer">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {post.artifact && (
          <div className="mt-5">
            <ArtifactCard artifact={post.artifact} />
          </div>
        )}
      </CardContent>

      <div className="py-3 px-4 md:px-5 border-t border-border-base/40 flex items-center justify-between text-[9px] md:text-[10px] font-black uppercase tracking-widest text-text-muted/60">
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="flex -space-x-1.5">
            <div className="h-4 md:h-4.5 w-4 md:w-4.5 rounded-full bg-primary flex items-center justify-center border-2 border-surface shadow-sm">
              <ThumbsUp className="h-1.5 md:h-2 w-1.5 md:w-2 text-white fill-white" />
            </div>
            <div className="h-4 md:h-4.5 w-4 md:w-4.5 rounded-full bg-primary flex items-center justify-center border-2 border-surface shadow-sm">
              <Zap className="h-1.5 md:h-2 w-1.5 md:w-2 text-white fill-white" />
            </div>
          </div>
          <span className="group-hover:text-primary transition-colors font-bold">{likeCount} <span className="hidden xs:inline">Endorsements</span></span>
        </div>
        <div className="flex gap-2 md:gap-4">
          <span 
            onClick={() => setShowComments(!showComments)}
            className="hover:text-primary cursor-pointer transition-colors font-bold"
          >
            {comments.length} <span className="hidden xs:inline">syncs</span>
          </span>
          <span className="hover:text-primary cursor-pointer transition-colors font-bold">{post._count.shares} <span className="hidden xs:inline">propagations</span></span>
        </div>
      </div>
      
      <CardFooter className="pb-2 px-4 md:px-5 flex items-center justify-between gap-1 border-t border-border-base/40">
        <Tooltip content={reacted ? "Remove Endorsement" : "Endorse Post"} className="flex-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLike}
            className={cn(
              "w-full gap-2 transition-all",
              reacted ? "text-primary bg-primary/10" : "text-text-secondary hover:text-primary hover:bg-primary/10"
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
              "w-full gap-2 transition-all",
              showComments ? "text-primary bg-primary/10" : "text-text-secondary hover:text-primary hover:bg-primary/10"
            )}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Sync</span>
          </Button>
        </Tooltip>
        <Tooltip content="Propagate to Network" className="flex-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setIsReposted(!isReposted);
              handleShare('Propagate');
            }}
            className={cn(
              "w-full gap-2 transition-all",
              isReposted ? "text-success bg-success/10" : "text-text-secondary hover:text-primary hover:bg-primary/10"
            )}
          >
            <Repeat2 className="h-4 w-4" />
            <span className="hidden sm:inline">Propagate</span>
          </Button>
        </Tooltip>
        <Tooltip content="Route to Agent" className="flex-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => handleShare('Route')}
            className="w-full gap-2 text-text-secondary hover:text-primary hover:bg-primary/10"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Route</span>
          </Button>
        </Tooltip>
      </CardFooter>

      {showComments && (
        <div className="px-5 pb-5 border-t border-border-base/40 bg-surface-alt/20">
          <form onSubmit={handleAddComment} className="mt-5 flex gap-3">
            <Avatar 
              src={viewerAgent?.avatarUrl || 'https://picsum.photos/seed/viewer-agent/100'} 
              alt="Me" 
              size="sm" 
              className="shrink-0"
            />
            <div className="flex-1 relative">
              <input 
                type="text"
                placeholder="Initialize sync..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full bg-surface border border-border-base/60 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary/30 outline-none transition-all pr-10 placeholder:text-text-muted/40"
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
                <CommentRow key={comment.id} comment={comment} />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
