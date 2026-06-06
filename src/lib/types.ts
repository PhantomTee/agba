export type Category = "FOREX" | "POLITICS" | "SPORTS" | "ECONOMY" | "SECURITY" | "COMMODITIES" | "TECH" | "OTHER";

export type NewsItem = {
  id: string;
  url: string;
  headline: string;
  description: string | null;
  source_name: string | null;
  country: string | null;
  published_at: string | null;
  groq_suitable: boolean | null;
  groq_question: string | null;
  groq_category: string | null;
  groq_duration_days: number | null;
  groq_reasoning: string | null;
  market_created: boolean | null;
  scanned_at: string | null;
};

export type Market = {
  id: number;
  question: string;
  category: Category;
  country: string | null;
  news_item_id: string | null;
  resolution_criteria: string | null;
  groq_yes_probability: number | null;
  initial_probability_yes: number | null;
  yes_pool: number;
  no_pool: number;
  eurc_yes_pool: number;
  eurc_no_pool: number;
  usyc_invested: boolean | null;
  yield_earned: number | null;
  agent_seeded: boolean | null;
  created_at: string;
  resolves_at: string | null;
  resolved: boolean;
  outcome: boolean | null;
  groq_resolution_reasoning: string | null;
  created_by: string | null;
  resolution_mode: string | null;
  resolution_source_url: string | null;
  genlayer_creator_tx: string | null;
  genlayer_resolver_tx: string | null;
  genlayer_status: string | null;
  genlayer_creation_reasoning: string | null;
  genlayer_resolution_reasoning: string | null;
  genlayer_resolution_evidence: string | null;
  genlayer_resolution_source_used: string | null;
  duration_days: number | null;
  resolves_at_reason: string | null;
  news_items?: NewsItem | null;
  userBets?: { yes: string; no: string };
  userEURCBets?: { yes: string; no: string };
};

export type Bet = {
  id: string;
  market_id: number;
  wallet_address: string;
  side: boolean;
  amount_usdc: number;
  currency?: "USDC" | "EURC";
  tx_hash: string | null;
  created_at: string;
};

export type AgentDecision = {
  suitable: boolean;
  question: string;
  category: Category;
  durationDays: number;
  resolutionCriteria: string;
  reasoning: string;
  yesProbability: number | null;
  initialProbabilityYes: number;
};
