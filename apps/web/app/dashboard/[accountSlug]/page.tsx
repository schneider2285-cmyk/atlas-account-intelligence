import Link from 'next/link';
import { titleCase } from '@/apps/web/lib/utils';

export default function AccountPage({ params }: { params: { accountSlug: string } }) {
  const links = ['signals', 'discoveries', 'org-chart', 'outreach', 'agents', 'briefings'];

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-white">{titleCase(params.accountSlug)}</h1>
        <p className="text-slate-400">Scoped account operating surface.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {links.map((link) => (
          <Link key={link} href={`/dashboard/${params.accountSlug}/${link}`} className="rounded-full border border-line px-4 py-2 text-sm text-slate-200">
            {titleCase(link)}
          </Link>
        ))}
      </div>
    </main>
  );
}
