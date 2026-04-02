---
name: market
description: Token discovery, market data, and analysis for OneKey CLI.
  Use whenever the user asks about token prices, market cap, trending tokens,
  kline charts, candlesticks, trading volume, buy/sell activity, liquidity,
  top holders, or wants to research/analyze a token. Also use when the user
  says "what's hot", "what's trending", or asks to look up any token by name,
  symbol, or contract address.
keywords: [token, price, market, kline, trending, trades, liquidity, search]
---

## Pre-flight Checks

Every time before running any `onekey` command, follow these steps in order.
Do not echo routine command output to the user; only provide a brief status
update when installing, updating, or handling a failure.

1. **Check CLI installed**: Run `onekey version`.
   - Not found → install: `npm install -g @onekeyfe/cli`
   - Install failed → STOP, point to manual install docs.

2. **Check version is latest** (once per session):
   - Fetch latest: `npm view @onekeyfe/cli version`
   - Compare with local `onekey version`
   - Local version behind → **BLOCK operation**, run `npm update -g @onekeyfe/cli`
   - Update failed → STOP, suggest manual update.
   - Update succeeded → continue with original command.

3. **Do NOT auto-reinstall on command failures.** Report error and suggest
   `onekey version` or manual reinstall.

## Parameter Rules

### `--chain` Resolution

**MANDATORY:** When `--chain` is NOT specified by the user, you MUST run
`onekey token search --query <symbol>` first to discover which chain(s) the
token exists on, then use the result to fill `--chain`. Do NOT assume `eth`
or any other default chain — the token may only exist on BSC, Base, etc.

`--chain` accepts chain name aliases. The CLI has built-in fuzzy matching
(Levenshtein distance) and alias support.

Common mappings:

| User Input | `--chain` Value |
|---|---|
| ethereum, eth | `eth` |
| bsc, bnb, binance | `bsc` |
| polygon, matic | `polygon` |
| arbitrum, arb | `arbitrum` |
| base | `base` |
| avalanche, avax | `avax` |
| optimism, op | `optimism` |

If no confident match → ask the user, show available chains via
`onekey swap networks`.

### Amount Units

**ALWAYS pass amounts in human-readable units, NEVER in wei/lamports/base units.**
The CLI handles unit conversion internally.

| User says | `--amount` value | Wrong |
|---|---|---|
| "Swap 0.1 ETH" | `0.1` | `100000000000000000` |
| "Swap 100 USDC" | `100` | `100000000` |

### Token Identification

- Native token: use symbol directly (ETH, BNB, MATIC).
- ERC-20: use symbol or contract address.
- If ambiguous (multiple tokens with same symbol) → show candidates, let user choose.

### Address Format

- EVM: `0x`-prefixed, 42 characters, checksummed or lowercase both accepted.

# onekey-market

Token discovery and market analysis skill for OneKey CLI.

## When To Use

- User asks about token prices, market cap, or price changes.
- User wants to search/find a token by name, symbol, or contract address.
- User asks for trending/hot tokens.
- User wants kline/candlestick chart data.
- User asks about trading volume, buy/sell activity.
- User wants to check liquidity or top holders of a token.

## When NOT To Use

- User wants to swap/trade → use `onekey-swap`.
- User asks about token security/risk → use `onekey-security`.
- User asks about wallet balance → use `onekey-wallet`.

## Commands

**IMPORTANT: This skill covers TWO CLI command groups:**
- `onekey token <subcommand>` — token discovery and analysis
- `onekey market <subcommand>` — market price data and klines

Do NOT confuse them. `trending` is under `token`, not `market`.

### Token Discovery (`onekey token`)

#### `onekey token search`

Search tokens by keyword (symbol, name, or contract address).

```bash
onekey token search --query <keyword> [--chain <chain>] [--limit <n>]
```

| Parameter | Required | Description |
|---|---|---|
| `--query` | Yes | Search keyword: symbol, name, or contract address |
| `--chain` | No | Filter by chain (e.g. `eth`, `bsc`, `base`) |
| `--limit` | No | Max results, default 10 |

**Agent notes:**
- If user provides a contract address, pass it directly as `--query`.
- If multiple results match, show top candidates and let user choose.
- Result includes: symbol, name, chain, contract address, price, market cap.

#### `onekey token trending`

List trending tokens across chains.

```bash
onekey token trending [--chain <chain>] [--limit <n>]
```

**Agent notes:**
- Returns ranked list with price change percentages.
- Good starting point when user asks "what's hot" or "what's trending".

### Token Analysis (`onekey token`)

All token analysis commands use `--chain` + `--token` (not a token ID).
The `--token` parameter accepts either a symbol (e.g. `USDC`) or a contract address.

#### `onekey token info`

Get detailed metadata for a specific token.

```bash
onekey token info --chain <chain> --token <token>
```

| Parameter | Required | Description |
|---|---|---|
| `--chain` | Yes | Target blockchain (e.g. `eth`, `base`) |
| `--token` | Yes | Token contract address or symbol |

**Returns:** symbol, name, contract address, networkId, decimals, price,
market cap, FDV, TVL, liquidity, holders, circulating supply,
price changes (1h/4h/24h), social links, swap support status.

#### `onekey token price`

Get current price and price change data.

```bash
onekey token price --chain <chain> --token <token>
```

| Parameter | Required | Description |
|---|---|---|
| `--chain` | Yes | Target blockchain |
| `--token` | Yes | Token contract address or symbol |

**Returns:** current price (USD), 1m/5m/1h/4h/24h price change percentages.

#### `onekey token trades`

Get trading activity statistics across multiple timeframes.

```bash
onekey token trades --chain <chain> --token <token>
```

| Parameter | Required | Description |
|---|---|---|
| `--chain` | Yes | Target blockchain |
| `--token` | Yes | Token contract address or symbol |

**Returns:** buy/sell counts, buy/sell volume (USD), unique traders —
broken down by 1m, 5m, 1h, 4h, 24h timeframes.

**Agent notes:**
- High buy/sell ratio with increasing volume → bullish signal.
- Declining trader count with stable volume → possible whale accumulation.
- Present as a summary table, highlight notable patterns.

#### `onekey token liquidity`

Get top token holders and liquidity distribution.

```bash
onekey token liquidity --chain <chain> --token <token>
```

| Parameter | Required | Description |
|---|---|---|
| `--chain` | Yes | Target blockchain |
| `--token` | Yes | Token contract address or symbol |

**Returns:** top holders with address, amount, fiat value, percentage.

**Agent notes:**
- Top 10 holders > 50% → high concentration risk, warn user.
- Low liquidity relative to market cap → high slippage risk for large trades.

### Market Data (`onekey market`)

#### `onekey market price`

Get real-time price for a single token by chain and contract.

```bash
onekey market price --chain <chain> --token <token>
```

| Parameter | Required | Description |
|---|---|---|
| `--chain` | Yes | Target blockchain (e.g. `eth`, `bsc`) |
| `--token` | Yes | Token contract address or symbol |

**Agent notes:**
- Faster than `token price` when you already know chain + token.
- Returns: symbol, contract address, networkId, price, price change percentages.

#### `onekey market prices`

Batch price query for multiple tokens across chains.

```bash
onekey market prices --tokens <chain:address,chain:address,...>
```

| Parameter | Required | Description |
|---|---|---|
| `--tokens` | Yes | Comma-separated `chain:address` pairs |

**Format:** `eth:0xa0b8...,base:0x8335...,eth:native`

**Agent notes:**
- Use `native` as address for native tokens (e.g. `eth:native`).
- Can query tokens across different chains in one call.
- More efficient than multiple `market price` calls.

**Example:**
```bash
onekey market prices --tokens "eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48,base:native"
```

#### `onekey market kline`

Get OHLCV candlestick data for a token.

```bash
onekey market kline --chain <chain> --token <token> [--interval <interval>] [--limit <n>]
```

| Parameter | Required | Description |
|---|---|---|
| `--chain` | Yes | Target blockchain |
| `--token` | Yes | Token contract address or symbol |
| `--interval` | No | Kline interval (default `1H`). Valid: `1m`, `5m`, `15m`, `30m`, `1H`, `4H`, `1D`, `1W` |
| `--limit` | No | Number of data points (default 24, max 500) |

**Agent notes:**
- Interval is case-sensitive: minutes lowercase (`1m`, `5m`), hours/days/weeks uppercase (`1H`, `4H`, `1D`, `1W`).
- Default to `1H` for intraday, `1D` for multi-day analysis.
- Present as summary (open, high, low, close, volume) not raw data.
- Identify key patterns: support/resistance levels, volume spikes.

## Workflows

### Quick Price Check

Fastest path when user just wants a price.

```
User: "What's the price of PEPE on Ethereum?"
→ onekey token price --chain eth --token PEPE
→ Present: price, 24h change
```

If chain is unknown:
```
User: "What's the price of PEPE?"
→ onekey token search --query PEPE
→ Identify which chain(s) PEPE exists on
→ onekey token price --chain <chain> --token PEPE
→ Present: price, price changes
```

### Token Research (Due Diligence)

Full analysis before user makes a trading decision.

```
User: "Tell me about this token: 0x1234... on Base"
→ onekey token info --chain base --token 0x1234...     (metadata)
→ onekey token price --chain base --token 0x1234...    (price & changes)
→ onekey token trades --chain base --token 0x1234...   (trading activity)
→ onekey token liquidity --chain base --token 0x1234...  (holder distribution)
→ onekey security audit --chain base --address 0x1234...  (risk scan)
→ Present: comprehensive summary with risk assessment
```

**Agent behavior:** Run all data queries, then present a structured report:
1. **Overview** — name, chain, contract, holders, social links.
2. **Price** — current price, trend (1h/24h), market cap, FDV.
3. **Activity** — buy/sell ratio, volume trend, trader count.
4. **Liquidity** — top holder concentration, pool depth.
5. **Risk** — security audit result (safe/warn/block).
6. **Verdict** — brief assessment based on data.

### Market Overview

When user wants a broad market snapshot.

```
User: "What's trending today?"
→ onekey token trending
→ For top 3-5 tokens, optionally fetch price details
→ Present: ranked list with key metrics
```

## Domain Knowledge

### Token Identification Pattern

All `token` subcommands use `--chain <chain> --token <token>`:
- `--token` accepts symbol (`USDC`) or contract address (`0xa0b8...`).
- If symbol is ambiguous (multiple chains), the CLI uses the token resolver
  to find the best match. Prefer contract address for precision.

### `market prices` Format

Unlike other commands, `market prices` does NOT take `--chain` separately.
Chain is embedded in the `--tokens` format: `chain:address`.

### Kline Intervals

Minutes/seconds use lowercase, hours/days/weeks use uppercase:
- Lowercase: `1m`, `5m`, `15m`, `30m`
- Uppercase: `1H`, `4H`, `1D`, `1W`

### Price Data Freshness

- `market price` / `market prices` → real-time (API live).
- `token price` → near real-time, includes richer metadata.
- `market kline` → historical, slight delay.

### Cross-References

- Before recommending a token → run `onekey security audit` (see `onekey-security`).
- If user wants to trade after research → hand off to `onekey-swap`.
- If user asks about wallet holdings → hand off to `onekey-wallet`.
