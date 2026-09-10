# Zcash test-environment acceptance

Date: 2026-09-03

This is the release checklist for the hidden `zec--0` mainnet preset backed by
`ZEC0`, plus the real-TAZ testnet runtime harness. A green automated check is
evidence for the named layer only; it is not a substitute for a funded App UI
transaction on every platform.

## Identity and data contract

- Network ID: `zec--0`
- Implementation: `zcash`
- Code / shortcode: `zec`
- Backend chain key: `ZEC0`
- Mainnet preset: `isTestnet: false`, `backendIndex: true`, disabled by default
- Backend owns transparent balance, Token metadata/pricing, and transparent
  History.
- Local runtime owns Sapling, Orchard, Ironwood, spendability, and locally
  created transactions. A local History row wins a txid collision.

## Automated evidence

| Layer | Result | Coverage |
| --- | --- | --- |
| Rust unit | Pass | 36 tests; errors, history/pools, storage, timeout helpers, duplicate broadcast |
| Rust live network | Pass | 9 tests; testnet chain/block summary, history UUID, per-block and batch scans |
| Browser runtime | Pass | Two reloads; 44 tables, 17 views, 84 indexes persisted |
| Browser send errors | Pass | 8 assertions; proposal, txid, PCZT, shielding, reservation contracts |
| App Zcash Jest | Pass | 45 assertions; identity, address codec, Token/History composition, pagination, send state, rebroadcast, older detail lookup |
| App TypeScript | Pass | Full `yarn tsc:only` |
| Target lint/format | Pass | Type-aware strict oxlint and oxfmt on changed Zcash/test-harness files |
| Commit profile | Pass | The commit-profile checks completed successfully |

The runtime release WASM and keys WASM were rebuilt after the Rust changes.

## Platform runtime topology

| Target | JS/runtime scope | Storage/resource ownership | Required acceptance |
| --- | --- | --- | --- |
| Desktop | App main/background are single-runtime; Zcash work runs in its carrier Worker | Worker-owned WASM heap; Electron-origin IndexedDB | Token, History, send, restart recovery |
| Web | Single-runtime | Page/Worker-owned WASM heap; page-origin IndexedDB | Smoke and browser persistence |
| Extension MV3 | `main` and `bg` JS heaps are isolated and initialize independently | Offscreen carrier owns WASM and its IndexedDB; callers share no JS objects | Service-worker suspend/restart and pending recovery |
| iOS / Android | `main` and `bg` JS heaps are isolated and initialize independently | Web-embed carrier owns WASM/IndexedDB; no assumption that either JS heap is ready first | Foreground scan, background return, kill/relaunch recovery |

On split-runtime targets, data is not deserialized into both `main` and `bg` as
shared JS state. Calls route to the carrier; readiness and message ordering must
be verified independently. Main and background bundles are version-locked.

## Funded testnet closed loop

Use small real TAZ and wait for full birthday backfill before recording the
starting pool balances.

1. Ironwood -> transparent address.
2. Orchard -> transparent address, if the account has an Orchard balance.
3. Transparent -> private with the Shield action.
4. Transparent -> transparent with transparent spending enabled.
5. Private -> private unified address.
6. For every tx, record the txid and verify one Pending row immediately, the
   same row after restart, then one Confirmed row after mining. There must be no
   duplicate backend/local rows.
7. Verify Sapling remains visible/read-only and is never selected as a spend
   source.

## Crash and ambiguous-broadcast drill

This safely tests the store-before-broadcast design without constructing a
different transaction:

1. Prepare a small testnet transfer and block the configured lightwalletd URL
   immediately before confirming Send.
2. After confirmation, terminate the App while the broadcast call is waiting.
   The runtime has already stored the finalized tx at this point.
3. Restore network access and relaunch. Do not rebuild or resend from the UI.
4. On the next sync/new block, verify the same txid is rebroadcast, remains
   Pending while unmined, and becomes Confirmed once mined.
5. Repeat without terminating the App: a 30-second network timeout must return
   the stored txid as Pending, never Failed.

## Mainnet manual acceptance

Only the wallet owner performs these transactions. Use the smallest practical
amount and capture screenshots plus txids.

1. Confirm the selected network is exactly `zec--0`, symbol `ZEC`, and that the
   transparent Token balance/price agrees with `ZEC0`.
2. Confirm transparent History is present before sending and no private address
   or memo is sent to the backend request.
3. Send transparent -> transparent. Verify Pending immediately and Confirmed
   after mining in both Token balance and History detail.
4. Shield a small transparent amount (transparent -> Ironwood). Verify the
   transparent decrease, private increase, fee, and one merged History row.
5. Withdraw a small Ironwood amount to a transparent address. If Orchard funds
   exist, repeat with the Orchard pool explicitly selected and verify Ironwood
   is not consumed.
6. Restart Desktop during Pending and verify the same txid/status. Repeat on
   Extension MV3 suspend/reopen and on iOS/Android kill/relaunch.
7. After confirmation, refresh Token and History until backend `ZEC0` catches
   up. The local row must keep winning during the overlap, with no duplicate or
   status regression.

## Release blockers

- Funded App UI transactions above are not automated and still require owner
  execution on Desktop, Extension MV3, iOS, and Android.
- `onekey-zcash-runtime` currently has no Git commit, so the Yarn portal build
  is not reproducible from a pinned revision. Create a reviewed commit/tag or
  publish a version before release.
- `agent-device` is not installed on this machine, so no iOS/Android screenshot
  evidence was produced in this pass.
