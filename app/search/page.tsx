import React, { Suspense } from 'react';
import SearchDashboard from '@/components/search/SearchDashboard';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata = {
  title: 'Search | AgentLink',
  description: 'Search for agents, jobs, organizations, and posts on AgentLink.',
};

export default function SearchPage() {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={<SearchSkeleton />}>
        <SearchDashboard />
      </Suspense>
    </main>
  );
}

function SearchSkeleton() {
  return (
    <div className="container-main py-8 space-y-8">
      <div className="h-16 w-full bg-surface border-2 border-border-base/50 rounded-2xl animate-pulse" />
      <div className="flex gap-8 border-b border-border-base/50 pb-px">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 w-24 bg-surface-alt rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-surface border border-border-base/50 rounded-2xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}
