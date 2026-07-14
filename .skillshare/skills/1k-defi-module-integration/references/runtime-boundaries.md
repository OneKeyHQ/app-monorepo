# DeFi Runtime Boundaries

Runtime topology is platform-specific. Production iOS and Android apps run
`main` and `bg` as independent JavaScript runtimes in one native process.
Extension UI and background run in separate browser contexts. Desktop and web
run UI and `BackgroundApi` services in the same app JavaScript runtime.

Throughout this document, `main` and `bg` name UI and background-service
ownership roles. They are runtime/context boundaries on native and extension,
but only a logical service boundary on desktop and web. Background-proxy calls
and app events move serialized copies across native runtimes or extension
contexts; do not assume serialization or duplicated heaps for in-process
desktop/web calls.

## Ownership Map

| Layer | Owner/context | Current owners | Rule |
| --- | --- | --- | --- |
| Route, action dialog/page, inputs, Jotai list state | `main`/UI | AssetDetails, DeFi components, Borrow/Earn/Staking hooks, `DeFiListBlock` | UI owns visible state and may mount before background-service hydration. |
| Build transaction, account API identity, order sync, force refresh | `bg` service | `ServiceDeFi`, `ServiceStaking`, account/send services | Services run without assuming the source UI is still mounted. |
| DeFi overview/quota persistence | `bg` writer | `SimpleDbEntityDeFi` through background API | UI must not write or cache-mutate it directly. |
| Persistent storage | platform resource beneath `bg` owner | `storageHub.appStorage` or `$webStorageSimpleDB` | Native storage can be process-level shared while each runtime has its own JS wrapper. Desktop/web services are in-process. Only bg SimpleDB owns this data on every platform. |
| Event/proxy payload | boundary-dependent value | `AccountDataUpdate`, `DeFiPositionRefreshed`, background proxy results | Native/extension boundaries serialize or clone values; desktop/web may pass values in-process. Validate account/network owner before applying in UI. |

Native main/bg JS bundles are version-locked. Practical native skew is
native-versus-JS or stale network/persisted data, not independent
main-versus-bg bundle versions.

## Required Runtime Model

Every DeFi change must name:

1. platform topology and owner scope: `main`/UI, `bg` service, or both
2. platform persistent-resource ownership
3. JS data-copy semantics across real boundaries versus in-process calls
4. service initialization and route/account timing
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

`SimpleDbEntityDeFi.enableCache` is `false`: the entity wrapper and mutex are
bg-service-owned JS objects, but there is no reusable `cachedRawData` copy for
this entity; each access reads/writes the persistent storage resource. They live
in the bg heap on native/extension and the app heap on desktop/web. UI receives
serialized proxy/event results across native/extension boundaries and
in-process service results on desktop/web.

The 40s/80s timeout handles are volatile state owned by the bg service. They live
in the bg heap on native/extension and in the app heap on desktop/web. An app
exit or owning runtime/context restart cancels them; they are not restored from
SimpleDB. Runtime tests must distinguish persisted overview/quota from an
in-memory delayed refresh schedule and must not claim that restart resumes
pending timers.

Required runtime matrix:

1. Account A, All Networks, cold restart from persisted overview.
2. Switch A -> B while A refresh is in flight; A never updates B.
3. Successful action produces immediate plus delayed bg refresh for A/network.
4. Matching UI owner receives the event and renders new data; the event is
   serialized only across a real runtime/context boundary.
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
- JS data: navigation state and injected/provider state belong to UI. WebView
  bridge messages cross a context boundary. Background-proxy RPC params cross
  heaps on native/extension and may remain in-process on desktop/web.
- timing: browser tab hydration, WebView readiness, provider injection, bg DApp
  service readiness, and signature-confirm route mounting are independent.
- stale rule: bind messages and navigation to the active tab/origin/account and
  reject work after tab/origin/account ownership changes.

Opening or interacting with website UI before a chain RPC remains a Discovery
flow. Only `useDiscoveryMessageHandler` ->
`ServiceDApp.openSignAndSendTransactionModal` may introduce the DApp
`TxConfirmFromDApp` route; it still does not become an internal DeFi action.
