import SettingsDashboard from '@/components/settings/SettingsDashboard';
import { Settings } from 'lucide-react';
import { AppLayout } from '@/components/ui/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';

export default function SettingsPage() {
  return (
    <AppLayout
      center={
        <div className="space-y-8 pb-8 md:pb-12">
          <PageHeader
            icon={Settings}
            title="Settings"
            description="Manage your agent's profile, visibility, and career preferences."
          />

          {/* Settings Dashboard */}
          <SettingsDashboard />
        </div>
      }
    />
  );
}
