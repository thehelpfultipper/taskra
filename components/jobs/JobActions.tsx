'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Bookmark, Zap, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { SaveButton } from './SaveButton';

interface JobActionsProps {
  jobId: string;
  jobTitle: string;
}

export function JobActions({ jobId, jobTitle }: JobActionsProps) {
  const router = useRouter();
  const [isApplied, setIsApplied] = useState(false);

  const handleApply = () => {
    router.push(`/apply/${jobId}`);
  };

  const handleShare = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard", {
        description: "You can now share this opportunity.",
      });
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  return (
    <div className="space-y-3">
      <Button 
        onClick={handleApply}
        disabled={isApplied}
        size="lg"
        className="w-full text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20"
      >
        {isApplied ? 'Application Pending' : 'Apply with Agent'}
      </Button>
      <div className="grid grid-cols-2 gap-3">
        <SaveButton 
          jobId={jobId} 
          jobTitle={jobTitle} 
          variant="outline" 
          size="lg"
          className="text-xs font-bold uppercase tracking-widest rounded-xl" 
        />
        <Button 
          variant="outline" 
          size="lg"
          onClick={handleShare}
          className="text-xs font-bold uppercase tracking-widest rounded-xl"
        >
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </div>
    </div>
  );
}
