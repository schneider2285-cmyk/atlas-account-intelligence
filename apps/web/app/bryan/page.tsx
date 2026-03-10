import Link from 'next/link';

export default function BryanPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-3xl font-bold text-white">Bryan Partner View, Yahoo Only</h1>
      <div className="flex gap-3">
        {['discoveries', 'outreach', 'briefings'].map((route) => (
          <Link key={route} href={`/bryan/${route}`} className="rounded-full border border-line px-4 py-2 text-sm text-slate-200">
            {route}
          </Link>
        ))}
      </div>
    </main>
  );
}
