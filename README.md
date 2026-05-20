# Agba

Africa's prediction market. Built by Africans, for Africans.

Agba is a Next.js 14 app that reads African RSS news, uses Groq to turn suitable stories into binary prediction markets, posts those markets to an Arc testnet Solidity contract, and records live market/bet state in Supabase.

## Stack

- Next.js 14 App Router, TypeScript, Tailwind CSS
- Supabase tables and Realtime for markets, bets, and AI reading-room updates
- Groq SDK with `llama-3.3-70b-versatile`
- Ethers v6 for Arc RPC, market creation, bet verification, and resolution
- wagmi v2 and ConnectKit for wallet connection
- Vercel Cron routes for scanning and resolution
- Circle Bridge Kit for CCTP USDC bridge estimates and server-wallet execution to Arc testnet
- Polymarket CLOB V2 client configured with a builder code for off-Arc builder-fee reporting

## Required Environment

Copy `.env.example` to `.env.local` and fill every value needed for the features you enable. API routes intentionally return errors when required values are missing; they do not fabricate data.

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
- `BRIDGE_ESTIMATE_PRIVATE_KEY`
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
```

## Cron

`vercel.json` schedules:

- `POST /api/agent/scan` every 15 minutes
- `POST /api/agent/resolve` daily at 07:00 UTC

Set `CRON_SECRET` in production and send it as `Authorization: Bearer <secret>` or `x-cron-secret` when invoking cron routes outside Vercel.

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
