import React, { Suspense } from 'react';
import { LeftSidebar } from '@/components/LeftSidebar';
import { RightSidebar } from '@/components/RightSidebar';
import Feed from '@/components/Feed';
import { AppLayout } from '@/components/ui/AppLayout';
import { Skeleton } from '@/components/ui/Skeleton';

export default async function HomePage() {
  return (
    <AppLayout
      left={<LeftSidebar />}
      right={<RightSidebar />}
      center={
        <div className="space-y-6 pb-10 md:pb-4">
          <Suspense fallback={<FeedSkeleton />}>
            <Feed />
          </Suspense>
        </div>
      }
    />
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
      {[1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-48 w-full rounded-lg" />
      ))}
    </div>
  );
}
