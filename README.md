# Agba

Africa's prediction market. Built by Africans, for Africans.

Agba is a Next.js 14 app that reads African RSS news, uses GenLayer to propose suitable binary prediction markets, posts those markets to an Arc testnet Solidity contract, and records live market/bet state in Supabase. Groq is available only as an opt-in fallback.

## Stack

- Next.js 14 App Router, TypeScript, Tailwind CSS
- Supabase tables and Realtime for markets, bets, and AI reading-room updates
- GenLayer Studionet for market creation and source-based resolution
- Groq SDK with `llama-3.3-70b-versatile` as fallback only when `USE_GROQ_FALLBACK=true`
- Ethers v6 for Arc RPC, market creation, bet verification, and resolution
- wagmi v2 and ConnectKit for wallet connection
- GitHub Actions cron triggers for scanning and resolution
- Circle Bridge Kit for connected-wallet CCTP USDC bridge estimates and execution to Arc testnet
- Polymarket CLOB V2 client configured with a builder code for off-Arc builder-fee reporting

## Required Environment

Create `.env.local` and fill every value needed for the features you enable. API routes intentionally return errors when required values are missing; they do not fabricate data.

GenLayer Studionet values:

```bash
GENLAYER_CHAIN_ID=61999
GENLAYER_RPC_URL=https://studio.genlayer.com/api
GENLAYER_EXPLORER_URL=https://explorer-studio.genlayer.com
GENLAYER_TOKEN_SYMBOL=GEN
GENLAYER_PRIVATE_KEY=
GENLAYER_AGENT_ADDRESS=
GENLAYER_MARKET_CREATOR_ADDRESS=
GENLAYER_MARKET_RESOLVER_ADDRESS=
USE_GROQ_FALLBACK=false
```

Keep `GENLAYER_PRIVATE_KEY` server-side only. Never prefix it with `NEXT_PUBLIC_`.

## Database

Run `supabase/schema.sql` in Supabase SQL editor. It creates:

- `news_items`
- `markets`
- `bets`
- `pending_resolution`

It also enables Realtime publication for `news_items`, `markets`, and `bets`.

## Contract

Deploy `contracts/AgbaMarket.sol` with the Arc testnet USDC address as constructor input. Set:

- `NEXT_PUBLIC_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_USDC_ADDRESS`
- `NEXT_PUBLIC_ARC_RPC`
- `NEXT_PUBLIC_ARC_CHAIN_ID`
- `AGENT_PRIVATE_KEY`
- `POLYMARKET_CLOB_HOST`
- `POLYMARKET_CHAIN_ID`
- `POLYMARKET_BUILDER_CODE`

All USDC amounts use 6 decimals.

## Commands

```bash
npm install --legacy-peer-deps
npm run build
npm run dev
npm run deploy:contract
npm run genlayer:wallet:create
npm run genlayer:fund
npm run genlayer:balance
```

## GenLayer Wallet

Create a fresh app wallet:

```bash
npm run genlayer:wallet:create
```

The command writes `GENLAYER_PRIVATE_KEY` and `GENLAYER_AGENT_ADDRESS` to `.env.local`, sets the Studionet network values, and prints only the public address.

Fund the wallet on GenLayer Studio/Studionet only:

```bash
npm run genlayer:fund
```

This calls `sim_fundAccount` with `5000000000000000000000` wei, equal to 5000 GEN when GEN has 18 decimals.

Check the balance:

```bash
npm run genlayer:balance
```

Do not deploy GenLayer contracts until the balance is confirmed.

## Cron

GitHub Actions is the scheduler of record:

- `.github/workflows/genlayer-market-create.yml`: `POST /api/agent/request-genlayer-market` every 15 minutes
- `.github/workflows/genlayer-resolution-request.yml`: `POST /api/agent/request-genlayer-resolution` every 30 minutes
- `.github/workflows/genlayer-resolution-check.yml`: `POST /api/agent/check-genlayer-resolution` every 30 minutes
- `.github/workflows/cron.yml`: `POST /api/agent/yield` every 15 minutes

Vercel Cron is intentionally unused. Set `CRON_SECRET` in production. GenLayer workflow routes send it as `x-cron-secret`; production cron requests fail closed when the secret is missing or wrong.

## Admin Resolution

Manual resolution uses:

- `GET /api/admin/pending-resolutions`
- `POST /api/admin/resolve-market`

Both require `ADMIN_API_KEY` as `Authorization: Bearer <key>` or `x-admin-api-key`.

## Verification

The latest local verification passed:

- `npm run build`
- `GET /` on the built server returned HTTP 200
- `GET /api/stats` returned a real missing-env error when Supabase env vars were absent

`agent-browser` was not installed in this shell, so browser screenshot verification could not be run from the CLI.
