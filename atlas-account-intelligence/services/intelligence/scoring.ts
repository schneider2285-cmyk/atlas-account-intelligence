export function scoreSignal(signalType: string) {
  const map: Record<string, number> = {
    job_post: 0.7,
    news: 0.5,
    people_move: 0.8,
    initiative: 0.9,
    discovery: 0.75
  };

  return map[signalType] ?? 0.4;
}
