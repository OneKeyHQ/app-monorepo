# DeFi Runtime Boundaries

Production native apps run two independent JavaScript runtimes in one native
process. `main` and `bg` do not share JS objects or initialization order.
Background-proxy calls and app events move serialized copies between heaps.

## Ownership Map

| Layer | Runtime | Current owners | Rule |
| --- | --- | --- | --- |
| Route, action dialog/page, inputs, Jotai list state | `main` | AssetDetails, DeFi components, Borrow/Earn/Staking hooks, `DeFiListBlock` | UI state is a main-heap copy and may mount before bg hydration. |
| Build transaction, account API identity, order sync, force refresh | `bg` | `ServiceDeFi`, `ServiceStaking`, account/send services | Services run without assuming the source UI is still mounted. |
| DeFi overview/quota persistence | `bg` writer | `SimpleDbEntityDeFi` through background API | UI must not write or cache-mutate it directly. |
| Persistent storage | shared native resource or persistent web host beneath bg owner | `storageHub.appStorage` or `$webStorageSimpleDB` | Native storage is process-level shared; each runtime has its own JS wrapper, but only bg SimpleDB owns this data. |
| Event/proxy payload | serialized copy | `AccountDataUpdate`, `DeFiPositionRefreshed`, background proxy results | Validate account/network owner before applying in main. |

Main/bg JS bundles are version-locked. Practical skew is native-versus-JS or
stale network/persisted data, not independent main-versus-bg bundle versions.

## Required Five-Part Model

Every DeFi change must name:

1. runtime scope: `main`, `bg`, or both
2. native/web persistent resource ownership
3. JS data copied across proxy/events
4. independent initialization and route/account timing
5. stale-result rejection identity

## AssetDetails Action Sequence

1. `main` route carries stable `accountId`, `indexedAccountId` when required,
   `networkId`, protocol/source position, and action.
2. Native opens `EModalAssetDetailRoutes.DeFiProtocolAction` with page render
   mode; extension/desktop can open an in-page dialog using the same content.
3. `main` validates percent/amount, native token semantics, decimals, health or
   risk state, and supported action metadata.
4. `bg` builds typed `tx`, optional `approvalTx`, `permit`, and `orderId`.
5. Approval/permit/setup completes and hands off before the business confirm.
6. Every success/fail/cancel terminal releases the submit guard. A confirm UI
   can remain visible without allowing a duplicate submit.
7. After broadcast, attach the tx hash to `orderId`; after settle, update final
   order status.
8. Success triggers visible refresh plus bg immediate and 40s/80s refreshes.
   Cancel/failure does not claim refreshed position state.

## Portfolio And All-Networks Refresh

- `main`: `DeFiListBlock` owns `currentOwnerKey`, `loadedOwnerKey`, request
  sequencing, account/network guards, and visible reconciliation.
- `bg`: `ServiceDeFi._runDeFiForceRefresh` fetches with `isForceRefresh`, avoids
  the UI abort pool, writes the exact account/network overview, and emits
  `DeFiPositionRefreshed`.
- `bg`: refresh timers are coalesced by account/network key; current offsets are
  40 seconds and 80 seconds after the immediate refresh.
- persistence: `SimpleDbEntityDeFi` stores per-account/per-network overview and
  the manual force-refresh quota.

`SimpleDbEntityDeFi.enableCache` is `false`: the bg entity wrapper and mutex are
bg-heap objects, but there is no reusable `cachedRawData` copy for this entity;
each access reads/writes the persistent storage resource. Main receives only
serialized proxy/event results.

The 40s/80s timeout handles are volatile bg-heap state. A native process exit or
bg runtime restart cancels them; they are not restored from SimpleDB. Runtime
tests must distinguish persisted overview/quota from an in-memory delayed
refresh schedule and must not claim that restart resumes pending timers.

Required runtime matrix:

1. Account A, All Networks, cold restart from persisted overview.
2. Switch A -> B while A refresh is in flight; A never updates B.
3. Successful action produces immediate plus delayed bg refresh for A/network.
4. Matching main owner receives the serialized event and renders new data.
5. Restart reads the updated record.
6. Cancel/failure does not claim success or refreshed state.
7. UI, request payload, event payload, bg log, and persisted record agree.

## Manual Force Refresh

The durable split is:

- frontend UX policy: a user-triggered refresh can request forced freshness at
  a controlled cadence
- backend abuse protection: protects direct API use independently
- bg persisted quota: current client contract stores the daily count and last
  forced timestamp through `SimpleDbEntityDeFi`

Current agreed client limits are 50 accepted forced refreshes per day with at
least 15 seconds between accepted attempts. Recover current code/server/product
truth before changing these constants; do not treat old discussion as a remote
configuration contract.

## External Discovery DApp Boundary

- runtime scope: Discovery navigation, WebContent, provider mirror, and message
  handler run in `main`; `ServiceDApp` runs in `bg`; signature-confirm UI is a
  `main` route opened only after an RPC request crosses the boundary.
- native resource: native uses a real WebView owned by the main host; desktop
  uses its web-content host. The WebView is not a DeFi service or SimpleDB owner.
- JS copies: navigation state and injected/provider state live in main; WebView
  bridge messages and background-proxy RPC params are serialized copies.
- timing: browser tab hydration, WebView readiness, provider injection, bg DApp
  service readiness, and signature-confirm route mounting are independent.
- stale rule: bind messages and navigation to the active tab/origin/account and
  reject work after tab/origin/account ownership changes.

Opening or interacting with website UI before a chain RPC remains a Discovery
flow. Only `useDiscoveryMessageHandler` ->
`ServiceDApp.openSignAndSendTransactionModal` may introduce the DApp
`TxConfirmFromDApp` route; it still does not become an internal DeFi action.
