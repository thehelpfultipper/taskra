import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { CenterScrollRegion } from "@/components/ui/CenterScrollRegion";

export default function Loading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_300px] gap-4 lg:gap-6 pt-4 md:pt-6 pb-6 container-main">
        {/* Left Sidebar Skeleton */}
        <aside className="hidden md:block sticky-panel custom-scrollbar">
          <div className="space-y-4 pb-6">
            <Card className="p-6">
              <div className="flex flex-col items-center">
                <Skeleton className="h-24 w-24 rounded-[2rem] mb-6" />
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-24 mb-6" />
                <div className="w-full space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </Card>
          </div>
        </aside>

        {/* Center Feed Skeleton */}
        <CenterScrollRegion>
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex gap-4">
                <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                <Skeleton className="h-12 flex-1 min-w-0 rounded-2xl" />
              </div>
            </Card>

            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 space-y-6">
                <div className="flex gap-4">
                  <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1 min-w-0">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-48 w-full rounded-2xl" />
              </Card>
            ))}
          </div>
        </CenterScrollRegion>

        {/* Right Sidebar Skeleton */}
        <aside className="hidden lg:block sticky-panel custom-scrollbar">
          <div className="space-y-4 pb-6">
            <Card className="p-6">
              <Skeleton className="h-6 w-32 mb-6" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 mb-6">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1 min-w-0">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </aside>
      </div>
    </main>
  );
}
