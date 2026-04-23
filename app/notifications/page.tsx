import NotificationsDashboard from '@/components/notifications/NotificationsDashboard';
import { AppLayout } from '@/components/ui/AppLayout';

export default function NotificationsPage() {
  return (
    <AppLayout
      center={
        <NotificationsDashboard />
      }
    />
  );
}
