# Swap Runtime Boundaries

Production iOS and Android apps run `main` and `bg` JavaScript runtimes in the
same native process. They initialize independently and do not share JavaScript
objects. Extension UI and its background service worker are also separate JS
contexts. Desktop/web normally call the local BackgroundApi in the same JS
runtime; `kit-bg` is still the logical service owner, but it is not proof of a
separate heap or serialization boundary.

Always separate logical package/service ownership from the physical runtime
topology of the target platform.

## Ownership Map

| Layer                                                      | Physical runtime by host                                             | Current owners                                       | Rule                                                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Route, modal, React UI, hooks, Jotai quote/selection state | native `main`; extension UI context; desktop/web local runtime       | `packages/kit/src/views/Swap`, swap Jotai contexts   | Visible state belongs to the UI runtime/heap.                                                            |
| Quote/build/status and history service                     | native `bg`; extension background context; desktop/web local runtime | `ServiceSwap` and BackgroundApi services             | Logical service ownership is stable even when physical runtime placement differs.                        |
| Swap history persistence                                   | same physical placement as the logical service owner                 | `SimpleDbEntitySwapHistory` through `SimpleDbProxy`  | Keep one logical writer; do not create a UI-side second writer.                                          |
| Persisted storage                                          | platform resource beneath the service owner                          | `storageHub.appStorage` or `$webStorageSimpleDB`     | Storage survives UI unmount/disconnect; resource sharing and heap sharing are different questions.       |
| Stock display snapshot                                     | native `main`; desktop/web local runtime; extension currently no-op  | `swapStockDisplaySnapshotStorage` in Swap UI         | Dedicated display-only key. Background Swap services never read it, and it cannot unlock execution.      |
| Shared contracts                                           | every participating runtime/context                                  | `packages/shared/types/swap`, shared pure predicates | Keep these pure. Separate runtimes get separate JS copies; desktop/web local calls do not imply cloning. |

On native, AsyncStorage is a process-level shared native resource while each JS
runtime has its own `storageHub` wrapper. Swap history authorizes only the
background SimpleDB entity as writer. `SimpleDbEntitySwapHistory.enableCache`
is `false`, so its entity wrapper/mutex live in `bg` but it does not retain a
reusable `cachedRawData` copy; `main` receives serialized history results.

On extension, UI/background messages cross JS contexts and require serializable
data. On desktop/web, BackgroundApi methods normally dispatch locally in the
same JS runtime, so do not claim a deserialized copy without a concrete worker,
Electron-process, or bridge boundary.

Where separate `main` and `bg` bundles ship, they are version-locked in a
release. Practical skew is native-versus-JS or stale persisted/network data,
not bg-versus-main bundle versions.

## Required Reasoning For Every Change

State all six explicitly:

1. Target platform and physical topology: local JS runtime, native `main`/`bg`,
   extension UI/background, or another proven worker/process boundary.
2. Logical owner: UI/Jotai, `kit-bg` service, SimpleDB writer, or shared pure code.
3. Native/web resource ownership: persistent shared resource or per-runtime object.
4. JS heap copies: what is serialized only when a bridge/event boundary exists.
5. Timing: which runtime/account/provider/storage readiness can arrive first.
6. Stale-result rule: which identity rejects a response after account, network,
   token, provider, amount, receiver, `swapType`, or quote event changes.

## Stock Quote Sequence

1. The UI runtime restores account/token/channel state and starts a quote event.
2. The logical Swap service streams provider events locally on desktop/web or
   across the native/extension background boundary.
3. The UI runtime records event progress and selects an actionable quote.
4. An early provider error remains non-terminal while the event is incomplete
   and a later provider can still return an actionable quote.
5. The first actionable current-request quote pins display/execution. Review
   may freeze it before `done` once effective AUTO/CUSTOM, live balance, account,
   receiver, expiry, and signer gates pass; later events do not mutate it.
6. The logical service owner builds/sends or tracks the order, then writes
   status/history.
7. The UI renders the result; it is separately deserialized only on a proven
   runtime bridge.

## Disconnect And Restart Invariant

- UI visibility: account-selector readiness controls whether local recent pairs,
  pending rows, Limit rows, Stock rows, and history are visible.
- Logical persistence owner: persisted history remains intact during a WebDapp
  disconnect.
- native/web storage: rows survive restart.
- initialization: account-selector readiness and SimpleDB hydration can be
  independently timed even on desktop/web in one JS heap. Never delete storage
  to make an unready UI look empty.

Runtime pass sequence:

1. connected: capture visible row ids and persisted count
2. disconnect: all protected local surfaces hide without a delete call
3. restart while disconnected: still hidden, persisted ids/count unchanged
4. reconnect: the same ids reappear and status repair can resume

## Cold-Start Invariant

The first frame may use cached display tokens before quote/build readiness.
Track these separately:

- account-selector storage and active-account readiness
- Swap root/provider store creation
- cached token pair and `swapType`
- Stock token-detail freshness and market state
- quote event id/progress/selected quote
- service/storage readiness on the target platform

No path may let an ordinary Swap default overwrite a restored Stock owner, or
let a service result from an earlier identity update the new UI state.

## Stock Display Snapshot Runtime Model

- Desktop/web: the Swap UI and local BackgroundApi use one app JS runtime, but
  `swapStockDisplaySnapshotStorage` remains the sole logical display-cache
  writer.
- iOS/Android: UI `main` reads and writes the dedicated cold-start key. Mobile
  MMKV is a shared process resource, while `main` and `bg` have separate JS
  heaps and module caches. `bg` may clear storage during a broader reset, but
  `ServiceSwap` never reads the snapshot for quote/build/send decisions.
- Extension: UI and service worker are separate JS contexts, but the current
  `coldStartCacheStorage` adapter is a no-op for extension. Cross-restart Stock
  display restoration is therefore not covered and must not be claimed.
- Initialization order: establish the account physical slot, restore only
  regions whose owner matches (token detail = account + stock + display
  currency; balance = account + input token; chart = account + stock + fixed
  source currency; amount = account + stock + pay + side; selection = account),
  resolve the canonical live Stock owner, then refresh each region. Owner
  changes reject old regions and late patches in the same render.
- Cached token detail, amount, balance, market state, and chart are UI display
  copies only. Before the canonical live owner is ready, the amount is not
  editable. Max, percentage actions, quote, Review, build, sign, and send
  require current live owners and never consume the snapshot.
- Chart `visibleRange` describes retained data; `requestedRange` describes the
  fetch in flight. A silent refresh must not label old data with the new range.
