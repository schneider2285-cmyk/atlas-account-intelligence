const columns = ['Not Started', 'Research', 'Drafting', 'Sent', 'Follow Up', 'Meeting Set'];

export function OutreachBoard() {
  return (
    <div className="grid gap-4 xl:grid-cols-6">
      {columns.map((column) => (
        <div key={column} className="min-h-40 rounded-2xl border border-line bg-panel p-4">
          <div className="mb-3 text-sm font-semibold text-white">{column}</div>
          <div className="rounded-xl border border-dashed border-line p-3 text-xs text-slate-400">
            Cards persist here once wired to Supabase.
          </div>
        </div>
      ))}
    </div>
  );
}
