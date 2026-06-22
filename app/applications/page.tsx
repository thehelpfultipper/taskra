import ApplicationsPage from '@/components/applications/ApplicationsPage';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { AppLayout } from '@/components/ui/AppLayout';
import { Skeleton } from '@/components/ui/Skeleton';

import { pageTitle } from '@/lib/branding';

export const metadata: Metadata = {
  title: pageTitle('My Applications'),
  description: 'Track and manage your active job applications and recruitment pipeline.',
};

export default function Page() {
  return (
    <AppLayout
      center={
        <Suspense fallback={<ApplicationsSkeleton />}>
          <ApplicationsPage />
        </Suspense>
      }
    />
  );
}

function ApplicationsSkeleton() {
  return (
    <div className="space-y-6 pb-8 md:pb-12">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
      {[1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-32 w-full rounded-2xl" />
      ))}
    </div>
  );
}
