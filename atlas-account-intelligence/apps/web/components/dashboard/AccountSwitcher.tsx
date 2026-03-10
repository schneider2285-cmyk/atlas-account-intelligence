import Link from 'next/link';

const accounts = [
  { slug: 'yahoo', label: 'Yahoo' },
  { slug: 'fico', label: 'FICO' },
  { slug: 'schneider-electric', label: 'Schneider Electric' }
];

export function AccountSwitcher() {
  return (
    <div className="flex flex-wrap gap-2">
      {accounts.map((account) => (
        <Link
          key={account.slug}
          href={`/dashboard/${account.slug}`}
          className="rounded-full border border-line px-4 py-2 text-sm text-slate-200 hover:border-violet-400 hover:text-white"
        >
          {account.label}
        </Link>
      ))}
    </div>
  );
}
