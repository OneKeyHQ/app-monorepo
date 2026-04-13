# Market & Token Discovery Skill

## Scope & Routing

**This skill handles**: token prices, market data, trending tokens, token search/info, kline charts, trade activity, liquidity analysis, token comparisons, market research.

**NOT in scope** — route to the correct skill:
| Intent | Route to |
|--------|----------|
| Swap, trade, exchange, convert, buy, sell tokens | **Swap skill** |
| Balance check, transfer, send, deposit, withdraw, wallet import | **Wallet skill** |
| Token audit, risk check, transaction simulation | **Security skill** |

**When routing to another skill**, extract all parameters from the user's request and present a summary with confirmation. Example for a swap intent:

> This is a **swap** operation — handled by the **Swap skill**.
>
> **Swap Details:**
> - **Action:** Swap
> - **From:** 0.1 ETH
> - **To:** USDC
> - **Chain:** Ethereum (from context)
>
> The Swap skill will run a security audit, get a live quote, and confirm with you before executing. No funds will move without your explicit approval.
>
> **Shall I route you to the Swap skill? (yes/no)**

## Context & Chain Inference — CRITICAL
- When the user specifies a chain, use it directly
- When no chain is specified, INFER the chain from the token:
  - ETH → Ethereum, BNB → BSC, SOL → Solana, MATIC/POL → Polygon, AVAX → Avalanche
  - ERC-20 tokens (USDC, USDT, DAI) without explicit chain → default to Ethereum
- ALWAYS include the inferred chain in your response — never say "chain not specified" when it can be inferred

## Pre-flight
1. `onekey version` — if not installed → `npm i -g @onekeyfe/cli`
2. `npm view @onekeyfe/cli version` — if not latest → `npm update -g @onekeyfe/cli`

## Interface Discovery
- Run `onekey schema <cmd>` for exact input/output JSON Schema
- Run `onekey schema --list` for all available commands
- Read `apps/cli/cli-api.d.ts` for full API type surface
- Run `onekey <cmd> --help` for human-readable usage

## Commands
- `token search` — search by keyword, symbol, or address
- `token info` — detailed metadata and market data
- `token price` — price with multi-timeframe changes
- `token trending` — top trending tokens
- `token trades` — buy/sell activity and volume
- `token liquidity` — top holders and distribution
- `market price` — single token price
- `market prices` — batch pricing (chain:address pairs)
- `market kline` — candlestick OHLCV data

## Domain Knowledge
- Kline intervals: lowercase = minutes (1m, 5m, 15m, 30m), uppercase = hours/days (1H, 4H, 1D, 1W)
- Token identification: pass contract address or symbol, CLI resolves via search
- Chain identifiers: use aliases (eth, bsc, polygon, sol), not networkId (evm--1)
- Price data freshness: on-chain DEX data may lag CEX prices
- `market prices` uses `chain:address` format for batch queries

## Workflow: Token Research (Due Diligence)
1. `token search` — find the token
2. `token info` — check fundamentals (holders, liquidity, supply)
3. `security audit` — risk assessment (cross-ref security skill)
4. `token price` — current pricing and momentum
5. `token trades` — buy/sell activity patterns
6. `token liquidity` — concentration risk from top holders
