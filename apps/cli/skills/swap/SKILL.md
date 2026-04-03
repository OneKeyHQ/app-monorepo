---
name: swap
description: Token swap and exchange for OneKey CLI — quoting, transaction
  building, signing, and status tracking. Use whenever the user wants to
  swap, trade, exchange, or convert tokens, bridge assets cross-chain,
  check swap quotes or routes, or track a pending swap order. Covers the
  full lifecycle from quote to execution with mandatory security checks.
keywords: [swap, trade, exchange, bridge, cross-chain, quote, dex]
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

## Security Rules — ABSOLUTE

### FORBIDDEN — Private Keys & Secrets

- NEVER output mnemonics, private keys, or seeds to conversation, logs, or any output.
- NEVER pass private keys as CLI arguments (visible in `ps` and shell history).
- NEVER store derived private keys persistently — derive → sign → discard.
- NEVER transmit private keys externally (API, HTTP, webhook, clipboard, chat).
- NEVER expose sensitive tokens (accessToken, apiKey, secretKey, etc.).
- ONLY derived addresses and transaction hashes may appear in output.
- ALWAYS display full transaction hashes — never abbreviate or truncate.

### MANDATORY — Before Any Fund-Moving Operation

1. **Balance check** — verify token + gas sufficiency; abort if insufficient.
2. **Security audit** — run token risk scan; if scan FAILS (network error,
   timeout, etc.) → DENY operation (fail-safe: scan failure ≠ pass).
3. **Show quote details** — display: expected amount, minimum amount, gas cost,
   price impact.
4. **Risk classification**:
   - safe → proceed.
   - warn → show risk details, require explicit user re-confirmation.
   - block → DO NOT proceed, show reason, suggest cancel.
5. **User explicit confirmation** — do NOT sign/send until user says
   "confirm" / "yes" / "execute".
6. **Transaction simulation** — if dry-run fails, DO NOT broadcast.

### Key Lifecycle

- Mnemonic stored in System Keychain (encrypted at rest, auth required to read).
- Private keys derived on-the-fly per signing operation.
- Keys exist only in memory during signing, discarded immediately after.

## Parameter Rules

### `--chain` Resolution

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

# onekey-swap

Token swap skill for OneKey CLI. Covers the complete trading flow from
quote to execution.

## When To Use

- User wants to swap/trade/exchange tokens.
- User wants to bridge assets cross-chain.
- User asks about swap quotes or routing.
- User wants to check a pending swap order status.
- User wants to know which chains support swapping.

**Defaults for vague requests**: If the user says something like "swap some ETH"
without specifying chain, amount, or pair — use these defaults: chain=eth,
check balance first to determine available amount, then proceed. Do NOT ask
clarifying questions; act with reasonable defaults.

## When NOT To Use

- User only wants to check prices/market data → use `onekey-market`.
- User asks about token security/risk → use `onekey-security`.
- User wants a direct transfer (not a swap) → use `onekey-wallet`.

## Operation Types

**Read-only operations** (no wallet/balance needed):
- `onekey swap quote` — get quotes without executing
- `onekey swap networks` — list supported networks
- `onekey swap history` — view past orders

These do NOT require balance checks, security audits, or user confirmation.
Execute them directly.

**Fund-moving operations** (full trade flow required):
- `onekey swap build` + `onekey swap execute` — actual token swap

These MUST follow the Trade Flow below. No steps may be skipped.

## Trade Flow — For Fund-Moving Operations Only

```
1. Balance check   ──→ Insufficient → WARN but continue to step 2
2. Security audit  ──→ Scan fails → deny (fail-safe). ALWAYS run, even if balance is insufficient.
3. Get quote       ──→ Display all quote details to user
4. Risk classify   ──→ block → forbid, warn → re-confirm
5. User confirm    ──→ No confirmation → do nothing
6. Build tx        ──→ Quotes + builds unsigned tx, returns orderId
7. Execute sign    ──→ Sign and broadcast using orderId
8. Track status    ──→ Confirm transaction result
```

**Steps 1-5 must NEVER be skipped** for fund-moving operations. Even if the
user urges "just swap it", all pre-flight checks must be completed.

**Important**: Balance insufficient does NOT skip security audit. The user
needs to know if a token is safe BEFORE deciding to fund their wallet.
If balance is insufficient, warn the user after completing the security
audit and showing the quote.

## Commands

### `onekey swap networks`

List all networks that support swapping.

```bash
onekey swap networks [--bridge]
```

| Parameter | Required | Description |
|---|---|---|
| `--bridge` | No | Show only networks that support cross-chain bridging |

**Agent notes:**
- Use when user asks "which chains can I swap on".
- Also useful to verify whether a user-specified chain supports swapping.

### `onekey swap quote`

Preview swap quotes with real-time SSE streaming. This is a read-only
preview — no transaction is created.

```bash
onekey swap quote \
  --chain <chain> \
  --from <token> \
  --to <token> \
  --amount <amount> \
  [--to-chain <chain>] \
  [--slippage <percent>] \
  [--sort <mode>]
```

| Parameter | Required | Description |
|---|---|---|
| `--chain` | Yes | Source blockchain (e.g. `eth`, `bsc`) |
| `--from` | Yes | Source token: symbol (e.g. `USDC`) or contract address |
| `--to` | Yes | Target token: symbol or contract address |
| `--amount` | Yes | Swap amount (human-readable, NOT wei) |
| `--to-chain` | No | Target chain (required for cross-chain, omit for same-chain) |
| `--slippage` | No | Slippage tolerance percentage (0.05–50) |
| `--sort` | No | Sort mode: `recommended` (default), `gas_fee`, `swap_duration`, `received` |

**Agent notes:**
- Quotes stream via SSE in real-time from multiple providers.
- MUST show all quotes to user, recommend the best one, but let user choose.
- Security audit on the target token is integrated into the quote flow.
- Quotes are time-sensitive — re-fetch if more than ~30 seconds old.
- Cross-chain swaps require `--to-chain`, e.g. `--chain eth --to-chain bsc`.

**Fields that MUST be displayed to the user:**
- Expected output amount (toAmount).
- Minimum output amount (minToAmount, after slippage).
- Estimated time.
- Provider name.
- For cross-chain: estimated arrival time.

### `onekey swap build`

Quote and build an unsigned swap transaction in one step. Returns an
`orderId` for use with `swap execute`.

```bash
onekey swap build \
  --chain <chain> \
  --from <token> \
  --to <token> \
  --amount <amount> \
  [--to-chain <chain>] \
  [--provider <provider>] \
  [--sort <mode>] \
  [--slippage <percent>] \
  [--force]
```

| Parameter | Required | Description |
|---|---|---|
| `--chain` | Yes | Source blockchain |
| `--from` | Yes | Source token: symbol or contract address |
| `--to` | Yes | Target token: symbol or contract address |
| `--amount` | Yes | Swap amount (human-readable, NOT wei) |
| `--to-chain` | No | Target chain for cross-chain bridge |
| `--provider` | No | Specific provider ID (auto-selected if omitted) |
| `--sort` | No | Sort mode: `recommended`, `gas_fee`, `swap_duration`, `received` |
| `--slippage` | No | Slippage tolerance percentage (0.05–50) |
| `--force` | No | Override high-risk token security check |

**Agent notes:**
- This command does its own internal quoting — you do NOT need to pass
  an orderId from `swap quote`. Pass the same token/amount parameters.
- `swap quote` is an optional preview step; `swap build` is the commitment step.
- Automatically runs security audit on the target token. If flagged high-risk,
  the build is rejected unless `--force` is used.
- Returns `orderId` (UUID) needed for `swap execute`.
- The built transaction expires — execute promptly after building.
- Handles ERC-20 approval detection automatically.

### `onekey swap execute`

Execute a pending swap order (sign + broadcast).

```bash
onekey swap execute --chain <chain> --order <orderId> [--approve-unlimited]
```

| Parameter | Required | Description |
|---|---|---|
| `--chain` | Yes | Source blockchain (must match build chain) |
| `--order` | Yes | Order ID from `swap build` output |
| `--approve-unlimited` | No | Approve unlimited token allowance (MAX_UINT256) instead of exact amount |

**Agent notes:**
- This is a fund-moving operation — all pre-flight checks and user
  confirmation MUST be completed before calling.
- Signing happens locally; private keys never leave the local process.
- If ERC-20 approval is needed, it is handled automatically (approve tx
  sent first, then swap tx after confirmation).
- For tokens requiring approval reset (e.g. USDT), three transactions
  are sent: reset → approve → swap.
- Returns transaction hash — MUST display in full, never truncate.
- If execution fails, show error reason. Do NOT auto-retry.

### `onekey swap status`

Query swap transaction status.

```bash
onekey swap status --chain <chain> [--order <orderId>] [--tx <txHash>] [--watch] [--protocol <type>]
```

| Parameter | Required | Description |
|---|---|---|
| `--chain` | Yes | Source blockchain |
| `--order` | No* | Order ID from build output |
| `--tx` | No* | Transaction hash to query |
| `--watch` | No | Poll until final state (bridge: 10s, swap: 3s interval) |
| `--protocol` | No | Protocol type: `swap` or `bridge` (auto-detected from order) |

*At least one of `--order` or `--tx` is required.

**Agent notes:**
- Prefer `--order` over `--tx` — order carries richer context (provider, token info).
- `--watch` is useful for cross-chain bridges that take time to settle.
- Status values: pending, success, failed, canceled.
- Cross-chain transactions may take minutes to confirm — use `--watch` and
  inform user of expected wait time.
- On success, display: actual received amount, transaction hash, gas fee.

### `onekey swap history`

List local swap order history.

```bash
onekey swap history [--chain <chain>] [--limit <n>]
```

| Parameter | Required | Description |
|---|---|---|
| `--chain` | No | Filter by chain |
| `--limit` | No | Max records (default 20, max 100) |

**Agent notes:**
- Shows LOCAL swap order records from `onekey swap build/execute`.
- For on-chain transaction history, use `onekey history` (see `onekey-wallet`).
- If user asks "did my swap complete", check this first, then use
  `onekey swap status` for any pending orders.

## Workflows

### Same-Chain Swap (Standard Flow)

```
User: "Swap 100 USDC to ETH on Ethereum"

Step 1 — Balance check
→ onekey balance --chain eth --token USDC   (verify from-token balance)
→ onekey balance --chain eth --token ETH    (verify gas balance)
→ Verify: USDC balance ≥ 100 AND ETH balance sufficient for gas
→ Insufficient → inform user of shortfall, abort

Step 2 — Security audit
→ onekey security audit --chain eth --address <USDC contract>
→ Audit fails (network error/timeout) → DENY operation (fail-safe)
→ Result is block → forbid execution, show reason
→ Result is warn → show risk details, wait for user re-confirmation

Step 3 — Preview quotes
→ onekey swap quote --chain eth --from USDC --to ETH --amount 100
→ Display to user:
  · All provider quotes with amounts
  · Recommended provider
  · Estimated time
→ Let user review and choose

Step 4 — User confirmation
→ Explicitly ask: "Confirm swap 100 USDC → X.XX ETH via <provider>?"
→ Wait for user to reply "confirm" / "yes" / "execute"
→ No confirmation → do nothing

Step 5 — Build transaction
→ onekey swap build --chain eth --from USDC --to ETH --amount 100 [--provider <chosen>]
→ Returns orderId

Step 6 — Execute signing
→ onekey swap execute --chain eth --order <orderId>
→ Handles approval automatically if needed
→ Display full transaction hash

Step 7 — Track status
→ onekey swap status --chain eth --order <orderId>
→ Display final result
```

### Cross-Chain Swap

```
User: "Swap USDC on Base to USDT on BSC"

Same flow as same-chain swap, with differences:
→ Quote/Build requires --to-chain:
  onekey swap quote --chain base --from USDC --to USDT --amount 100 --to-chain bsc
  onekey swap build --chain base --from USDC --to USDT --amount 100 --to-chain bsc
→ Status tracking — use --watch for cross-chain:
  onekey swap status --chain base --order <orderId> --watch
→ Inform user: cross-chain transactions typically take a few minutes
  up to 10+ minutes
```

### View Order History

```
User: "Did my last swap go through?"
→ onekey history [--chain <chain>] [--limit <n>]
→ Display recent swap records with status
→ If pending orders exist, query latest status:
  onekey swap status --chain <chain> --order <orderId>
```

## Domain Knowledge

### Quote vs Build

- `swap quote` = read-only preview. Shows available routes and prices.
  No transaction is created, no orderId is generated.
- `swap build` = commitment step. Does its own internal quoting, then
  builds the unsigned transaction and returns an `orderId`.
- You can skip `swap quote` and go directly to `swap build`, but showing
  the user a preview first is recommended for transparency.

### Quote Freshness

- Quotes are streamed via SSE in real-time, reflecting current market prices.
- Built transactions expire quickly — execute promptly after building.
- If user takes too long to confirm, re-run `swap build` for fresh data.

### ERC-20 Approvals

- `swap execute` automatically detects if approval is needed and handles it.
- For tokens like USDT that require reset-to-zero before re-approval,
  three transactions are sent: reset (approve to 0) → approve → swap.
- Use `--approve-unlimited` to set MAX_UINT256 allowance (fewer future
  approvals, but larger exposure if router is compromised).

### Slippage & Price Impact

- Slippage: deviation between actual execution price and quoted price.
- Price impact: how this trade moves the liquidity pool price.
- Price impact > 5% → warn the user.
- Price impact > 10% → strongly suggest reducing trade size.
- Default slippage comes from user config; override with `--slippage`.

### Cross-Chain Swaps

- Requires both source chain `--chain` and target chain `--to-chain`.
- Use `onekey swap networks --bridge` to verify cross-chain support.
- Cross-chain is completed via bridge protocols — takes longer than
  same-chain to confirm.
- Cross-chain transactions typically have minimum amount requirements.
- Use `--watch` flag on status for real-time bridge progress tracking.

### Common Error Handling

| Error Scenario | Agent Response |
|---|---|
| Insufficient balance | Show shortfall, suggest depositing or reducing amount |
| Insufficient gas | Show how much native token is needed for gas |
| Quote expired / build expired | Re-run `swap build` — do NOT use stale orderId |
| Approval failed | Check gas balance, suggest retry |
| Execution failed | Show error reason, do NOT auto-retry, suggest user review and retry manually |
| Security audit blocked | Show risk details — MUST NOT bypass and continue |
| High-risk token with --force | Only if user explicitly acknowledges the risk |
| Cross-chain stuck pending | Use `--watch`, inform user of normal wait time |

### Cross-References

- Token analysis before swap → use `onekey-market` to understand the token.
- Security check before swap → use `onekey-security` to audit the token.
- Check balance changes after swap → use `onekey-wallet` to query balance.
