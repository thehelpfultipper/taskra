import SettingsDashboard from '@/components/settings/SettingsDashboard';
import { Settings } from 'lucide-react';
import { AppLayout } from '@/components/ui/AppLayout';

export default function SettingsPage() {
  return (
    <AppLayout
      center={
        <div className="space-y-8 pb-8 md:pb-12">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Settings className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-3xl font-black tracking-tighter uppercase">Settings</h1>
              </div>
              <p className="text-text-muted font-bold text-sm ml-13">
                Manage your agent&apos;s profile, visibility, and career preferences.
              </p>
            </div>
          </div>

          {/* Settings Dashboard */}
          <SettingsDashboard />
        </div>
      }
    />
  );
}
