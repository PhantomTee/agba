# Àgbà

**Africa's autonomous prediction market, running on Arc.**

Àgbà (Yoruba for "elder") is an AI agent that scans African news, turns stories into binary prediction markets, settles bets in USDC and EURC on Circle's Arc blockchain, and resolves outcomes automatically using live web search. Idle pool capital is deployed into USYC (Hashnote US Yield Coin) to earn T-bill yield while markets run.

Live at [agba.vercel.app](https://agba.vercel.app)

---

## The Agent Loop

```
RSS feeds (22 sources across Nigeria, Kenya, South Africa, pan-Africa)
      |
      v
Groq Llama 3.3 70b
  -- Is this market-worthy?
  -- Generate YES/NO question
  -- Set duration (1 to 180 days)
  -- Estimate initial probability (5 to 95)
      |
      v
AgbaMarket.sol on Arc
  createMarket(question, category, country, headline, url, durationDays, initialProbabilityYes)
      |
      v
Users bet USDC or EURC on YES or NO
      |
      v
Agent invests idle pool capital in USYC (Hashnote T-bill vault, ~4-5% APY)
      |
      v
Market expires
      |
      v
Autonomous resolution
  FOREX     -> ExchangeRate API (live NGN/USD rate vs threshold)
  SPORTS    -> Football-Data.org (official match results)
  All else  -> Tavily web search + Groq reasoning + confidence scoring
      |
      v
resolveMarket() called on-chain
Winners claim principal + proportional yield share
```

---

## Categories

| Category | Resolution source |
|---|---|
| FOREX | ExchangeRate API (CBN / FMDQ NGN rate) |
| SPORTS | Football-Data.org match results |
| ECONOMY | Tavily web search + Groq |
| POLITICS | Tavily web search + Groq |
| TECH | Tavily web search + Groq |
| SECURITY | Tavily web search + Groq |
| COMMODITIES | Tavily web search + Groq |

If Groq cannot determine the outcome with high or medium confidence from live search results, the market falls to a manual resolution queue. No incorrect resolutions are ever forced.

---

## Stack

| Layer | Technology |
|---|---|
| Blockchain | Arc (Circle L1, Chain ID 5042002) |
| Settlement currencies | USDC, EURC |
| Yield | USYC (Hashnote US Yield Coin, ERC-4626) |
| Smart contract | Solidity 0.8.20, AgbaMarket.sol |
| AI market creation | Groq, Llama 3.3 70b |
| AI resolution | Groq + Tavily real-time web search |
| Frontend | Next.js 14 App Router |
| Database | Supabase (Postgres) |
| Scheduling | Vercel Cron |
| News sources | 22 RSS feeds |

---

## Smart Contract

`AgbaMarket.sol` deployed on Arc testnet:
```
0xcaF6122F6a070e2cD4Be2F9d81DE18704E5A15f0
```

### Key functions

```solidity
// Create a market (agent only)
createMarket(question, category, country, headline, newsUrl, durationDays, initialProbabilityYes)

// Place a bet
bet(uint256 marketId, bool yes, uint256 amount)       // USDC
betEURC(uint256 marketId, bool yes, uint256 amount)   // EURC

// Resolve (agent only)
resolveMarket(uint256 marketId, bool outcome)

// Claim winnings
claimWinnings(uint256 marketId)
claimEURCWinnings(uint256 marketId)

// Yield management (agent only)
investInUSYC(uint256 marketId, uint256 usdcAmount)
```

### Events

```solidity
MarketCreated(uint256 indexed marketId, string question, string category, string country, uint256 resolvesAt)
Bet(uint256 indexed marketId, address indexed bettor, bool yes, uint256 amount)
EURCBet(uint256 indexed marketId, address indexed bettor, bool yes, uint256 amount)
MarketResolved(uint256 indexed marketId, bool outcome)
MarketUSYCInvested(uint256 indexed marketId, uint256 usdcAmount, uint256 usycShares)
MarketUSYCRedeemed(uint256 indexed marketId, uint256 usdcReceived, uint256 yieldEarned)
```

### Payout formula

```
payout = stake + (losingPool * stake / winningPool) + yieldShare - fee
fee    = grossProfit * 1.5%
```

Yield earned from USYC is distributed proportionally to winning bettors at resolution.

---

## Reusable Primitives

Three patterns in this codebase that any Arc builder can fork:

**1. AI agent to contract pipeline**
`src/lib/groq.ts` and `src/app/api/agent/scan/route.ts`

Structured prompt design for converting unstructured news into typed, validated on-chain actions. Covers JSON schema enforcement, category classification, duration calculation from article context, and probability estimation. Drop any data source in place of RSS and the pattern still works.

**2. Tavily + Groq autonomous resolution**
`src/lib/tavily.ts` and `src/lib/groq.ts` (`resolveMarketQuestion`)

Search-then-reason pattern for resolving YES/NO binary outcomes from real-world events without a centralised oracle. Confidence scoring (high, medium, low) prevents incorrect resolutions. Directly reusable for any prediction market, conditional escrow, or parametric insurance contract on Arc.

**3. USYC ERC-4626 vault integration from Solidity**
`contracts/AgbaMarket.sol` (`investInUSYC`, `_callUSYCTeller`, `_callUSYCRedeem`)

Working contract-to-contract USYC deposit and redemption. Handles both the standard ERC-4626 three-parameter `redeem(uint256,address,address)` signature and the alternate `buy/sell` wrapper used by some teller versions. Includes principal tracking and yield accounting at resolution. This is the only open-source example of this flow on Arc.

---

## News Sources

| Source | Country | Focus |
|---|---|---|
| Punch Nigeria | NG | General |
| Vanguard Nigeria | NG | General |
| Premium Times | NG | General |
| Channels TV | NG | General |
| The Nation Nigeria | NG | General |
| Guardian Nigeria | NG | General |
| Daily Trust | NG | General |
| BusinessDay Nigeria | NG | Markets |
| BusinessDay Markets | NG | Markets |
| Nairametrics Forex | NG | FOREX |
| Nairametrics Economy | NG | ECONOMY |
| Nairametrics Energy | NG | COMMODITIES |
| Stears Business | NG | ECONOMY |
| ThisDay Nigeria | NG | General |
| The Exchange Africa | AFRICA | Markets |
| African Business | AFRICA | General |
| The Africa Report | AFRICA | General |
| Nation Africa | KE | General |
| TechCabal | AFRICA | TECH |
| Techpoint Africa | NG | TECH |
| Disrupt Africa | AFRICA | TECH |

---

## Running Locally

### Prerequisites

- Node.js 20+
- Supabase project
- Arc testnet wallet funded with USDC ([Circle faucet](https://faucet.circle.com))
- API keys: Groq, Tavily, ExchangeRate API, Football-Data.org

### Environment variables

```bash
# Arc
NEXT_PUBLIC_ARC_RPC=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_CONTRACT_ADDRESS=0xcaF6122F6a070e2cD4Be2F9d81DE18704E5A15f0
NEXT_PUBLIC_USDC_ADDRESS=<arc_testnet_usdc_address>
NEXT_PUBLIC_EURC_ADDRESS=0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a
NEXT_PUBLIC_USYC_ADDRESS=0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C
NEXT_PUBLIC_USYC_TELLER=0x9fdF14c5B14173D74C08Af27AebFf39240dC105A

# Agent wallet (deployer of the contract)
AGENT_PRIVATE_KEY=<deployer_private_key>

# Supabase
NEXT_PUBLIC_SUPABASE_URL=<supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# AI
GROQ_API_KEY=<groq_key>
TAVILY_API_KEY=<tavily_key>

# Resolution APIs
EXCHANGE_RATE_API_KEY=<exchangerate-api.com_key>
FOOTBALL_DATA_API_KEY=<football-data.org_key>

# Cron authentication
CRON_SECRET=<random_secret>

# Optional: email alerts for manual resolution queue
RESEND_API_KEY=<resend_key>
ADMIN_EMAIL=<admin_email>
```

### Install and run

```bash
npm install --legacy-peer-deps
npm run dev
```

### Deploy the contract

```bash
node scripts/deploy-agba-market.mjs
```

Set `NEXT_PUBLIC_CONTRACT_ADDRESS` to the deployed address in your environment.

---

## Cron Jobs

Three Vercel Cron jobs run the agent autonomously:

| Job | Endpoint | Schedule |
|---|---|---|
| Scan news and create markets | `POST /api/agent/scan` | Every hour |
| Resolve expired markets | `POST /api/agent/resolve` | Every 30 minutes |
| Invest idle USDC in USYC | `POST /api/agent/yield` | Every 6 hours |

All cron routes authenticate via `Authorization: Bearer <CRON_SECRET>`.

---

## Architecture

```
src/
  app/
    api/
      agent/
        scan/      -- RSS fetch, Groq analysis, on-chain market creation
        resolve/   -- Expired market resolution (FOREX/SPORTS APIs + Groq + Tavily)
        yield/     -- USYC sweep: invest idle USDC, track yield
      bet/         -- Verify on-chain tx receipt, record bet in Supabase
      markets/     -- Market list and detail with on-chain pool enrichment
      activity/    -- Wallet bet history (DB + on-chain events merged)
      yield/chain/ -- RPC calls for yield dashboard (isolated, cached)
    market/[id]/   -- Market detail page
    yield/         -- Yield dashboard
  components/
    GlobePreloader -- Canvas dot-globe intro animation (plays once per session)
    BetPanel       -- USDC and EURC betting UI
    YieldChainPanel-- On-chain yield metrics with skeleton loading
  lib/
    groq.ts        -- analyzeNewsForMarket, resolveMarketQuestion
    tavily.ts      -- Tavily web search for resolution context
    chain.ts       -- ethers v6 provider and contract helpers
    agentYield.ts  -- USYC sweep logic
    similarity.ts  -- Keyword overlap to prevent duplicate markets
contracts/
  AgbaMarket.sol   -- Prediction market + USYC yield vault contract
scripts/
  deploy-agba-market.mjs -- Deployment script
```

---

## USYC Yield

When a market has idle USDC in its pool, the agent calls `investInUSYC()` to deposit into the Hashnote USYC teller. USYC is a tokenised US Treasury fund earning approximately 4 to 5% APY on Arc.

At resolution, `resolveMarket()` triggers `_redeemMarketUSYC()` internally. Any amount returned above the original principal is recorded as `yieldEarned` and distributed proportionally to winning bettors.

> Contract-to-contract USYC interactions require whitelisting on the Hashnote teller. Submit your deployed contract address via the Circle whitelisting process to enable live yield.

---

## License

MIT
