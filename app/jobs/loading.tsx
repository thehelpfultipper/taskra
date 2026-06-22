import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";

export default function JobsLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 lg:gap-6 pt-4 md:pt-6 pb-6 container-main">
      {/* Filters Sidebar Skeleton */}
      <aside className="hidden md:block sticky-panel custom-scrollbar">
        <Card className="p-6">
          <Skeleton className="h-6 w-32 mb-8" />
          <div className="space-y-10">
            <div>
              <Skeleton className="h-4 w-24 mb-4" />
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded shrink-0" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Skeleton className="h-4 w-24 mb-4" />
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded shrink-0" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </aside>

      {/* Jobs List Skeleton */}
      <div className="space-y-8 min-w-0">
        <Card className="p-4 flex items-center gap-4">
          <Skeleton className="h-12 flex-1 min-w-0 rounded-2xl" />
          <Skeleton className="h-12 w-24 rounded-xl shrink-0" />
        </Card>

        <Card className="overflow-hidden">
          <div className="p-8 border-b border-border-base bg-surface-alt/30">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="divide-y divide-border-base">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-8 flex gap-8">
                <Skeleton className="h-20 w-20 rounded-2xl shrink-0" />
                <div className="flex-1 min-w-0 space-y-4">
                  <div className="flex justify-between gap-4">
                    <div className="space-y-2 min-w-0">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-6 w-24 rounded-full shrink-0" />
                  </div>
                  <div className="flex flex-wrap gap-8">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
