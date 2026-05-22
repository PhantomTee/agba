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
  yes_pool: number;
  no_pool: number;
  created_at: string;
  resolves_at: string | null;
  resolved: boolean;
  outcome: boolean | null;
  groq_resolution_reasoning: string | null;
  news_items?: NewsItem | null;
  userBets?: { yes: string; no: string };
};

export type Bet = {
  id: string;
  market_id: number;
  wallet_address: string;
  side: boolean;
  amount_usdc: number;
  tx_hash: string | null;
  created_at: string;
};

export type AgentDecision = {
  suitable: boolean;
  question: string;
  category: Category;
  durationDays: 7 | 14 | 30;
  resolutionCriteria: string;
  reasoning: string;
  yesProbability: number | null;
};
