import type { Category } from "./types";

export const NEWS_SOURCES = [
  // General Nigerian news
  { name: "Punch Nigeria", url: "https://punchng.com/feed/", country: "NG", language: "en" },
  { name: "Vanguard Nigeria", url: "https://www.vanguardngr.com/feed/", country: "NG", language: "en" },
  { name: "The Nation Nigeria", url: "https://thenationonlineng.net/feed/", country: "NG", language: "en" },
  { name: "Channels TV", url: "https://www.channelstv.com/feed/", country: "NG", language: "en" },
  { name: "Premium Times", url: "https://www.premiumtimesng.com/feed/", country: "NG", language: "en" },
  { name: "Guardian Nigeria", url: "https://guardian.ng/feed/", country: "NG", language: "en" },
  { name: "Daily Trust", url: "https://dailytrust.com/feed/", country: "NG", language: "en" },
  // Dedicated forex & financial feeds — generates NGN/currency threshold markets
  { name: "Nairametrics Forex", url: "https://nairametrics.com/category/business/forex/feed/", country: "NG", language: "en" },
  { name: "Nairametrics Economy", url: "https://nairametrics.com/category/business/economic-indicators/feed/", country: "NG", language: "en" },
  { name: "BusinessDay Nigeria", url: "https://businessday.ng/feed/", country: "NG", language: "en" },
  { name: "BusinessDay Markets", url: "https://businessday.ng/category/markets/feed/", country: "NG", language: "en" },
  { name: "The Exchange Africa", url: "https://theexchange.africa/feed/", country: "AFRICA", language: "en" },
  { name: "Stears Business", url: "https://www.stears.co/rss.xml", country: "NG", language: "en" },
  { name: "ThisDay Nigeria", url: "https://www.thisdaylive.com/index.php/feed/", country: "NG", language: "en" },
  // Pan-African
  { name: "African Business", url: "https://african.business/feed", country: "AFRICA", language: "en" },
  { name: "The Africa Report", url: "https://www.theafricareport.com/feed/", country: "AFRICA", language: "en" },
  { name: "Nation Africa", url: "https://nation.africa/rss/news.xml", country: "KE", language: "en" },
  // Tech & Fintech — TECH category
  { name: "TechCabal", url: "https://techcabal.com/feed/", country: "AFRICA", language: "en" },
  { name: "Techpoint Africa", url: "https://techpoint.africa/feed/", country: "NG", language: "en" },
  { name: "Disrupt Africa", url: "https://disrupt-africa.com/feed/", country: "AFRICA", language: "en" },
  // Commodities & Energy — COMMODITIES category
  { name: "Nairametrics Energy", url: "https://nairametrics.com/category/energy/feed/", country: "NG", language: "en" },
] as const;

export const CATEGORIES: Category[] = ["FOREX", "POLITICS", "SPORTS", "ECONOMY", "SECURITY", "COMMODITIES", "TECH"];

export const CATEGORY_COLORS: Record<Category, string> = {
  FOREX: "#f5a623",
  POLITICS: "#d1495b",
  SPORTS: "#2d6a4f",
  ECONOMY: "#4cc9f0",
  SECURITY: "#ef476f",
  COMMODITIES: "#c77dff",
  TECH: "#00b4d8",
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
  "function createMarket(string question,string category,string country,string headline,string newsUrl,uint256 durationDays,uint256 initialProbabilityYes) external returns (uint256)",
  "function bet(uint256 marketId,bool yes,uint256 amount) external",
  "function betEURC(uint256 marketId,bool yes,uint256 amount) external",
  "function resolveMarket(uint256 marketId,bool outcome) external",
  "function claimWinnings(uint256 marketId) external",
  "function claimEURCWinnings(uint256 marketId) external",
  "function withdrawFees(address recipient,uint256 amount) external",
  "function investInUSYC(uint256 marketId,uint256 usdcAmount) external",
  "function getMarket(uint256 marketId) view returns (uint256 id,string question,string category,string sourceCountry,string newsHeadline,string newsUrl,uint256 createdAt,uint256 resolvesAt,uint256 yesPool,uint256 noPool,uint256 initialProbabilityYes,bool resolved,bool outcome,address creator)",
  "function getEURCPools(uint256 marketId) view returns (uint256 yesPool,uint256 noPool)",
  "function getUserBets(uint256 marketId,address user) view returns (uint256 yes,uint256 no)",
  "function getUserEURCBets(uint256 marketId,address user) view returns (uint256 yes,uint256 no)",
  "function getMarketUSYCBalance(uint256 marketId) view returns (uint256)",
  "function getMarketYieldEarned(uint256 marketId) view returns (uint256)",
  "function getOpenMarkets() view returns (uint256[])",
  "function getMarketsByCategory(string category) view returns (uint256[])",
  "function marketCount() view returns (uint256)",
  "event MarketCreated(uint256 indexed marketId,string question,string category,string country,uint256 resolvesAt)",
  "event Bet(uint256 indexed marketId,address indexed bettor,bool yes,uint256 amount)",
  "event EURCBet(uint256 indexed marketId,address indexed bettor,bool yes,uint256 amount)",
  "event Claim(uint256 indexed marketId,address indexed user,uint256 amount)",
  "event EURCClaim(uint256 indexed marketId,address indexed user,uint256 amount)",
  "event MarketUSYCInvested(uint256 indexed marketId,uint256 usdcAmount,uint256 usycShares)",
  "event MarketUSYCRedeemed(uint256 indexed marketId,uint256 usdcReceived,uint256 yieldEarned)",
] as const;

export const ERC20_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
] as const;
