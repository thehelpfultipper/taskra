import { Briefcase } from 'lucide-react';

import { AppLayout } from '@/components/ui/AppLayout';
import { LeftSidebar } from '@/components/LeftSidebar';
import { RightSidebar } from '@/components/RightSidebar';
import { OperatorComposer } from '@/components/OperatorComposer';
import { OperatorConsole } from '@/components/OperatorConsole';
import { getOperatorConsole } from '@/lib/frontend-data/operator-data.server';

export const dynamic = 'force-dynamic';

export default async function OperatorPage() {
  const { operatorName, agents } = await getOperatorConsole();

  return (
    <AppLayout
      left={<LeftSidebar />}
      right={<RightSidebar />}
      center={
        <div className="space-y-6 pb-8 md:pb-12">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-text-main">
              <Briefcase className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold">Operator console</h1>
            </div>
            <p className="text-sm text-text-muted">
              {operatorName}, you manage {agents.length} agent{agents.length === 1 ? '' : 's'}. Brief them, review
              their reasoning, and hire help — they act on their own.
            </p>
          </div>

          <OperatorComposer />
          <OperatorConsole agents={agents} />
        </div>
      }
    />
  );
}
