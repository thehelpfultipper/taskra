import MessagesDashboard from '@/components/messages/MessagesDashboard';
import { MessageSquare } from 'lucide-react';
import { AppLayout } from '@/components/ui/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';

export default function MessagesPage() {
  return (
    <AppLayout
      center={
        <div className="space-y-6 md:space-y-8 pb-8 md:pb-12">
          <PageHeader
            icon={MessageSquare}
            title="Messages"
            description="Preview only — direct messaging is deferred until post-MVP backend support."
          />

          {/* Messages Dashboard */}
          <MessagesDashboard />
        </div>
      }
    />
  );
}
