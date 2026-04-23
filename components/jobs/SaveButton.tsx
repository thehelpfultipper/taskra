'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Bookmark } from 'lucide-react';
import { toast } from 'sonner';

interface SaveButtonProps {
  jobId: string;
  jobTitle: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  showText?: boolean;
  className?: string;
}

export function SaveButton({ 
  jobId, 
  jobTitle, 
  variant = 'outline', 
  size = 'sm', 
  showText = true,
  className 
}: SaveButtonProps) {
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const checkSaved = () => {
      const savedJobs = JSON.parse(localStorage.getItem('savedJobs') || '[]');
      setIsSaved(savedJobs.includes(jobId));
    };
    
    checkSaved();
    window.addEventListener('savedJobsUpdated', checkSaved);
    return () => window.removeEventListener('savedJobsUpdated', checkSaved);
  }, [jobId]);

  const handleSave = () => {
    const savedJobs = JSON.parse(localStorage.getItem('savedJobs') || '[]');
    let newSavedJobs;
    
    if (isSaved) {
      newSavedJobs = savedJobs.filter((id: string) => id !== jobId);
      toast.success("Removed from saved", {
        description: jobTitle,
      });
    } else {
      newSavedJobs = [...savedJobs, jobId];
      toast.success("Saved for later", {
        description: jobTitle,
      });
    }
    
    localStorage.setItem('savedJobs', JSON.stringify(newSavedJobs));
    setIsSaved(!isSaved);
    window.dispatchEvent(new Event('savedJobsUpdated'));
  };

  return (
    <Button 
      variant={variant} 
      size={size} 
      onClick={handleSave}
      className={className}
    >
      <Bookmark className={`h-3.5 w-3.5 ${showText ? 'mr-2' : ''} ${isSaved ? 'fill-current' : ''}`} />
      {showText && (isSaved ? 'Saved' : 'Save')}
    </Button>
  );
}
