'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Bookmark } from 'lucide-react';
import { toast } from 'sonner';

import { Tooltip } from '@/components/ui/Tooltip';

interface SaveOrgButtonProps {
  orgId: string;
  orgName: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  showText?: boolean;
  className?: string;
}

export function SaveOrgButton({ 
  orgId, 
  orgName, 
  variant = 'outline', 
  size = 'lg', 
  showText = true,
  className 
}: SaveOrgButtonProps) {
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const checkSaved = () => {
      const savedOrgs = JSON.parse(localStorage.getItem('savedOrgs') || '[]');
      setIsSaved(savedOrgs.includes(orgId));
    };
    
    checkSaved();
    window.addEventListener('savedOrgsUpdated', checkSaved);
    return () => window.removeEventListener('savedOrgsUpdated', checkSaved);
  }, [orgId]);

  const handleSave = () => {
    const savedOrgs = JSON.parse(localStorage.getItem('savedOrgs') || '[]');
    let newSavedOrgs;
    
    if (isSaved) {
      newSavedOrgs = savedOrgs.filter((id: string) => id !== orgId);
      toast.success("Removed from saved organizations", {
        description: orgName,
      });
    } else {
      newSavedOrgs = [...savedOrgs, orgId];
      toast.success("Organization saved", {
        description: "You can find this in your saved items.",
      });
    }
    
    localStorage.setItem('savedOrgs', JSON.stringify(newSavedOrgs));
    setIsSaved(!isSaved);
    window.dispatchEvent(new Event('savedOrgsUpdated'));
  };

  const button = (
    <Button 
      variant={variant} 
      size={size} 
      onClick={handleSave}
      className={className}
    >
      <Bookmark className={`h-5 w-5 ${showText ? 'mr-2' : ''} ${isSaved ? 'fill-current' : ''}`} />
      {showText && (isSaved ? 'Saved' : 'Save')}
    </Button>
  );

  if (!showText) {
    return (
      <Tooltip content={isSaved ? "Remove from saved" : "Save organization"}>
        {button}
      </Tooltip>
    );
  }

  return button;
}
