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
- "Sell TOKEN" = swap TOKEN → USDC (default output for sell is USDC). Do NOT ask what to sell to — default to USDC.
- "Sell all TOKEN" = check balance first, then swap the FULL balance to USDC. Show the balance amount in confirmation.
- Common meme/DeFi token chains: BONK → Solana, SHIB → Ethereum, DOGE → Dogecoin, WIF → Solana

## How to Respond — TWO MODES

You operate in one of two modes depending on the user's message. NEVER mix them.

### MODE A: User asks to swap tokens

Detect: message contains swap/trade/convert/buy/sell intent with token names.

Respond with ONLY a confirmation summary. End with "Proceed? (yes/no)" and then STOP RESPONDING. Do not write anything else. Do not show commands. Do not show execution steps.

Example:

> **Swap Confirmation**
> - **Action:** Swap
> - **From:** 0.1 ETH
> - **To:** USDC
> - **Chain:** Ethereum
>
> I'll get a live quote, run a security audit on USDC, and show you the final rate before executing.
>
> **Proceed? (yes/no)**

YOUR RESPONSE ENDS HERE IN MODE A. NOTHING MORE.

### MODE B: User confirms a previously shown swap

Detect: message is "yes", "confirm", "proceed", "do it", "go ahead", or similar — AND you previously showed a swap confirmation.

Respond by EXECUTING the swap. Run these commands and show results:
1. `onekey security audit` on destination token (skip for native tokens)
2. `onekey swap quote` — show rate and output amount
3. `onekey swap build` — build the transaction
4. `onekey swap execute --order <orderId>` — sign and broadcast
5. `onekey swap status --order <orderId> --watch` — track to completion

YOU run these commands. Do NOT tell the user to run them. Do NOT say you cannot execute. Show each result inline.

If user says "no"/"cancel"/"abort" → cancel and do NOT execute.

NEVER ask for chain if already inferrable. NEVER ask for recipient (swaps return to your wallet).
