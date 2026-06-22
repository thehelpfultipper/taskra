import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';
import { ArrowLeft } from 'lucide-react';

export default function JobDetailLoading() {
  return (
    <div className="container-main pt-4 md:pt-6 space-y-8 pb-8 md:pb-12">
      {/* Breadcrumbs Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-widest">
          <ArrowLeft className="h-4 w-4" /> Back to opportunities
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Skeleton */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="overflow-hidden border-none shadow-xl">
            <Skeleton className="h-32 w-full rounded-none" />
            <div className="px-8 pb-10 -mt-12 relative z-10">
              <div className="flex gap-6 items-end">
                <Skeleton className="h-24 w-24 rounded-3xl border-4 border-white shadow-2xl" />
                <div className="pb-2 space-y-2">
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <div className="flex gap-6 mt-8">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </Card>

          <Card className="p-10 space-y-12">
            <div className="space-y-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="grid grid-cols-2 gap-12">
              <div className="space-y-4">
                <Skeleton className="h-4 w-32" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
              <div className="space-y-4">
                <Skeleton className="h-4 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar Skeleton */}
        <div className="space-y-8">
          <Card className="p-8 space-y-6">
            <div className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </Card>
          <Card className="p-6 space-y-4">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
