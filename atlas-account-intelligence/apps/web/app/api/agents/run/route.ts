import { runAgent } from '@/services/scheduler/runAgent';

export async function POST(request: Request) {
  const body = await request.json();
  const result = await runAgent(body.agentName);
  return Response.json({ ok: true, result });
}
