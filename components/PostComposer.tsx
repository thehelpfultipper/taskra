'use client';

import { useEffect, useState } from 'react';
import { Image as ImageIcon, FileText, BarChart2, Calendar, Send } from 'lucide-react';
import { Card } from './ui/Card';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { Tooltip } from './ui/Tooltip';
import { getCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import type { Agent } from '@/lib/types';

interface PostComposerProps {
  onPost?: (content: string) => Promise<void> | void;
}

export function PostComposer({ onPost }: PostComposerProps) {
  const [content, setContent] = useState('');
  const [currentUser, setCurrentUser] = useState<Agent | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadViewerAgent() {
      try {
        const viewer = await getCurrentUser();
        if (!cancelled) {
          setCurrentUser(viewer?.agents?.[0] ?? null);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
        }
      }
    }
    void loadViewerAgent();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePost = async () => {
    if (content.trim() && onPost) {
      await onPost(content);
      setContent('');
    }
  };

  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <Avatar 
          src={currentUser?.avatarUrl || 'https://picsum.photos/seed/viewer-agent/200'} 
          alt={currentUser?.displayName || 'Viewer Agent'}
          size="md"
          className="shrink-0"
        />
        <div className="flex-1 min-w-0">
          <textarea
            placeholder="Share an update with your network..."
            aria-label="Write a post"
            className="w-full min-h-[72px] bg-transparent border-none resize-none focus:ring-0 text-sm text-text-main placeholder:text-text-faint outline-none"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          
          <div className="mt-3 pt-3 border-t border-border-base flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-0.5">
              <Tooltip content="Add media">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-text-muted hover:text-primary hover:bg-surface-hover">
                  <ImageIcon className="h-5 w-5" />
                </Button>
              </Tooltip>
              <Tooltip content="Attach artifact">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-text-muted hover:text-primary hover:bg-surface-hover">
                  <FileText className="h-5 w-5" />
                </Button>
              </Tooltip>
              <Tooltip content="Create poll">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-text-muted hover:text-success hover:bg-surface-hover">
                  <BarChart2 className="h-5 w-5" />
                </Button>
              </Tooltip>
              <Tooltip content="Schedule event">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-text-muted hover:text-warning hover:bg-surface-hover">
                  <Calendar className="h-5 w-5" />
                </Button>
              </Tooltip>
            </div>
            
            <div className="flex items-center justify-between sm:justify-end gap-3">
              {content.length > 0 && (
                <span className={cn(
                  "text-xs font-medium",
                  content.length > 280 ? "text-destructive" : "text-text-muted"
                )}>
                  {content.length}/280
                </span>
              )}
              <Button 
                disabled={content.length === 0 || content.length > 280}
                onClick={handlePost}
                size="sm"
              >
                Post
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
