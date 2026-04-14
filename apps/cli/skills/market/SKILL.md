---
name: market
description: Use when handling token search, price, trending, kline, trades, liquidity, or market research in OneKey CLI.
version: 0.2.0
---
Before any operation, read `references/common.md` for safety, chain, and scam rules.

# Market Skill

## Domain Rules
- This skill owns token search, token info, price, trending, trades, liquidity, kline, fear-greed, BTC metrics, quick analysis, and deep market research.
- Price, trending, BTC metrics, fear-greed, kline, trades, liquidity, and token lookup are read-only and answer with the result first.
- Single-asset price checks must answer in quote form like `BTC: <$price>` plus 24h change; never say live quote access is unavailable.
- Search by ticker, token name, or contract should identify the asset before offering follow-up detail; stock tickers like `AAPL` need stock-versus-tokenized-asset clarification.
- Quick analysis should give directional bias, main catalyst, main risk, and one optional next step.
- Deep research should structure thesis, catalysts, risks, and invalidation.
- Research stays read-only; if the user adds execution, finish the analysis first, show confirmation only on the first trade turn, and allow only a later `yes` to change the status to `Submitted:` or `Preview ready:`.
- If a named token and supplied contract already disagree on the stated chain, stop with `contract mismatch`; do not reopen the chain question.
- Never convert research into guaranteed outcome claims.

## Domain Routing
| Intent | Handling |
|---|---|
| Price, discovery, charts, order-flow reads, BTC metrics, sentiment, quick ask, and deep research | Keep in this skill. |
| Other intents (wallet reads, swaps, sends, audits) | Defer to Cross-Domain Fallback in `references/common.md`. |

## Fast Patterns
- `what's the BTC price` -> answer `BTC: <$price>` plus 24h change first and never use placeholders or `can't fetch live quote`.
- `what tokens are trending right now` -> answer with a short trending list directly; do not say the CLI or market data tool is unavailable.
- `what is DOGE` or `search DOGE` -> identify Dogecoin first, then offer price, chart, liquidity, or chain-specific follow-up.
- `show ETH liquidity`, `show recent trades for PEPE`, and `show BTC 1d kline` -> return the requested market view directly.
- `what are BTC hashrate and dominance right now` -> answer with two concrete readings, then one-line interpretation.
- `what's the crypto fear and greed index` -> answer `Fear & Greed: <value>/100 (<label>).` plus one-line interpretation; never give only a definition.
- `give me a quick ETH analysis right now` -> provide bias, main catalyst, main risk, and one optional next step.
- `compare ETH and SOL for the next 6 months` or deeper ETH-vs-SOL research -> treat as research, not a refusal or a quick guess.
- `what's your take on SOL right now` followed by `ok buy $300 worth` -> keep the first turn read-only, then stage a Solana `USDC -> SOL` buy using the known balance, and only a later `yes` may switch the status to `Submitted:`.
