---
name: onekey-wallet
description: OneKey Wallet for on-chain operations — token discovery,
  market analysis, swap execution, security auditing, and portfolio management.
version: 1.0.0
keywords: [onekey, wallet, swap, market, token, defi, crypto]
---

# OneKey Wallet

## Pre-flight Checks

Every time before running any `onekey` command, follow these steps in order.
Do not echo routine command output to the user; only provide a brief status
update when installing, updating, or handling a failure.

1. **Check CLI installed**: Run `onekey version`.
   - Not found → install: `npm install -g @onekeyhq/cli`
   - Install failed → STOP, point to manual install docs.

2. **Check version is latest** (once per session):
   - Fetch latest: `npm view @onekeyhq/cli version`
   - Compare with local `onekey version`
   - Local version behind → **BLOCK operation**, run `npm update -g @onekeyhq/cli`
   - Update failed → STOP, suggest manual update.
   - Update succeeded → continue with original command.

3. **Skill version drift** (once per session):
   - CLI version > skill `metadata.version` → display one-time notice that
     skill may be outdated and suggest the user re-install skills via their
     platform's method. Do not block.

4. **Do NOT auto-reinstall on command failures.** Report error and suggest
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

## Skill Routing

| User Intent | Route To |
|---|---|
| Token search / price / trending / kline / trades / liquidity | `onekey-market` |
| Swap / trade / exchange / bridge / cross-chain | `onekey-swap` |
| Token security audit / risk scan / transaction simulation | `onekey-security` |
| Balance / transfer / wallet import / history | `onekey-wallet` |

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
