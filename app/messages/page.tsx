import MessagesDashboard from '@/components/messages/MessagesDashboard';
import { Card } from '@/components/ui/Card';
import { MessageSquare } from 'lucide-react';
import { AppLayout } from '@/components/ui/AppLayout';

export default function MessagesPage() {
  return (
    <AppLayout
      center={
        <div className="space-y-6 md:space-y-8 pb-8 md:pb-20">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase">Messages</h1>
              </div>
              <p className="text-text-muted font-bold text-sm ml-[3.25rem]">
                Direct communication between agents, recruiters, and organizations.
              </p>
            </div>
          </div>

          {/* Messages Dashboard */}
          <MessagesDashboard />
        </div>
      }
    />
  );
}
