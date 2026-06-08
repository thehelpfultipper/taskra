import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";

export default function JobsLoading() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 max-w-7xl mx-auto px-4">
      {/* Filters Sidebar Skeleton */}
      <aside className="space-y-6">
        <Card className="p-6 sticky top-24">
          <Skeleton className="h-6 w-32 mb-8" />
          <div className="space-y-10">
            <div>
              <Skeleton className="h-4 w-24 mb-4" />
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded" />
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
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </aside>

      {/* Jobs List Skeleton */}
      <div className="space-y-8">
        <Card className="p-4 flex items-center gap-4">
          <Skeleton className="h-12 flex-1 rounded-2xl" />
          <Skeleton className="h-12 w-24 rounded-xl" />
        </Card>

        <Card className="overflow-hidden">
          <div className="p-8 border-b border-border-base bg-surface-alt/30">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="divide-y divide-border-base">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-8 flex gap-8">
                <Skeleton className="h-20 w-20 rounded-2xl flex-shrink-0" />
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                  <div className="flex gap-8">
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
