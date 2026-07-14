# Swap Runtime Boundaries

Runtime topology is platform-specific. Production iOS and Android apps run
`main` and `bg` as independent JavaScript runtimes in the same native process.
Extension UI and background run in separate browser contexts. Desktop and web
run UI and `BackgroundApi` services in the same app JavaScript runtime.

Throughout this document, `main` and `bg` name UI and background-service
ownership roles. They are runtime/context boundaries on native and extension,
but only a logical service boundary on desktop and web. The ownership distinction
still matters for service APIs and SimpleDB even when no JS-runtime boundary
exists.

## Ownership Map

| Layer | Owner/context | Current owners | Rule |
| --- | --- | --- | --- |
| Route, modal, React UI, hooks, Jotai quote/selection state | `main`/UI | `packages/kit/src/views/Swap`, swap Jotai contexts | UI owns visible state and derived quote selection. |
| Quote/build/status and history service | `bg` service | `ServiceSwap` and background API services | Network work and service-side transitions cannot assume the UI is mounted or ready. |
| Swap history persistence | `bg` writer | `SimpleDbEntitySwapHistory` through `SimpleDbProxy` | UI must use the background proxy; do not create a second writer. |
| Persisted storage | platform resource beneath `bg` owner | `storageHub.appStorage` or `$webStorageSimpleDB` | Storage survives UI unmount/disconnect. Native/extension JS objects are per runtime/context; desktop/web services are in-process. |
| Shared contracts | both owners | `packages/shared/types/swap`, shared pure predicates | Keep these pure. Never rely on module singleton state crossing a real runtime/context boundary. |

On native, AsyncStorage is a process-level shared native resource while each JS
runtime has its own `storageHub` wrapper. Swap history authorizes only the bg
SimpleDB entity as writer. `SimpleDbEntitySwapHistory.enableCache` is `false`,
so its entity wrapper/mutex live in bg but it does not retain a reusable
`cachedRawData` copy; main receives serialized history results.

Native main/bg bundles are version-locked in a release. Practical native skew
is native-versus-JS or stale persisted/network data, not bg-versus-main bundle
versions.

## Required Reasoning For Every Change

State all five explicitly:

1. Platform topology and owner scope: `main`/UI, `bg` service, or both.
2. Resource ownership: persistent shared resource or per-runtime/context object.
3. JS data-copy semantics across real boundaries versus in-process calls.
4. Timing: which service/account/provider/storage readiness can arrive first.
5. Stale-result rule: which identity rejects a response after account, network,
   token, provider, amount, receiver, `swapType`, or quote event changes.

## Stock Quote Sequence

1. `main` restores account/token/channel state and starts a quote event.
2. `bg` streams or returns provider quote events.
3. `main` records event progress and selects an actionable quote.
4. An early provider error remains non-terminal while the event is incomplete
   and a later provider can still return `toAmount`.
5. Review freezes the chosen quote/build inputs; later page atom changes do not
   mutate the confirmation.
6. `bg` builds/sends or tracks the order, then writes status/history.
7. UI renders returned history/status data; native/extension receive a separately
   deserialized copy.

## Disconnect And Restart Invariant

- `main`: account-selector readiness controls whether local recent pairs,
  pending rows, Limit rows, Stock rows, and history are visible.
- `bg`: persisted history remains intact during a WebDapp disconnect.
- platform persistence: rows survive restart.
- initialization: account-selector readiness and SimpleDB hydration are
  independent. Never delete storage to make an unready UI look empty.

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
- bg service/storage readiness

No path may let an ordinary Swap default overwrite a restored Stock owner, or
let a bg result from an earlier identity update the new main state.
