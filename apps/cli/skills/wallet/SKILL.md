# Wallet Skill

## Pre-flight
1. `onekey version` — if not installed → `npm i -g @onekeyfe/cli`
2. `npm view @onekeyfe/cli version` — if not latest → `npm update -g @onekeyfe/cli`

## Interface Discovery
- Run `onekey schema <cmd>` for exact input/output JSON Schema
- Run `onekey schema --list` for all available commands
- Read `apps/cli/cli-api.d.ts` for full API type surface
- Run `onekey <cmd> --help` for human-readable usage

## Commands
- `balance` — query all assets (no `--token`) or specific token (with `--token`)
- `transfer` — send native or ERC-20 tokens
- `import` — import wallet from mnemonic (MUST read from stdin, NEVER as argument)
- `history` — on-chain transaction history
- `logout` — remove wallet from system keychain
- `status` — check API connectivity

## Security Rules — ABSOLUTE
- NEVER output private keys, seeds, or mnemonics in any form
- Mnemonic import MUST use stdin pipe, NEVER pass as CLI argument
- Transfer MUST run `security audit` on destination token first (skip for native tokens)
- Use `--dry-run` to preview gas before committing transfer

## Domain Knowledge
- amount is always human-readable (1.5 ETH), never smallest unit (wei/sat)
- CLI converts to smallest unit internally for transaction encoding
- Chain identifiers: use aliases (eth, bsc, polygon), not networkId
- Token identification: contract address or symbol, CLI resolves automatically
- balance without `--token` returns all non-zero assets with fiat values
- balance with `--token` returns single token with raw balance

## Transfer Workflow
1. Check balance — ensure sufficient funds + gas
2. Audit destination token — `security audit` (skip for native tokens)
3. Dry run — `transfer --dry-run` to preview gas cost
4. Confirm with user — show amount, recipient, estimated gas
5. Execute — `transfer` (without `--dry-run`)
6. Report txid to user
