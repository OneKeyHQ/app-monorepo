# Account selector presentation and resources

The selector has two owners: the page owns presentation, and each resource owns
its loading and display cache. Resource readiness must not extend the page budget.

## Presentation

`usePresentationSnapshot` retains the previous resolved scope until the page's
image/value signals or its timer release the next scope. Same-scope updates are
immediate. The selector retains its existing 300 ms presentation budget and
200 ms image preload bound; neither is an end-to-end tap latency guarantee.
The supplied preload promise must resolve; the page handles preload failures.
Only the page supplies these signals. An auxiliary resource must not add another
wait. Add identity-matching results to the candidate and render them through the
presented object, including headers and banners. Lock actions during a retained
identity mismatch. Resource scope and presentation scope need not be identical.

## Resources

Declare one `createUiResource(namespace)` at module scope and call
`useUiResource(resource, key, load)` at a fixed hook location. Use a centralized,
versioned SWR key with the actual resource dependencies. `undefined` result /
`pending` status is not a successful null result; `ready` may carry null, and
`error` is not persisted. A ready result remains visible during soft reload;
`freshness` is stale while revalidation runs or fails. A soft failure retains
the prior ready data without replacing its persisted value; hard invalidation
clears it. Consumers share a cache, not request deduplication or completion order. Cache data is display-only, not
authorization for an action. Do not persist secrets or an entire candidate pool.

`invalidate()` advances the runtime epoch, removes and flushes the namespace,
and notifies mounted subscribers. Wire it to existing mutation events in the
UI invalidation module, which is registered even when the view is unmounted.
Every mutation affecting this resource must use that path. The opt-in
`usePromiseResult` version gate protects both state and cache writes, including
responses arriving before React renders the new epoch. Existing hook callers
without a version keep their prior behavior. Do not mutate returned objects or
write another hook's entry manually; the owning hook persists its load result.

The deprecated-wallet warning key includes the source wallet and physical-device
matching fields, but not network, derive or search state. Wallet lifecycle/name
changes invalidate the whole warning namespace because another wallet may be the
replacement. Device identity/transport changes invalidate it; ordinary unlock
status changes do not. The query re-reads its current source wallet/device.
Pending/error show the stable warning with no primary action. Selection checks
current source/target records and rejects stale epoch, identity or interaction
generation after its await. Removal continues through the existing dialog.

## Regression boundaries

Check warm-cache first render, cold/never-resolving auxiliary queries, same-scope
updates, A-B-A and network changes, out-of-order results, mutation in flight,
unmounted and multiple consumers, clear with reused ids, null/error, and a target
changing during a click. Measure actual switch/render costs; a nonblocking
resource still consumes CPU and I/O. Keep balance batching/display cache, image
caching, and NativeList patches separate. No dynamic hook registration or general
business-data store is required.
