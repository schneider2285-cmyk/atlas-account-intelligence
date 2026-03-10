import { OrgChartShell } from '@/apps/web/components/orgchart/OrgChartShell';

export default function OrgChartPage() {
  return (
    <main className="space-y-4 p-6">
      <h1 className="text-2xl font-bold text-white">Org Chart Explorer</h1>
      <OrgChartShell />
    </main>
  );
}
