const agents = [
  'Yahoo Jobs',
  'Yahoo News',
  'Yahoo People',
  'Yahoo Initiatives',
  'Yahoo Social',
  'Yahoo Conferences',
  'Yahoo Network',
  'Yahoo Brief',
  'FICO Intel',
  'FICO Brief',
  'SE Intel',
  'SE Brief'
];

export function AgentStatusList() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => (
        <div key={agent} className="rounded-xl border border-line bg-panel p-4">
          <div className="text-sm font-medium text-white">{agent}</div>
          <div className="mt-1 text-xs text-emerald-300">Configured</div>
        </div>
      ))}
    </div>
  );
}
