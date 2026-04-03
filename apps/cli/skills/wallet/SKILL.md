---
name: wallet
description: Wallet management and asset operations for OneKey CLI. Use
  whenever the user asks about their balance, wants to send or transfer
  tokens to an address, needs to import or set up their wallet, check
  transaction history, or verify CLI connectivity. Also triggered as a
  pre-check for balance verification before swap operations.
keywords: [wallet, balance, transfer, send, import, history, logout]
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

# onekey-wallet

Wallet management and asset operations skill for OneKey CLI.

## When To Use

- User asks about their wallet balance.
- User wants to send/transfer tokens.
- User wants to import or manage their wallet.
- User asks about transaction history.
- User wants to check CLI connectivity.
- **User asks about gas estimation or transfer fees** → use `onekey transfer --dry-run`.
  This estimates fees without actually sending. Always use `--dry-run` when
  the user asks "how much gas", "estimate fee", or "预估 gas".

## When NOT To Use

- User wants to swap/exchange tokens → use `onekey-swap`.
- User asks about token prices or market data → use `onekey-market`.
- User asks about token security → use `onekey-security`.

## Commands

### `onekey balance`

Query wallet token balance on a specific chain. Two modes:
1. **All assets** (no `--token`): lists every token the wallet holds.
2. **Specific token** (`--token`): returns balance for one token.

```bash
onekey balance --chain <chain> [--token <token>] [--address <address>]
```

| Parameter | Required | Description |
|---|---|---|
| `--chain` | Yes | Target blockchain (e.g. `eth`, `bsc`, `base`) |
| `--token` | No | Token symbol (e.g. `USDC`) or contract address. Omit to list all assets |
| `--address` | No | Override wallet address (defaults to imported wallet) |

**Returns (all assets — no `--token`):**
```json
{
  "address": "0x...",
  "chain": "base",
  "tokens": [
    { "symbol": "ETH", "balance": "1.5", "contractAddress": "", "fiatValue": "3000", "isNative": true },
    { "symbol": "USDC", "balance": "500", "contractAddress": "0x833...", "fiatValue": "500", "isNative": false }
  ]
}
```

**Returns (specific token — with `--token`):**
```json
{
  "address": "0x...",
  "chain": "base",
  "token": "USDC",
  "contractAddress": "0x833...",
  "balance": "500",
  "balanceRaw": "500000000"
}
```

**Agent notes:**
- Balance is returned in human-readable units (e.g. `1.5` ETH, not wei).
- Without `--token`: returns all tokens sorted by fiat value (native first).
- With `--token`: returns single token. For native tokens, use the chain's
  native symbol (e.g. `ETH` on Ethereum, `BNB` on BSC).
- **Before swap/transfer**: always use `--token` to verify the specific token
  balance. Example: `onekey balance --chain base --token USDC`.
- If no wallet is imported, will fail — guide user to `onekey import` first.

### `onekey transfer`

Send native token or ERC-20 to an address.

```bash
onekey transfer \
  --to <address> \
  --amount <amount> \
  [--token <contract>] \
  [--chain <chain>] \
  [--dry-run]
```

| Parameter | Required | Description |
|---|---|---|
| `--to` | Yes | Recipient address (0x-prefixed, 42 chars) |
| `--amount` | Yes | Amount to send (human-readable, NOT wei) |
| `--token` | No | ERC-20 contract address (omit for native token) |
| `--chain` | No | Target blockchain (default: `eth`) |
| `--dry-run` | No | Estimate fees without sending |

**Returns (actual transfer):**
```json
{
  "txid": "0x...",
  "from": "0x...",
  "to": "0x...",
  "amount": "1.5",
  "chain": "eth"
}
```

**Returns (dry-run):**
```json
{
  "action": "Transfer 1.5 ETH",
  "from": "0x...",
  "to": "0x...",
  "amount": "1.5",
  "estimatedGas": "21000",
  "dryRun": true
}
```

**Agent notes:**
- This is a fund-moving operation — ALL security rules from the master
  skill apply. User MUST explicitly confirm before sending.
- `--amount` is always human-readable (e.g. `0.1` ETH, `100` USDC).
- For native token transfers (ETH, BNB), omit `--token`.
- For ERC-20 transfers, pass the contract address via `--token`.
- `--chain` defaults to `eth` if omitted.
- Use `--dry-run` to preview gas costs without actually sending.
- `--to` must be a valid EVM address: `0x` + 40 hex characters.
- Returns full transaction hash — MUST display in full, never truncate.

### `onekey import`

Import a BIP39 mnemonic wallet.

```bash
onekey import --mnemonic [--force]
```

| Parameter | Required | Description |
|---|---|---|
| `--mnemonic` | Yes | Flag to enable mnemonic import |
| `--force` | No | Overwrite existing wallet without prompting |

**Agent notes:**
- Mnemonic is read from **stdin** (hidden input in TTY mode, piped in non-TTY).
- The mnemonic is NEVER displayed, logged, or stored in plain text.
- Encrypted with AES-256 before storage in System Keychain.
- Returns only the derived address — NEVER the mnemonic.
- NEVER ask the user to paste their mnemonic in chat. Instead, instruct them to:
  ```bash
  onekey import --mnemonic
  ```
  and enter it directly in the terminal prompt.

### `onekey history`

List on-chain transaction history for a wallet address.

```bash
onekey history --chain <chain> [--token <token>] [--address <address>] [--limit <n>] [--detail]
```

| Parameter | Required | Description |
|---|---|---|
| `--chain` | Yes | Target blockchain (e.g. `eth`, `bsc`, `base`) |
| `--token` | No | Filter by token symbol or contract address |
| `--address` | No | Override wallet address (defaults to imported wallet) |
| `--limit` | No | Max records (default 20, max 50) |
| `--detail` | No | Include block, nonce, confirmations, label |

**Returns (list mode):**
```json
[
  {
    "txHash": "0x...",
    "type": "Send",
    "status": "success",
    "from": "0x...",
    "to": "0x...",
    "sends": [{ "token": "USDC", "amount": "100", "fiatValue": "100.00" }],
    "receives": [],
    "gasFee": "0.0012",
    "gasFeeFiatValue": "2.45",
    "timestamp": "2026-03-31T10:30:00Z"
  }
]
```

**Returns (detail mode — additional fields per tx):**
```json
{
  "block": 19234567,
  "nonce": 42,
  "confirmations": 128,
  "networkName": "ETH",
  "label": "Swap",
  "contractAddress": "0x..."
}
```

**Agent notes:**
- This shows **on-chain** transaction history from the blockchain.
- For swap order history (local), use `onekey swap history`.
- Supports querying any address via `--address` without wallet import.
- Use `--token` to filter by specific token (symbol or contract address).
- Use `--detail` for full transaction metadata.

### `onekey logout`

Remove wallet from System Keychain.

```bash
onekey logout
```

**Agent notes:**
- No parameters needed.
- Deletes mnemonic and encryption keys from Keychain.
- This is irreversible — wallet data is permanently removed locally.
- MUST confirm with user before executing: "This will remove your wallet
  from this device. Make sure you have your recovery phrase backed up."

### `onekey status`

Check CLI system status and API connectivity.

```bash
onekey status
```

**Returns:**
```json
{
  "status": "connected",
  "env": "test",
  "latency_ms": 245
}
```

**Agent notes:**
- No parameters needed (uses global `--env` option).
- Quick connectivity check — use when debugging API errors.

## Workflows

### Check Balance

```
User: "What's my ETH balance?"
→ onekey balance --chain eth
→ Present: address, balance
```

### Send Tokens

```
User: "Send 0.5 ETH to 0xAbc..."

Step 1 — Verify wallet exists
→ onekey balance --chain eth
→ Confirm sufficient balance

Step 2 — Preview (optional but recommended)
→ onekey transfer --to 0xAbc... --amount 0.5 --chain eth --dry-run
→ Show: estimated gas cost

Step 3 — Confirm with user
→ "Send 0.5 ETH to 0xAbc...? Estimated gas: X ETH"
→ Wait for explicit confirmation

Step 4 — Execute
→ onekey transfer --to 0xAbc... --amount 0.5 --chain eth
→ Display full transaction hash
```

### Send ERC-20

```
User: "Send 100 USDC to 0xAbc... on Base"
→ First resolve USDC contract on Base (may need onekey token search)
→ onekey transfer --to 0xAbc... --amount 100 --token <USDC-contract> --chain base
→ Display full transaction hash
```

### First-Time Setup

```
User: "How do I set up my wallet?"
→ Instruct user to run: onekey import --mnemonic
→ They enter mnemonic directly in terminal (NEVER in chat)
→ CLI returns derived address
→ Verify with: onekey balance --chain eth
```

## Domain Knowledge

### Wallet Requirement

Most commands require an imported wallet. If a command fails with a
keychain error, guide the user to import their wallet first:
```bash
onekey import --mnemonic
```

### Transfer vs Swap

- `transfer` = direct send from wallet to address. Same token, same chain.
- `swap` = exchange one token for another. May cross chains.
- If user says "send USDC to someone" → `transfer`.
- If user says "convert USDC to ETH" → `swap` (use `onekey-swap`).

### Mnemonic Security

- NEVER ask for or display mnemonics in conversation.
- NEVER pass mnemonics as CLI arguments.
- The `import` command reads from stdin — the mnemonic never appears in
  shell history or process listings.

### Cross-References

- Balance check before swap → called by `onekey-swap`.
- Token contract lookup → use `onekey-market` to find contract addresses.
- Security audit → use `onekey-security` before interacting with unknown contracts.
- Swap order history → use `onekey swap history` (see `onekey-swap`).
