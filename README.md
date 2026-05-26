# Àgbà

**Africa's autonomous prediction market, running on Arc and GenLayer.**

Àgbà (Yoruba for "elder") is an AI agent that scans African news, turns stories into binary prediction markets using GenLayer Intelligent Contracts, settles bets in USDC and EURC on Circle's Arc blockchain, and resolves outcomes automatically from named sources. Idle pool capital is deployed into USYC (Hashnote US Yield Coin) to earn T-bill yield while markets run.

Live at [agba.vercel.app](https://agba.vercel.app)

---

## The Agent Loop

```
RSS feeds (22 sources across Nigeria, Kenya, South Africa, pan-Africa)
      |
      v
GenLayer Studionet (MarketCreator.py)
  -- Fetch source URL live
  -- Is this market-worthy?
  -- Generate YES/NO question
  -- Set duration (1 to 45 days)
  -- Estimate initial probability (5 to 95)
  -- eq_principle.strict_eq: validators must agree
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
GenLayer Studionet (MarketResolver.py)
  -- Fetch resolution source URL live
  -- Resolve YES / NO / UNKNOWN from page content
  -- UNKNOWN if source is paywalled, ambiguous, or stale
  -- Never guesses
  FOREX fallback  -> ExchangeRate API (live NGN/USD rate vs threshold)
  SPORTS fallback -> Football-Data.org (official match results)
      |
      v
resolveMarket() called on-chain
Winners claim principal + proportional yield share
```

---

## Categories

| Category | Resolution source |
|---|---|
| FOREX | GenLayer source fetch, ExchangeRate API fallback |
| SPORTS | GenLayer source fetch, Football-Data.org fallback |
| ECONOMY | GenLayer source fetch |
| POLITICS | GenLayer source fetch |
| TECH | GenLayer source fetch |
| SECURITY | GenLayer source fetch |
| COMMODITIES | GenLayer source fetch |

GenLayer returns UNKNOWN if the named source is unreachable, paywalled, ambiguous, or stale. UNKNOWN markets fall to a manual resolution queue — no incorrect resolutions are ever forced.

---

## Stack

| Layer | Technology |
|---|---|
| Blockchain | Arc (Circle L1, Chain ID 5042002) |
| Settlement currencies | USDC, EURC |
| Yield | USYC (Hashnote US Yield Coin, ERC-4626) |
| Smart contract | Solidity 0.8.20, AgbaMarket.sol |
| AI oracle (creation) | GenLayer Studionet, MarketCreator.py |
| AI oracle (resolution) | GenLayer Studionet, MarketResolver.py |
| AI fallback | Groq Llama 3.3 70b (opt-in via USE_GROQ_FALLBACK=true) |
| Frontend | Next.js 14 App Router |
| Database | Supabase (Postgres + Realtime) |
| Scheduling | GitHub Actions |
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

Three patterns in this codebase that any Arc or GenLayer builder can fork:

**1. GenLayer Intelligent Contract as a trust-minimised AI oracle**
`contracts/genlayer/MarketCreator.py` and `contracts/genlayer/MarketResolver.py`

Two-contract pattern: one proposes markets from live source content, one resolves them. Both use `gl.nondet.web.get()` to fetch the named URL at execution time and `gl.eq_principle.strict_eq` to require validator consensus before the result is accepted. Directly portable to any prediction market, insurance contract, or oracle that needs AI reasoning over live web content without a centralised off-chain service.

**2. Two-chain async pipeline: GenLayer + Arc**
`src/lib/genlayer/` and `src/app/api/agent/`

Pattern for orchestrating GenLayer transactions (which are async and require polling) from a Next.js API layer before committing to a second chain (Arc). Handles REQUESTED → READY state transitions, JSON output extraction from GenLayer transaction receipts, and Zod validation of typed outputs before on-chain writes. GitHub Actions provides the polling cron at 15-minute intervals without Vercel Cron.

**3. USYC ERC-4626 vault integration from Solidity**
`contracts/AgbaMarket.sol` (`investInUSYC`, `_callUSYCTeller`, `_callUSYCRedeem`)

Working contract-to-contract USYC deposit and redemption. Handles the standard ERC-4626 three-parameter `redeem(uint256,address,address)` signature and the alternate buy/sell wrapper used by some teller versions. Includes principal tracking and yield accounting at resolution. This is the only open-source example of this flow on Arc.

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
- GenLayer Studionet wallet (see below)
- API keys: Groq (fallback only), Tavily (fallback only), ExchangeRate API, Football-Data.org

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

# Agent wallet (Arc contract deployer)
AGENT_PRIVATE_KEY=<deployer_private_key>

# GenLayer Studionet
GENLAYER_CHAIN_ID=61999
GENLAYER_RPC_URL=https://studio.genlayer.com/api
GENLAYER_EXPLORER_URL=https://explorer-studio.genlayer.com
GENLAYER_TOKEN_SYMBOL=GEN
GENLAYER_PRIVATE_KEY=<genlayer_wallet_private_key>
GENLAYER_AGENT_ADDRESS=<genlayer_wallet_address>
GENLAYER_MARKET_CREATOR_ADDRESS=<deployed_MarketCreator_address>
GENLAYER_MARKET_RESOLVER_ADDRESS=<deployed_MarketResolver_address>
USE_GROQ_FALLBACK=false

# Supabase
NEXT_PUBLIC_SUPABASE_URL=<supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# AI fallback (only used when USE_GROQ_FALLBACK=true)
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

Keep `GENLAYER_PRIVATE_KEY` and `AGENT_PRIVATE_KEY` server-side only. Never prefix them with `NEXT_PUBLIC_`.

### Install and run

```bash
npm install --legacy-peer-deps
npm run dev
```

### Deploy the Arc contract

```bash
node scripts/deploy-agba-market.mjs
```

Set `NEXT_PUBLIC_CONTRACT_ADDRESS` to the deployed address in your environment.

### Set up a GenLayer wallet

```bash
npm run genlayer:wallet:create   # generates key, writes to .env.local
npm run genlayer:fund            # calls sim_fundAccount with 5000 GEN
npm run genlayer:balance         # confirm balance before deploying
```

### Deploy GenLayer contracts

```bash
node scripts/deploy-genlayer-contracts.mjs
```

Set `GENLAYER_MARKET_CREATOR_ADDRESS` and `GENLAYER_MARKET_RESOLVER_ADDRESS` in your environment.

---

## Cron Jobs

GitHub Actions runs the agent autonomously:

| Workflow | Endpoint | Schedule |
|---|---|---|
| GenLayer market scan | `POST /api/agent/request-genlayer-market` | Every 15 minutes |
| GenLayer resolution request | `POST /api/agent/request-genlayer-resolution` | Every 30 minutes |
| GenLayer resolution check | `POST /api/agent/check-genlayer-resolution` | Every 30 minutes |
| USYC yield sweep | `POST /api/agent/yield` | Every 15 minutes |

All routes authenticate via `x-cron-secret` header. Set `CRON_SECRET` and `APP_URL` as GitHub Actions secrets.

---

## Architecture

```
src/
  app/
    api/
      agent/
        request-genlayer-market/     -- Submit news to GenLayer MarketCreator
        check-genlayer-market/       -- Poll GenLayer for proposal result
        create-arc-market-from-genlayer/ -- createMarket() on Arc from proposal
        request-genlayer-resolution/ -- Submit expired market to GenLayer MarketResolver
        check-genlayer-resolution/   -- Poll GenLayer for resolution result
        resolve/                     -- FOREX/SPORTS direct API fallback resolution
        yield/                       -- USYC sweep: invest idle USDC, track yield
      bet/         -- Verify on-chain tx receipt, record bet in Supabase
      markets/     -- Market list and detail with on-chain pool enrichment
      activity/    -- Wallet bet history (DB + on-chain events merged)
      yield/chain/ -- RPC calls for yield dashboard (isolated, cached)
    market/[id]/   -- Market detail page
    yield/         -- Yield dashboard
  components/
    GlobePreloader -- Canvas dot-globe intro animation (plays once per session)
    BetPanel       -- USDC and EURC betting UI with live yield estimate
    YieldChainPanel-- On-chain yield metrics with skeleton loading
  lib/
    genlayer/
      client.ts        -- genlayer-js SDK wrapper, async result handling
      marketCreator.ts -- Typed proposal request and validation
      marketResolver.ts-- Typed resolution request and validation
    agentScan.ts   -- RSS fetch, GenLayer proposal, Arc market creation
    agentResolve.ts-- GenLayer resolution, fallback APIs, on-chain settlement
    agentYield.ts  -- USYC sweep logic
    groq.ts        -- Fallback: analyzeNewsForMarket, resolveMarketQuestion
    tavily.ts      -- Fallback: Tavily web search for resolution context
    chain.ts       -- ethers v6 provider and contract helpers
contracts/
  AgbaMarket.sol              -- Prediction market + USYC yield vault
  genlayer/
    MarketCreator.py          -- GenLayer Intelligent Contract for market creation
    MarketResolver.py         -- GenLayer Intelligent Contract for resolution
scripts/
  deploy-agba-market.mjs          -- Arc contract deployment
  deploy-genlayer-contracts.mjs   -- GenLayer contract deployment
  genlayer-wallet-create.mjs      -- Generate and fund GenLayer wallet
```

---

## USYC Yield

When a market has idle USDC in its pool, the agent calls `investInUSYC()` to deposit into the Hashnote USYC teller. USYC is a tokenised US Treasury fund earning approximately 4 to 5% APY on Arc.

At resolution, `resolveMarket()` triggers `_redeemMarketUSYC()` internally. Any amount returned above the original principal is recorded as `yieldEarned` and distributed proportionally to winning bettors. The BetPanel shows a live estimated yield share based on current pool ratios.

> Contract-to-contract USYC interactions require whitelisting on the Hashnote teller. Submit your deployed contract address via the Circle whitelisting process to enable live yield.

---

## License

MIT
