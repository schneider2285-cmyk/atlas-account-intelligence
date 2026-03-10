const sampleSignals = [
  'Yahoo Mail modernization acceleration signal',
  'FICO platform hiring signal',
  'SE TITAN urgency signal'
];

export function SignalFeed() {
  return (
    <div className="space-y-3">
      {sampleSignals.map((signal) => (
        <div key={signal} className="rounded-xl border border-line bg-panel p-4 text-sm text-slate-200">
          {signal}
        </div>
      ))}
    </div>
  );
}
