# Home Token List Refresh And Cache Verification

Date: 2026-07-04
Branch: `codex/home-token-cache-refresh`

## Runtime Ownership

Production native uses two JS runtimes in one native process:

- `main`: Home UI, `TokenListBlock`, `TokenListView`, `useAllNetworkRequests`, account overview atoms, token-list cells receive shell.
- `bg`: `ServiceAllNetwork`, `ServiceToken`, `ServiceTokenViewModel`, SimpleDB/local DB service access, token frame production.
- Shared native resources: native storage/DB/MMKV/file handles/native-logger are process-level resources. A token cache written by `bg` can be read later by `main`, but the JS objects are deserialized separately.
- Per-runtime JS heap copies: token arrays, fiat maps, LWW views, and `ServiceTokenViewModel` frames are not shared between `main` and `bg`. If `main` reads a local cache, it must explicitly feed the bg ViewModel with `ingestRound` before `TokenListView` can reuse that cache without owner-mismatch skeleton.
- Timing/order: `main` and `bg` initialize independently. Do not assume Home UI has already subscribed to bg frames when cache is read; bg `getTokenListFrames` pull must also work.

## Refresh Entrances

| Entrance                                               | Runtime        | Trigger                                                                                                        | Current behavior before this fix                                                                                                                                                                       | Expected behavior                                                                                                                                         |
| ------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home token tab mount / account change / network change | `main`         | `initTokenListData` effect dependencies: account, network, wallet, merge-derive state                          | Single-network local cache updated worth only; token cells kept previous all-networks owner until live fetch, causing skeleton. All-networks starts fan-out and may show cache only after cache probe. | If local cache exists, paint cached rows immediately and refresh in background. No token-list skeleton or balance skeleton for cached owner.              |
| Single-network live refresh                            | `main` -> `bg` | `usePromiseResult(run)`, polling, focus revalidation, manual header refresh, visibility active, refresh events | Live result feeds `ServiceTokenViewModel.ingestRound`; rows update after network fetch.                                                                                                                | Keep cached rows while fetching; changed rows update through token cells only.                                                                            |
| All-networks initial run                               | `main` -> `bg` | `useAllNetworkRequests` first run when All Networks is selected                                                | Probes per-network local cache. If cache exists, seeds LWW floor and paints merged snapshot. If no cache, progressive live settles paint partial list.                                                 | Same, but logs must show account fan-out counts, cache count, progressive settle count, and authoritative commit count.                                   |
| All-networks warm auto/manual refresh                  | `main` -> `bg` | Header pull-to-refresh, auto polling/focus revalidation, visibility active                                     | After authoritative commit, LWW view was cleared. Next warm refresh progressive paint started from an empty floor, so the full list shrank to only settled networks and grew row by row.               | Retain last authoritative per-network rounds as SWR floor. Refresh keeps full cached list visible and only overwrites networks whose live result settled. |
| All-networks enabled-network changes                   | `main`         | `EnabledNetworksChanged` event                                                                                 | Clears account-list base cache and reruns.                                                                                                                                                             | Removed/disabled networks are evicted by enabled-key intersection; still-enabled unsettled networks keep floor.                                           |
| Hardware/default account batch creation                | `main`         | `AddDBAccountsToWallet` event                                                                                  | Account-list cache can capture a half-formed wallet and show only the first one or two networks if not invalidated.                                                                                    | Invalidate this wallet's account-list cache and rerun with `skipAccountsCache` without clearing visible rows between batches.                             |
| Account add/delete                                     | `main`         | `AddDBAccountsToWallet`, account selector changes, account data updates                                        | Add may reuse stale all-network account cache; delete may leave removed networks until next authoritative set.                                                                                         | Add bypasses account cache and fetches all new accounts. Delete updates enabled/account set and evicts missing keys without wiping remaining cached rows. |
| Account switch                                         | `main`         | active account changes, Test Wallet Account #1/#2 switch                                                       | Existing owner guards prevent stale late writes, but single-network disk cache was not fed to cells.                                                                                                   | Cached owner paints via bg VM pull/ingest. Late previous-owner responses are dropped.                                                                     |
| Transaction history changes                            | `main` -> `bg` | `fetchAccountHistory` polling returns `accountsWithChangedTxs`                                                 | Refreshes only changed all-network account/network pairs.                                                                                                                                              | Only affected network rows and account worth update; full list remains visible.                                                                           |
| External refresh event                                 | `main`         | `RefreshTokenList`, `AccountDataUpdate`, `NetworkDeriveTypeChanged`                                            | All-networks can refresh all or specific accounts; single network can use explicit target if tab closures are stale.                                                                                   | Provided account/network refresh must not use stale closures and must not clear unrelated rows.                                                           |
| LP/DeFi-token display switch                           | `main` -> `bg` | `homeShowLpTokensOnly` toggle                                                                                  | LP scoped list owns its loading state and can show its own skeleton.                                                                                                                                   | Wallet-token cache and account worth still hydrate in background; LP mode does not regress wallet-token cache.                                            |
| Balance amount updates                                 | `main`         | `updateAccountWorth`, `updateAccountOverviewState`, cache/live all-network snapshot                            | `initialized=false/isRefreshing=true` can show balance skeleton during uncached init.                                                                                                                  | Cached worth updates immediately from local cache; live refresh merges precise per-network worth without global skeleton.                                 |

## Logging

Local native logs use:

- `account => allNetworkAccountPerf => homeTokenListRefreshTrace`
- `account => allNetworkAccountPerf => getAllNetworkAccountsStart`
- `account => allNetworkAccountPerf => getAllNetworkAccountsEnd`

Important phases:

- `single-network-local-cache-read`
- `single-network-cache-ingest`
- `all-network-hook-run-start`
- `all-network-accounts-resolved`
- `all-network-cache-probe`
- `all-network-run-started`
- `all-network-cache-hydrate`
- `all-network-fetch-settled`
- `all-network-progressive-settled`
- `all-network-authoritative-commit`
- `all-network-hook-run-finished`
- `all-network-manual-refresh`

The log payload intentionally avoids addresses, xpubs, walletId, and full accountId. It records runtime, phase, networkId, cache hit, counts, owner presence, and request kind.

## Code Changes Under Test

- Single-network local cache now builds an ingest payload with `buildHomeTokenListCacheIngestRound` and feeds `serviceTokenViewModel.ingestRound` before marking token state initialized.
- Cached empty single-network owners also emit an empty owner-stamp frame, so the empty state renders instead of previous-owner skeleton.
- All-networks authoritative commit no longer clears the LWW view. The retained per-network rounds become the next refresh's SWR floor.
- The native performance monitor uses the new `showPerformanceMonitorV2` dev-setting key and defaults to off. Legacy `showPerformanceMonitor` values are intentionally ignored so old QA/dev settings do not auto-open the overlay.
- Added focused tests for single-network cache ingest and all-network warm-refresh floor retention.

## Verification Matrix

Use iOS release build/install:

```bash
development/scripts/ios-release-build-deploy.sh xcode
development/scripts/ios-release-build-deploy.sh deploy
```

Use the Test Wallet shown in the screenshot:

1. Test Wallet -> Account #1 -> All Networks.
2. Wait for the first full token list and total balance.
3. Pull-to-refresh All Networks.
4. Confirm the list remains visible; logs show `all-network-manual-refresh`, progressive settles, then `all-network-authoritative-commit`.
5. Switch All Networks -> one funded single network.
6. Confirm cached token rows show immediately; logs show `single-network-local-cache-read` with `hasCache:true`, then `single-network-cache-ingest`.
7. Switch back to All Networks.
8. Switch Account #1 -> Account #2 and repeat All Networks + single-network cache checks.
9. Add an account under Test Wallet, stay on All Networks, confirm new network/account fan-out does not shrink the existing list.
10. Delete/remove the added account, confirm removed account data disappears without clearing unaffected token rows.
11. Trigger a transaction-history refresh path if possible, then confirm only changed network rows update.

Pass criteria:

- Cached owner never shows token-list skeleton.
- Cached balance amount never returns to global skeleton during refresh.
- All-networks refresh keeps the full cached list visible and updates by network/row.
- Account switch/add/delete does not reuse stale previous-owner data.
- Native logs contain the phase sequence needed to explain each refresh.

## Simulator Verification On 2026-07-04

Environment:

- Simulator: iPhone 17 Pro, iOS 26.5, UDID `4837E819-A117-4E08-9936-445785D199E3`.
- Build/deploy: `development/scripts/ios-release-build-deploy.sh all`, with `ENABLE_NATIVE_BACKGROUND_THREAD=true`, `UNION_BUILD=true`, `SPLIT_BUNDLE=1`, and split-bundle integrity check passing for both main and bg bundles. Deploy preserved app data and launched `so.onekey.wallet`.

Completed checks:

- Test Wallet opened on Home with All Networks selected and cached rows visible immediately. The old persisted performance-monitor setting did not show the native overlay with the new `showPerformanceMonitorV2` default-off key. Screenshot: `.tmp/home-token-verify/no-perf-overlay.png`.
- App relaunch on All Networks kept cached balance and token rows visible during automatic refresh. Screenshots:
  - `.tmp/home-token-verify/home-after-relaunch.png`
  - `.tmp/home-token-verify/all-network-after-single.png`
- Manual All Networks pull-to-refresh kept the token list visible. `USDC`, `BTC`, `USDT`, `JupSOL`, and following cached rows stayed on screen during refresh instead of a full-list skeleton. Screenshots:
  - `.tmp/home-token-verify/all-network-refresh-immediate.png`
  - `.tmp/home-token-verify/all-network-refresh-after.png`
  - `.tmp/home-token-verify/all-network-refresh-point-immediate.png`
  - `.tmp/home-token-verify/all-network-refresh-point-after.png`
- All Networks -> Solana single-network switch reused cache immediately. `JupSOL`, `JupUSD`, and `USDC` rows painted without a token-list skeleton. Screenshot: `.tmp/home-token-verify/single-solana-immediate.png`.
- Account switch Account #2 -> Account #1 kept cached rows visible and then refreshed Account #1 data. Screenshot: `.tmp/home-token-verify/account1-switch-immediate.png`.
- Added Account #3 under Test Wallet. Because Account #3 had no cached token rows, the new-account path showed an empty/loading state, which is acceptable for a cache miss. Screenshot: `.tmp/home-token-verify/account3-after-add-close.png`.
- Removed only the newly added Account #3. The account selector returned to Account #1 and Account #2 only, then switching back to Account #2 hit all-network cache hydrate and painted cached rows. Screenshots:
  - `.tmp/home-token-verify/account3-remove-confirm.png`
  - `.tmp/home-token-verify/account3-removed.png`
  - `.tmp/home-token-verify/account2-restored-final.png`
- Multi-chain/single-chain back-and-forth switching was verified after the QA gap review:
  - Sequence: All Networks -> Solana -> All Networks -> Polygon -> All Networks -> Bitcoin -> All Networks.
  - Screenshots:
    - `.tmp/home-token-verify/switch-loop-1-solana.png`
    - `.tmp/home-token-verify/switch-loop-1-all.png`
    - `.tmp/home-token-verify/switch-loop-2-polygon.png`
    - `.tmp/home-token-verify/switch-loop-2-all.png`
    - `.tmp/home-token-verify/switch-loop-3-bitcoin.png`
    - `.tmp/home-token-verify/switch-loop-3-all-final.png`
  - Logs confirmed `single-network-local-cache-read` with `hasCache:true`, followed by `single-network-cache-ingest`, for `sol--101` (`tokenCount:11`), `evm--137` (`tokenCount:8`, `smallBalanceCount:12`, `riskyCount:30`), and `btc--0` (`tokenCount:1`).
  - Every return to All Networks kept cached rows visible while per-network `all-network-fetch-settled` and `all-network-progressive-settled` updated changed networks.
- Cold-start cache coverage was verified after the QA gap review:
  - All Networks with cache: app was killed and relaunched with existing native storage. Cached rows were visible immediately without a token-list skeleton. Screenshot: `.tmp/home-token-verify/cold-cache-all-network-immediate.png`. This run used visual evidence plus the earlier all-network cache-hydrate logs because the relaunch painted from the warm persisted store before another `all-network-cache-hydrate` line was emitted.
  - Solana single-network with cache: app was killed while Solana was selected and relaunched. Logs at `19:39:04` showed `single-network-local-cache-read` with `hasCache:true`, `networkId:"sol--101"`, `tokenCount:11`, followed by `single-network-cache-ingest` with `source:"singleCacheSeed"`. Screenshots:
    - `.tmp/home-token-verify/cold-cache-single-solana-before-kill.png`
    - `.tmp/home-token-verify/cold-cache-single-solana-immediate.png`
    - `.tmp/home-token-verify/cold-cache-single-solana-after3s.png`
  - All Networks without cache: selected `代币 & NFT 数据` in `清除应用缓存`, terminated from the settings screen, and removed `Documents/mmkv/onekey-cold-start-cache*` before launch. Logs at `19:52:12` showed `all-network-cache-probe` with `cacheCount:0` and `hasCache:false`; no `all-network-cache-hydrate` occurred. Screenshots:
    - `.tmp/home-token-verify/cold-nocache-all-network-3-immediate.png`
    - `.tmp/home-token-verify/cold-nocache-all-network-3-after3s.png`
    - `.tmp/home-token-verify/cold-nocache-all-network-3-after11s.png`
  - Solana single-network without cache: selected `代币 & NFT 数据` in `清除应用缓存`, terminated from the settings screen, and removed `Documents/mmkv/onekey-cold-start-cache*` before launch while Solana was the active network. Logs at `19:57:39` showed `single-network-local-cache-read` with `hasCache:false`, `networkId:"sol--101"`, and `tokenCount:0`; there was no `single-network-cache-ingest`. The token rows were present by the 3-second screenshot because the live Solana request completed quickly, which is acceptable for a cache miss. Screenshots:
    - `.tmp/home-token-verify/cold-nocache-single-solana-immediate.png`
    - `.tmp/home-token-verify/cold-nocache-single-solana-after3s.png`
    - `.tmp/home-token-verify/cold-nocache-single-solana-after11s.png`
- Native logger file confirmed at simulator data container `Library/Caches/logs/app-latest.log`.
- `development/scripts/ios-release-build-deploy.sh logs 'homeTokenListRefreshTrace'` and direct `app-latest.log` grep show the expected main-runtime sequences:
  - `all-network-manual-refresh`
  - `all-network-hook-run-start`
  - `all-network-accounts-resolved`
  - `all-network-cache-probe`
  - `all-network-cache-hydrate`
  - `all-network-authoritative-commit`
  - per-network `all-network-fetch-settled`
  - per-network `all-network-progressive-settled`
  - `all-network-hook-run-finished`
  - `single-network-local-cache-read` with `hasCache:true`
  - `single-network-cache-ingest` with `source:"singleCacheSeed"` and `tokenCount:11` for `sol--101`
- `development/scripts/ios-release-build-deploy.sh logs 'getAllNetworkAccounts'` shows bg-runtime `getAllNetworkAccountsStart/End` written through native logger.
- The `logs` command now falls back to tailing the latest matching log lines when the `hostDidStart fired` anchor is absent, so native logger diagnostics are still readable in this release simulator session.

Residual notes:

- `agent-device snapshot -i` still returns a sparse React Native accessibility tree on this screen, but the performance monitor no longer owns the native window and visual/coordinate verification works.
- Newly created Account #3 has no cache, so it can show a loading/empty state. The expected invariant is only that cached owners do not show a skeleton and previous-owner rows do not leak into the new owner.
