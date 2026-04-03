---
name: security
description: Token security auditing and transaction simulation for OneKey
  CLI. Use whenever the user asks if a token is safe, wants to check for
  honeypots, rug pulls, scam tokens, or suspicious contracts, or wants to
  simulate a transaction before signing. Also triggered as a mandatory
  pre-check before any swap or trade operation.
keywords: [security, audit, risk, honeypot, simulate, transaction, safety]
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

# onekey-security

Security auditing and risk assessment skill for OneKey CLI.

## When To Use

- User asks if a token is safe or risky.
- User wants to check a token contract for honeypot, rug pull, or scam indicators.
- User wants to simulate a transaction before signing.
- Before any swap — `onekey-swap` references this skill for mandatory pre-trade checks.
- Before recommending a token — `onekey-market` references this skill for due diligence.

## When NOT To Use

- User wants to check token price or market data → use `onekey-market`.
- User wants to swap/trade → use `onekey-swap` (which calls security internally).
- User asks about wallet balance → use `onekey-wallet`.

## Commands

### `onekey security audit`

Run a security audit on a token contract. Returns risk classification
and detailed findings.

```bash
onekey security audit --chain <chain> --token <token>
```

| Parameter | Required | Description |
|---|---|---|
| `--chain` | Yes | Target blockchain (e.g. `eth`, `base`, `bsc`) |
| `--token` | Yes | Token contract address or symbol |

**Returns:**
```json
{
  "symbol": "TOKEN",
  "contractAddress": "0x...",
  "networkId": "evm--1",
  "overallRisk": "high | caution | low",
  "riskItems": ["is_honeypot", "cannot_sell_all"],
  "cautionItems": ["owner_change_balance"],
  "checks": { ... }
}
```

**Risk classification logic:**
- `high` — honeypot detected, cannot buy/sell, or other critical flags.
- `caution` — some suspicious indicators but not definitively malicious.
- `low` — no risk flags found.

**Agent notes:**
- Native tokens (ETH, BNB) cannot be audited — they are inherently safe.
  Only audit ERC-20 contracts.
- `overallRisk` is the field to act on:
  - `low` → safe to proceed.
  - `caution` → show findings to user, ask for confirmation before proceeding.
  - `high` → DO NOT proceed with swap/trade. Show risk items and recommend cancellation.
- Key risk indicators in `checks`:
  - `is_honeypot` — token cannot be sold after purchase. **BLOCK.**
  - `cannot_buy` / `cannot_sell_all` — trading restrictions. **BLOCK.**
  - `owner_change_balance` — owner can modify balances. **WARN** (downgraded if on trust list).
- If the audit API call fails (network error, timeout), treat as **DENY** per fail-safe principle.

### `onekey security simulate`

Simulate a transaction to preview its effects before signing.

```bash
onekey security simulate \
  --chain <chain> \
  --to <address> \
  --data <hex> \
  [--value <amount>] \
  [--from <address>]
```

| Parameter | Required | Description |
|---|---|---|
| `--chain` | Yes | Target blockchain |
| `--to` | Yes | Target contract address (0x-prefixed, 42 chars) |
| `--data` | Yes | Transaction calldata (hex, 0x-prefixed, even length) |
| `--value` | No | ETH/native value to send (human-readable, e.g. `0.1`) |
| `--from` | No | Sender address (defaults to zero address for read-only simulation) |

**Returns:**
```json
{
  "type": "swap | transfer | approve | ...",
  "display": { ... },
  "parsedTx": { ... },
  "accountAddress": "0x...",
  "isConfirmationRequired": true
}
```

**Agent notes:**
- Use this to preview what a transaction will do BEFORE signing.
- `--to` must be a valid EVM address: `0x` + 40 hex characters.
- `--data` must be valid hex calldata: `0x` + even number of hex characters.
- `--value` is in human-readable units (ether, not wei). The CLI converts internally.
- If `--from` is omitted, uses a zero address — suitable for read-only simulation.
- If `isConfirmationRequired` is true, additional user review is needed.

## Workflows

### Token Safety Check

```
User: "Is this token safe? 0x1234... on BSC"
→ onekey security audit --chain bsc --token 0x1234...
→ Present risk classification and findings
→ If high risk: strongly advise against trading
→ If caution: list concerns, let user decide
→ If low: safe to proceed
```

### Pre-Swap Security (called by onekey-swap)

```
Before any swap operation:
→ onekey security audit --chain <chain> --token <target-token>
→ If audit fails (API error/timeout) → DENY operation (fail-safe)
→ If overallRisk is "high" → BLOCK the swap
→ If overallRisk is "caution" → show findings, require user re-confirmation
→ If overallRisk is "low" → proceed
```

### Transaction Preview

```
User: "What will this transaction do?"
→ onekey security simulate --chain eth --to 0xRouter... --data 0xabcdef...
→ Present parsed transaction details
→ If type is unexpected (e.g. user thought it was a swap but it's an approve) → warn
```

## Domain Knowledge

### Risk Classification Levels

| Level | Meaning | Agent Action |
|---|---|---|
| `low` | No risk flags | Safe to proceed |
| `caution` | Suspicious indicators | Show details, ask user to confirm |
| `high` | Critical risk (honeypot, cannot sell) | DO NOT proceed, recommend cancel |

### Fail-Safe Principle

If a security scan fails for ANY reason (network error, API timeout, rate limit,
malformed response), the agent MUST:
- NOT proceed with the associated transaction.
- Report the error to the user.
- Suggest retrying the scan.

A security scan that fails to complete is NOT a "pass". Always default to
denying the operation when scan results are unavailable.

### Native Tokens Are Safe

ETH, BNB, MATIC, and other native chain tokens do not have contracts and
cannot be audited. They are inherently safe — skip the audit for native tokens.

### Cross-References

- Swap pre-trade check → called by `onekey-swap` before every trade.
- Token research → called by `onekey-market` during due diligence workflow.
- Balance check → use `onekey-wallet` to verify funds before acting on audit results.
