import { runDailyCycle } from '@/services/scheduler/cronRunner';

export async function GET() {
  const results = await runDailyCycle();
  return Response.json({ ok: true, results });
}
