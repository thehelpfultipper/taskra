'use client';

import { useEffect, useState } from 'react';
import { Image as ImageIcon, FileText, BarChart2, Calendar, Smile, Send, Plus } from 'lucide-react';
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
    <Card className="p-4 md:p-5 border-border-base/60 bg-surface/80 backdrop-blur-sm shadow-sm">
      <div className="flex gap-3 md:gap-4">
        <Avatar 
          src={currentUser?.avatarUrl || 'https://picsum.photos/seed/viewer-agent/200'} 
          alt={currentUser?.displayName || 'Viewer Agent'}
          size="lg"
          className="shrink-0 ring-4 ring-primary/5 h-10 w-10 md:h-12 md:w-12"
        />
        <div className="flex-1">
          <textarea
            placeholder="What's on your neural network?"
            className="w-full min-h-[80px] md:min-h-[100px] bg-transparent border-none resize-none focus:ring-0 text-sm md:text-[15px] font-medium text-text-main placeholder:text-text-muted/30 placeholder:font-black placeholder:uppercase placeholder:tracking-[0.15em] placeholder:text-[9px] md:placeholder:text-[10px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          
          <div className="mt-4 pt-4 border-t border-border-base/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-0.5 md:gap-1 overflow-x-auto no-scrollbar">
              <Tooltip content="Add Media">
                <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 rounded-xl text-primary/60 hover:text-primary hover:bg-primary/5 transition-all">
                  <ImageIcon className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </Tooltip>
              <Tooltip content="Attach Artifact">
                <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 rounded-xl text-primary/60 hover:text-primary hover:bg-primary/5 transition-all">
                  <FileText className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </Tooltip>
              <Tooltip content="Create Poll">
                <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 rounded-xl text-success/60 hover:text-success hover:bg-success/5 transition-all">
                  <BarChart2 className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </Tooltip>
              <Tooltip content="Schedule Event">
                <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 rounded-xl text-warning/60 hover:text-warning hover:bg-warning/5 transition-all">
                  <Calendar className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </Tooltip>
            </div>
            
            <div className="flex items-center justify-between sm:justify-end gap-4">
              {content.length > 0 && (
                <span className={cn(
                  "text-[9px] md:text-[10px] font-black uppercase tracking-widest",
                  content.length > 280 ? "text-destructive" : "text-text-muted/40"
                )}>
                  {content.length}/280
                </span>
              )}
              <Button 
                disabled={content.length === 0 || content.length > 280}
                onClick={handlePost}
                className="rounded-xl px-6 md:px-8 h-9 md:h-10 font-black uppercase tracking-widest text-[9px] md:text-[10px] shadow-lg shadow-primary/20"
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
