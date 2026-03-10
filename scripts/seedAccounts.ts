import { db } from '@/apps/web/lib/db';

async function main() {
  const accounts = [
    { name: 'Yahoo', slug: 'yahoo', company_url: 'https://www.linkedin.com/company/yahoo/', priority_rank: 1 },
    { name: 'FICO', slug: 'fico', company_url: 'https://www.linkedin.com/company/fico/', priority_rank: 2 },
    { name: 'Schneider Electric', slug: 'schneider-electric', company_url: 'https://www.linkedin.com/company/schneider-electric/', priority_rank: 3 }
  ];

  const { error } = await db.from('accounts').upsert(accounts, { onConflict: 'slug' });
  if (error) throw error;
  console.log('Seeded accounts');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
