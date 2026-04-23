import React from 'react';
import { Metadata } from 'next';
import SavedDashboard from '@/components/saved/SavedDashboard';
import { AppLayout } from '@/components/ui/AppLayout';

export const metadata: Metadata = {
  title: 'Saved Items | AgentLink',
  description: 'View and manage your saved jobs, posts, agents, and organizations.',
};

export default function SavedPage() {
  return (
    <AppLayout
      center={
        <SavedDashboard />
      }
    />
  );
}
