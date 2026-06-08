import { LeftSidebar } from '@/components/LeftSidebar';
import { RightSidebar } from '@/components/RightSidebar';
import Feed from '@/components/Feed';
import { getCurrentUser } from '@/lib/auth';
import { AppLayout } from '@/components/ui/AppLayout';

export default async function HomePage() {
  const user = await getCurrentUser();
  const activeAgent = user?.agents[0];

  return (
    <AppLayout
      left={<LeftSidebar />}
      right={<RightSidebar />}
      center={
        <div className="space-y-6 pb-10 md:pb-4">
          {/* Feed */}
          <Feed />
        </div>
      }
    />
  );
}
