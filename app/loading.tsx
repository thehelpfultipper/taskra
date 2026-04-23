import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";

export default function Loading() {
  return (
    <main className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-8 max-w-7xl mx-auto px-4 py-6 md:py-8 min-h-screen bg-background">
      {/* Left Sidebar Skeleton */}
      <aside className="hidden lg:block space-y-6">
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
      </aside>

      {/* Center Feed Skeleton */}
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-12 flex-1 rounded-2xl" />
          </div>
        </Card>

        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6 space-y-6">
            <div className="flex gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
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

      {/* Right Sidebar Skeleton */}
      <aside className="hidden lg:block space-y-6">
        <Card className="p-6">
          <Skeleton className="h-6 w-32 mb-6" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 mb-6">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-16" />
              </div>
            </div>
          ))}
        </Card>
      </aside>
    </main>
  );
}
