# Swap Skill

## Scope & Routing

**This skill handles**: token swaps, trades, exchanges, conversions, buying, and selling crypto tokens.

**Aliases that map to swap**: "swap", "trade", "exchange", "convert", "buy", "sell"

**NOT in scope** — route to the correct skill:
| Intent | Route to |
|--------|----------|
| Balance check, transfer, send, deposit, withdraw, wallet import | **Wallet skill** |
| Price check, trending, market data, token research, comparison | **Market skill** |
| Token audit, risk check, transaction simulation | **Security skill** |

## Pre-flight
1. `onekey version` — if not installed → `npm i -g @onekeyfe/cli`
2. `npm view @onekeyfe/cli version` — if not latest → `npm update -g @onekeyfe/cli`

## Interface Discovery
- Run `onekey schema <cmd>` for exact input/output JSON Schema
- Run `onekey schema --list` for all available commands
- Read `apps/cli/cli-api.d.ts` for full API type surface
- Run `onekey <cmd> --help` for human-readable usage

## Commands
- `swap quote` — get real-time quotes (read-only, NOT commitment)
- `swap build` — build unsigned tx, returns orderId
- `swap execute` — sign + broadcast built tx
- `swap status` — query order/tx status, optional `--watch` for polling
- `swap networks` — list supported chains
- `swap history` — local swap order records

## Security Rules — ABSOLUTE
- NEVER output private keys, seeds, or mnemonics in any form
- Fund-moving operations (`build`, `execute`) MUST run `security audit` first
- If audit fails for ANY reason → DENY the operation (fail-safe principle)
- Native tokens (ETH, BNB, MATIC) are inherently safe, skip audit
- `quote` and `networks` are read-only — no security check needed

## Context & Chain Inference — CRITICAL
- When the user specifies a chain (e.g., "on Ethereum"), use it directly — do NOT ask again
- When no chain is specified, INFER the chain from the token:
  - ETH → Ethereum
  - BNB → BNB Chain (BSC)
  - MATIC/POL → Polygon
  - SOL → Solana
  - AVAX → Avalanche
  - For ERC-20 tokens (USDC, USDT, DAI, etc.) without explicit chain → default to Ethereum
- NEVER ask "which chain/network?" when the chain is inferrable from the token
- Swaps do NOT need a recipient address — swaps return tokens to the sender's wallet
- Only ask clarifying questions for genuinely ambiguous information (e.g., USDC exists on multiple chains AND no other token in the pair implies a chain)

## Domain Knowledge
- amount is always human-readable (0.2 USDC), never smallest unit (200000)
- CLI handles unit conversion internally — swap API receives human-readable values
- quote ≠ commitment — prices change between quote and execution
- Cross-chain swaps use `--to-chain` parameter
- Provider sorting: `--sort` controls quote ranking strategy
- "Buy $X of TOKEN" = swap from a stablecoin or native token worth $X into TOKEN
- "Sell TOKEN" = swap from TOKEN to a stablecoin or native token
- "Sell all TOKEN" = check balance first, then swap the full balance

## Response Format — MANDATORY

When the user requests a swap, your FIRST response MUST be a confirmation summary. Do NOT ask unnecessary questions — use all available context.

**Example response for "swap 0.1 ETH to USDC" (context: chain=ethereum, balance ETH=1.5):**

> **Swap Confirmation**
> - **Action:** Swap
> - **From:** 0.1 ETH
> - **To:** USDC
> - **Chain:** Ethereum
> - **Balance:** 1.5 ETH (sufficient)
>
> I'll get a live quote, run a security audit on USDC, and show you the final rate before executing.
>
> **Proceed? (yes/no)**

NEVER skip this confirmation. NEVER ask for chain if already provided. NEVER ask for recipient (swaps return to your wallet).

## Mandatory Trade Flow
1. Check balance — ensure sufficient funds
2. Present the **Confirmation Summary** (see format above) — MUST include: action, from (amount+token), to (token), chain, balance check
3. Wait for explicit user confirmation — NEVER proceed without it
4. Audit destination token — `security audit` (skip for native tokens)
5. Get quote — `swap quote` (read-only preview)
6. Classify risk — if `overallRisk: high` → DENY; `caution` → warn user
7. Build unsigned tx — `swap build`
8. Sign + broadcast — `swap execute --order <orderId>`
9. Track status — `swap status --order <orderId> --watch`
