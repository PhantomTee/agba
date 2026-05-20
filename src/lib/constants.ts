import type { Category } from "./types";

export const NEWS_SOURCES = [
  { name: "Punch Nigeria", url: "https://punchng.com/feed/", country: "NG", language: "en" },
  { name: "Vanguard Nigeria", url: "https://www.vanguardngr.com/feed/", country: "NG", language: "en" },
  { name: "The Nation Nigeria", url: "https://thenationonlineng.net/feed/", country: "NG", language: "en" },
  { name: "Channels TV", url: "https://www.channelstv.com/feed/", country: "NG", language: "en" },
  { name: "Premium Times", url: "https://www.premiumtimesng.com/feed/", country: "NG", language: "en" },
  { name: "African Business", url: "https://african.business/feed", country: "AFRICA", language: "en" },
  { name: "Quartz Africa", url: "https://qz.com/africa/feed/", country: "AFRICA", language: "en" },
  { name: "The Africa Report", url: "https://www.theafricareport.com/feed/", country: "AFRICA", language: "en" },
] as const;

export const CATEGORIES: Category[] = ["FOREX", "POLITICS", "SPORTS", "ECONOMY", "SECURITY"];

export const CATEGORY_COLORS: Record<Category, string> = {
  FOREX: "#f5a623",
  POLITICS: "#d1495b",
  SPORTS: "#2d6a4f",
  ECONOMY: "#4cc9f0",
  SECURITY: "#ef476f",
  OTHER: "#8d99ae",
};

export const COUNTRY_FLAGS: Record<string, string> = {
  NG: "NG",
  GH: "GH",
  KE: "KE",
  ZA: "ZA",
  AFRICA: "AFRICA",
};

export const MARKET_ABI = [
  "function createMarket(string question,string category,string country,string headline,string newsUrl,uint256 durationDays) external returns (uint256)",
  "function bet(uint256 marketId,bool yes,uint256 amount) external",
  "function resolveMarket(uint256 marketId,bool outcome) external",
  "function claimWinnings(uint256 marketId) external",
  "function getMarket(uint256 marketId) view returns (uint256 id,string question,string category,string sourceCountry,string newsHeadline,string newsUrl,uint256 createdAt,uint256 resolvesAt,uint256 yesPool,uint256 noPool,bool resolved,bool outcome,address creator)",
  "function getUserBets(uint256 marketId,address user) view returns (uint256 yes,uint256 no)",
  "function getOpenMarkets() view returns (uint256[])",
  "function getMarketsByCategory(string category) view returns (uint256[])",
  "function marketCount() view returns (uint256)",
  "event MarketCreated(uint256 indexed marketId,string question,string category,string country,uint256 resolvesAt)",
  "event Bet(uint256 indexed marketId,address indexed bettor,bool yes,uint256 amount)",
  "event Claim(uint256 indexed marketId,address indexed user,uint256 amount)",
] as const;

export const ERC20_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
] as const;
