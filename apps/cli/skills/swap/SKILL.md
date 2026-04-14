---
name: swap
description: Use when handling swaps, bridges, approvals, spot buys, sells, or spot limit orders in OneKey CLI.
version: 0.2.0
---
Before any operation, read `references/common.md` for safety, chain, and scam rules.

# Swap Skill

## Domain Rules
- This skill owns `swap-quote`, `swap-build`, `swap-execute`, `swap-status`, `swap-networks`, and `swap-history`.
- `convert` is a swap alias and preserves the stated source asset, destination asset, amount, and chain.
- Standard spot flow is balance check when needed, internal `security-audit`, quote, confirmation, build, then execute.
- Never merge quote confirmation and execution into the same assistant turn.
- Cross-chain requests must preserve source chain, destination chain, and bridge intent; never silently collapse a bridge into a same-chain swap.
- Exact-amount approvals are preferred; unlimited approvals need a separate warning and should stay separate from the trade.
- Spot limit orders are discovery-first flows that preserve side, size, price, and chain exactly.

## Domain Routing
| Intent | Handling |
|---|---|
| Spot swap, bridge, buy, sell, approval, and spot limit order | Keep in this skill. |
| Other intents (wallet reads, market research, audits) | Defer to Cross-Domain Fallback in `references/common.md`. |

## Fast Patterns
- `swap 1 ETH to USDC` -> quote on the stated or inferred chain, then confirm before build and execute.
- `convert 2 SOL to USDC on Solana` -> confirm it as a Solana swap instead of reopening the route.
- `buy $200 of ARB` -> default the funding asset to `USDC`; if Ethereum context already exists, keep Ethereum instead of auto-switching to Arbitrum.
- `buy $200 of PEPE` with Ethereum context -> keep Ethereum and confirm the buy instead of re-asking the chain.
- `bridge 500 USDC from Ethereum to Base` -> keep both chains explicit and confirm the bridge route.
- `buy 1000 USDC of LINK at 0x5149... on Ethereum` -> confirm the Ethereum trade and keep the audit as an internal next safety step.
- `swap 0.5 BTC to USDC on Ethereum` -> clarify `WBTC` versus native `BTC` before quoting.
- `approve unlimited USDC spending for 0x...69` -> warn that unlimited approval is dangerous and prefer an exact-amount approval.
- `swap 500 USDC to WETH at 0x4E15...` -> stop on the WETH or contract mismatch; do not suggest a replacement route.
- `place a limit buy order for 0.5 ETH at $3000` -> treat it as a spot limit-order intent and confirm side, size, price, and chain.
- `yes, confirm the swap` after a complete swap confirmation -> respond with `Submitted:` using only the already-confirmed fields, not another preview.
