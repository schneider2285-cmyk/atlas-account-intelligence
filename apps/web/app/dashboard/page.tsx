import { AgentStatusList } from '@/apps/web/components/agents/AgentStatusList';
import { AccountSwitcher } from '@/apps/web/components/dashboard/AccountSwitcher';
import { AlertBanner } from '@/apps/web/components/dashboard/AlertBanner';
import { KpiStrip } from '@/apps/web/components/dashboard/KpiStrip';
import { SignalFeed } from '@/apps/web/components/signals/SignalFeed';
import { Card } from '@/apps/web/components/ui/Card';

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-white">ATLAS Account Intelligence</h1>
        <p className="text-slate-400">Main command center for Yahoo, FICO, and Schneider Electric.</p>
      </div>
      <AlertBanner />
      <AccountSwitcher />
      <KpiStrip />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recent Signals">
          <SignalFeed />
        </Card>
        <Card title="Agent Health">
          <AgentStatusList />
        </Card>
      </div>
    </main>
  );
}
