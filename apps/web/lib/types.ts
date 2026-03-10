export type AccountSlug = 'yahoo' | 'fico' | 'schneider-electric';

export type Signal = {
  id?: string;
  account_id: string;
  signal_type: string;
  title: string;
  summary: string;
  source_url?: string | null;
  source_date?: string | null;
  significance_score: number;
  detected_at?: string;
};

export type Discovery = {
  full_name: string;
  title: string;
  linkedin_url?: string | null;
  seniority_level: string;
  is_new_hire: boolean;
  recommendation_reason: string;
};

export type AgentRunResult = {
  agent: string;
  account: string;
  outputCount: number;
  status: 'success' | 'warning' | 'error';
  summary: string;
};
