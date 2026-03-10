const items = [
  { label: 'Accounts', value: '3' },
  { label: 'Agents', value: '12' },
  { label: 'Core Signals', value: 'Live' },
  { label: 'Outreach Control', value: 'Manual' }
];

export function KpiStrip() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-line bg-panel p-4">
          <div className="text-sm text-slate-400">{item.label}</div>
          <div className="mt-1 text-2xl font-bold text-white">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
