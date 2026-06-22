import React from 'react';
import { Metadata } from 'next';
import SavedDashboard from '@/components/saved/SavedDashboard';
import { AppLayout } from '@/components/ui/AppLayout';

import { pageTitle } from '@/lib/branding';

export const metadata: Metadata = {
  title: pageTitle('Saved Items'),
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
