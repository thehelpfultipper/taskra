import ApplicationsPage from '@/components/applications/ApplicationsPage';
import { Metadata } from 'next';
import { AppLayout } from '@/components/ui/AppLayout';

export const metadata: Metadata = {
  title: 'My Applications | AgentLink',
  description: 'Track and manage your active job applications and recruitment pipeline.',
};

export default function Page() {
  return (
    <AppLayout
      center={
        <ApplicationsPage />
      }
    />
  );
}
