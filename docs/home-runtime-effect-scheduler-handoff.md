# Wallet Home Runtime Direct-Rewrite Handoff

Date: 2026-07-27

Status: Revised implementation contract for a direct rewrite; implementation
has not started from this document

Target incident platform: iOS Debug on the existing simulator state

Repository branch at audit time: `codex/native-home-container`

Repository commit at audit time: `2861ca8a2f0ead86f40a04af8f278f2769702619`

## 1. Decision Summary

Wallet Home will be rewritten directly around:

- `HomeSessionMachine`
- `HomeEffectMiddleware`
- `HomeRequestScheduler`
- lifecycle-neutral Home sources
- split Store atoms and dependency-scoped projectors

This is a complete replacement, not a compatibility migration.

The implementation must not add:

- a legacy/new runtime feature flag;
- a compatibility adapter for the old React source controllers;
- a fallback to the old controller forest;
- two active producers for one source;
- an intermediate production state in which some lifecycle decisions belong to
  the old coordinator and others belong to the new runtime.

Development may use dependency-ordered commits on the same branch, but the
production cutover is one change set: install the new runtime, move every
production owner, delete the old runtime, and then validate the Debug build.

No simulator or app data may be cleared during implementation verification.
Persisted display snapshots are disposable cache data: incompatible old
snapshot entries may be ignored by the new schema, but the implementation must
not delete MMKV, local databases, account data, or other persisted user state.

## 2. Incident and Required Reproduction

The reported state is:

- Wallet 1
- Account #3
- All Networks

Observed behavior:

- launching in this state can leave the app unresponsive;
- account, section, and bottom-tab input cannot be processed;
- memory rises and the process can eventually terminate;
- switching bottom tabs appears to trigger a large amount of repeated work.

Required Debug verification must preserve the existing simulator state and
exercise:

1. cold launch while Account #3 / All Networks is selected;
2. Account #1 -> Account #2 -> Account #3 -> Account #1;
3. Wallet -> Trade -> Perps -> Discover -> Wallet;
4. Home section switching and manual refresh;
5. app background -> foreground while Wallet Home is selected.

## 3. Audit Vocabulary

| Prefix | Meaning                    | Evidence requirement                                    |
| ------ | -------------------------- | ------------------------------------------------------- |
| `F`    | Verified code fact         | File and symbol at the audited commit                   |
| `O`    | Runtime observation        | Screenshot, log, trace, profile, or repeatable behavior |
| `H`    | Hypothesis                 | Supporting facts and confidence                         |
| `D`    | Approved design decision   | Explicit boundary or invariant                          |
| `T`    | Implementation requirement | Testable behavior                                       |
| `R`    | Removal requirement        | Old production path that must no longer exist           |

The implementation must not promote a Debug observation into a production
watchdog, native-memory, or release-performance conclusion. Debug is the
required functional and runaway-work verification for this rewrite. A later
Release profile may refine production thresholds without changing the
architecture.

## 4. Runtime Topology

### 4.1 iOS and Android

iOS and Android use two isolated JavaScript runtimes in one native process:

- `main`: React Native, the Home Jotai Store, reducer, session policy,
  middleware, main-side scheduling, result reduction, and rendering.
- `bg`: background services, network work, and service-owned processing.
- Native resources: MMKV, database/file handles, networking, image resources,
  and native singletons may be shared or process-owned below the JavaScript
  runtime boundary.
- JavaScript heap copies: `main` and `bg` do not share objects. A payload
  crossing the runtime boundary is deserialized into another heap.
- Timing: `main` and `bg` initialize independently. Home must wait for a valid
  producer handshake.

A main-runtime `AbortSignal` does not physically cancel bg work by itself.
Logical cancellation and stale-result rejection are required even when the
transport supports physical cancellation.

### 4.2 Web and desktop

Web and desktop execute Home main/background code in one JavaScript runtime per
renderer or browser tab. Business interfaces remain identical, but:

- the request pool is runtime-shared rather than bg-runtime-owned;
- lifecycle facts come from page/window visibility;
- snapshot storage is asynchronous;
- multiple tabs or renderer windows can contend for the same persisted
  namespace.

### 4.3 Extension

Approved runtime assumption:

> If the MV3 service worker restarts, the whole app runtime restarts.

Within one app lifetime, the producer instance is stable. After restart, Home
creates a new Store runtime, session, scheduler, and handshake from cold-start
state. The rewrite does not implement a live Extension producer reconnect
state machine.

The Extension integration test must assert this host behavior. If a future host
allows a UI runtime to survive an isolated worker restart, that is a new
runtime contract and requires a separate design change.

## 5. Verified Current-State Facts

### 5.1 Split state exists, but ownership is re-aggregated

`F-01`: Home resources and sections already use separate context atoms in:

```text
packages/kit/src/states/jotai/contexts/home/atoms.ts
```

`F-02`: aggregate subscribers re-couple those atoms:

- `HomeStoreCommandController` subscribes to all section payloads and several
  resources;
- `useHomeRefreshIntents` subscribes to multiple sections and resources;
- `MobileNativeHomeRenderer` subscribes to session, facts, interaction, shell,
  navigation, all six sections, and several payloads.

Atom splitting limits invalidation only when consumers remain scoped. It does
not prevent a component that subscribes to every atom from running again.

### 5.2 Reducer work is not cheap

`F-03`: `homeStoreReducer.ts` currently:

- performs full-value `stableStringify` equality;
- serializes and parses ready section values to clone them;
- compares complete resource values for source responses.

This synchronous work executes on main JavaScript. Request concurrency control
cannot preempt a single large normalize, clone, equality, snapshot encode, or
render task.

The problem is broader than the reducer. Current Home production code also
uses serialized keys/fingerprints in Native render decisions, facts and
capability adapters, source gateways, source adapters, section controllers,
and snapshot manifest comparison. Each full-payload comparison allocates
temporary strings and adds an O(n) traversal before React/Jotai work begins.

At the audited commit, a broad non-test scan for `stableStringify`,
`JSON.stringify`, `JSON.parse`, `cloneDeep`, and `isEqual` finds 80 candidate
call sites across 35 Home/mobile production files. Boundary codecs and signing
must be classified rather than blindly removed; every live equality use must
be migrated.

### 5.3 The orchestration forest is React-owned

`F-04`: `HomeStoreSourceControllers` mounts:

- `HomeStoreControllerBridge`
- `HomePortfolioControlPersistenceController`
- `HomeTokenListProviderMirror`
- `HomeReadySourceControllers`
- `HomeDisplaySnapshotController`
- `HomeStoreCommandController`

`F-05`: `HomeReadySourceControllers` mounts:

- Balance
- Portfolio
- Capability
- Account Value persistence
- Banner
- Perps
- DeFi
- History
- NFT
- Market

Each mounted controller can independently observe owner, focus, polling,
commands, events, and section state.

### 5.4 Current lifecycle authority is duplicated

`F-06`: lifecycle authority currently spans:

- imperative `HomeSessionMachine`;
- `HomeSessionCoordinator`;
- `HomeStoreControllerBridge`;
- Home Store session atoms.

The rewrite must reduce these to one renderable lifecycle truth in the Store.

### 5.5 Existing request and progressive algorithms must be understood

`F-07`: `useAllNetworkRequests` already has section-local cold/warm concurrency
and a sliding-window executor.

`F-08`: Portfolio already implements a 350ms last-write-wins progressive
materialized view.

The current defect is not “zero concurrency control” or “zero throttling”. The
missing system boundary is one session-aware scheduling policy across sources,
plus bounded Store commits, cheap reducer work, and scoped render subscriptions.

### 5.6 Native recovery is a separate production workflow

`F-09`: `HomeBackgroundRecoveryRefreshProvider` owns:

- background-ready sequence handling;
- owner activation and claim deduplication;
- wallet-list silent refresh barrier;
- surface commit acknowledgement;
- source-domain refresh callbacks;
- latched recovery replay after Home mounts.

This behavior must be incorporated into the new lifecycle/effect model before
the old provider is deleted.

### 5.7 Current snapshot persistence is not per Store

`F-10`: the CacheV2 persist queue is currently a module-level serial writer.
Native critical hydration is synchronous; web/desktop hydration is
asynchronous. Prepared-owner replacement also has ordering semantics.

The rewrite must not accidentally create one competing storage writer per Home
Store.

## 6. Root-Cause Model Addressed by the Rewrite

The high-confidence amplification model is:

```text
owner / account / route / tab change
  -> several React controllers invalidate together
  -> several section-local request trees start or restart
  -> many network settlements return to main
  -> normalize + clone + equality + reducer + atom writes
  -> aggregate subscribers run
  -> projectors and renderers execute
  -> snapshot and diagnostic work enqueue
  -> more effects, timers, and promise continuations enter main JS
```

Memory can grow because:

- old and new session tasks overlap;
- pending tasks retain closures, inputs, and intermediate maps;
- bg and main retain separate payload copies;
- normalized, serialized, and render representations coexist;
- frozen or mounted React subtrees retain controller refs and timers;
- display snapshots, native images, and native caches have independent owners.

The rewrite solves the JavaScript ownership and amplification paths. If Debug
verification still shows process growth after JavaScript queues and old
sessions are bounded, native ImageIO/VM ownership becomes a separate measured
work item rather than a reason to reintroduce controller compatibility.

## 7. Non-Negotiable Architecture Invariants

`D-01`: UI dispatches intents and environment events but never receives or
executes reducer-produced effects.

`D-02`: reducers and projectors are deterministic and perform no asynchronous
work.

`D-03`: middleware owns effect routing, task handles, ports, and disposal
bookkeeping, but no renderable or section business state.

`D-04`: the scheduler understands generic task keys, groups, priorities,
policies, deadlines, queue bounds, and cancellation. It contains no branches
for Portfolio, NFT, Perps, DeFi, History, Banner, or Market.

`D-05`: a source owns section-specific I/O and normalization but does not import
React, use hooks, subscribe to Jotai, or infer component mount state.

`D-06`: `HomeSessionMachine` is a pure sub-reducer called from the Home reducer.
Middleware never maintains a second lifecycle state.

`D-07`: source results can enter Home only through a session-aware result sink.
Sources receive no raw Store dispatcher.

`D-08`: there is one runtime lease per actual Home Jotai Store.

`D-09`: there is one active producer and one command executor for each
responsibility after cutover.

`D-10`: snapshot persistence has one serial writer per runtime/storage
namespace, not one underlying writer per Home Store.

`D-11`: hidden, background, and detached are host lifecycle facts, not inferred
from React component mount state.

`D-12`: no compatibility mode, fallback runtime, or Home-internal legacy
event-bus round trip is permitted. Thin adapters for externally produced global
events remain only where the external producer cannot be migrated in this
rewrite.

`D-13`: only JSON-compatible request envelopes cross isolated JavaScript
runtimes. Functions, closures, `AbortSignal`, Store objects, and Home source
implementations never cross that boundary.

`D-14`: result authority is bound when a request starts. Owner, app epoch,
client, session, producer, source, source key, request sequence, source
revision, request group, and task identity are validated before main-side
materialization.

`D-15`: all accepted publications pass through one Store-scoped commit budget.
Source-local throttling may reduce work further but cannot bypass the
cross-source budget.

`D-16`: TokenList refresh demand is not derived only from Home visibility.
Send, Receive, Asset Selector, URL Account, Native, and other external
consumers acquire explicit Store and source-demand leases.

`D-17`: live task and publication queues have explicit entry and concurrency
bounds. Disposable identity caches, snapshot chunks, and snapshot namespaces
also have byte bounds. A valid live source result is never rejected solely
because of its byte size.

`D-18`: runtime capabilities are selected by a discriminated mode preset.
Independent booleans cannot create an invalid combination of source execution,
commands, persistence, and snapshots.

`D-19`: live main-JS equality, identity, revision, deduplication, and dependency
decisions never serialize or generically deep-compare complete payloads.
Required boundary serialization cannot be reused as a render/Store equality
mechanism.

## 8. Canonical Architecture Comment

Place this comment at the top of
`model/effects/homeEffectMiddleware.ts`:

```ts
/**
 * Wallet Home runtime architecture:
 *
 * - UI dispatches intents and environment events but never receives or executes
 *   reducer-produced effects.
 * - Reducers and projectors are pure and never perform asynchronous work.
 * - The effect middleware executes reducer-produced effects but owns no
 *   renderable or section business state.
 * - The request scheduler owns generic task admission, prioritization,
 *   cancellation, and the Store-scoped commit budget, but contains no section
 *   business logic.
 * - Data sources own section-specific I/O and normalization, but never depend on
 *   React component lifecycle.
 *
 * HomeSessionMachine is a pure sub-reducer and is the only lifecycle decision
 * model. HomeEffectMiddleware is the only executor of reducer-produced effects.
 * Sources publish results only through a request-bound, session-aware result
 * sink. The sink validates authority before expensive main-side materialization
 * and submits accepted publications to the Store-scoped commit budget.
 * Live equality and revision decisions use explicit revisions, structural
 * sharing, and scoped field comparison; they never serialize full payloads.
 *
 * Cancellation reduces wasted work. Owner, session, producer, source, and
 * request-token validation remains the correctness boundary for stale results.
 */
```

## 9. Target Data Flow

```text
UI intent or host lifecycle fact
  -> Store-bound HomeDispatcher
  -> reduceHomeStore()
       -> transitionHomeSession() when the event is lifecycle-related
       -> atomic mutations
       -> typed effects
  -> HomeEffectMiddleware.enqueue(effects)
       -> source-plan handler
       -> runtime/recovery handler
       -> command/navigation handler
       -> persistence/snapshot handler
       -> HomeRequestScheduler
            -> plain Home source workflow
            -> JSON leaf request envelope on split-runtime targets
            -> SharedRequestPool around the physical network leaf
            -> request-bound HomeResultSink
            -> Store-scoped commit budget
  -> token-validated source-result event
  -> reducer mutations
  -> dependency-scoped projectors
  -> split section/resource atoms
  -> subscribed renderer only
```

The middleware drain must never await a long request. It synchronously routes
or starts effects so cancellation and owner changes cannot wait behind an
unrelated request.

## 10. Session Model

Lifecycle state is orthogonal rather than one overloaded status:

```ts
type IHomeSessionState = {
  mode: "wallet" | "urlAccount";
  runtimeInstanceId: string;
  appEpoch: string;
  clientInstanceId: string;
  ownerToken?: IHomeRuntimeOwnerToken;
  authority: "idle" | "waitingForProducer" | "ready" | "degraded" | "stopped";
  appActivity: "active" | "inactive" | "background";
  surfaceVisibility: "visible" | "hidden" | "detached";
  producerInstanceId?: string;
  handshakeRevision: number;
  sessionSequence: number;
  sessionId: string;
};
```

`runtimeInstanceId` and `clientInstanceId` are created outside the reducer when
the Store runtime lease is acquired. `appEpoch` comes from the host/runtime
handshake. On iOS/Android/Extension it scopes the split-runtime producer
lifetime; on Web/Desktop it scopes the current tab/renderer runtime.
`sessionId` is derived deterministically from runtime identity and
`sessionSequence`, not generated randomly inside the reducer.

`transitionHomeSession()` returns both lifecycle mutations and effects:

```ts
type IHomeSessionTransition = {
  state: IHomeSessionState;
  effects: readonly IHomeStoreEffect[];
};

function transitionHomeSession(
  state: IHomeSessionState,
  event: IHomeSessionEvent
): IHomeSessionTransition;
```

Required transitions:

- owner created -> waiting for producer;
- valid handshake -> ready;
- owner change -> cancel old session before starting the next session;
- visible -> hidden -> source plan reconciles to hidden policy;
- hidden -> visible -> deadlines are recalculated from timestamps;
- app background -> background plan;
- native runtime recovery -> wallet-list barrier and surface commit effects;
- retry exhaustion -> degraded;
- dispose -> stopped and reject future runtime work.

Visibility must not reset to visible merely because the owner changes.

## 11. Store-Bound Dispatch and Effect Delivery

UI-facing dispatch returns a receipt, never effects:

```ts
type IHomeDispatchReceipt = {
  accepted: boolean;
  correlationId?: string;
  rejectReason?: IHomeStoreRejectReason;
};

type IHomeDispatcher = {
  dispatch(event: IHomeStoreEvent): IHomeDispatchReceipt;
  dispatchAtomically(events: readonly IHomeStoreEvent[]): IHomeDispatchReceipt;
};
```

Internal order is synchronous:

1. reduce the event;
2. apply all mutations atomically;
3. enqueue all produced effects into the Store-bound runtime;
4. return the receipt.

The runtime must be acquired before a production UI dispatcher can publish an
event. Effects must not be silently dropped during React mount or StrictMode
replay.

Effects carry stable identity:

```ts
type IHomeEffectBase = {
  effectId: string;
  eventSequence: number;
  sessionId: string;
  correlationId?: string;
};
```

The Store-bound dispatcher allocates a monotonic `eventSequence` before calling
the reducer. A reducer derives `effectId` deterministically from
`runtimeInstanceId:eventSequence:effectIndex`. Reducers must not read time,
generate UUIDs, or mutate an external counter while producing effects.

Effect execution requirements:

- FIFO routing for effects produced by one dispatch;
- idempotency by `effectId`;
- typed completion/failure events;
- executor failures never become unhandled promises;
- disposal rejects new work;
- late completion after disposal can only enter the stale-token rejection path;
- re-entrant dispatch is supported without recursive unbounded drains.

## 12. HomeEffectMiddleware

The middleware is a small typed effect router.

Candidate effect categories:

- `connectRuntime`
- `refreshRuntimeHandshake`
- `cancelSession`
- `reconcileSourcePlan`
- `recoverRuntime`
- `refreshSource`
- `executeSourceCommand`
- `executeNavigationCommand`
- `hydratePortfolioControls`
- `persistPortfolioControls`
- `persistAccountValue`
- `hydrateDisplaySnapshot`
- `persistDisplaySnapshot`
- `traceReject`

Injected ports:

```ts
type IHomeRuntimePorts = {
  navigation: IHomeNavigationPort;
  background: IHomeBackgroundPort;
  accountOverview: IHomeAccountOverviewPort;
  settings: IHomeSettingsPort;
  tokenList: IHomeTokenListPort;
  bannerCommands: IHomeBannerCommandPort;
  marketCommands: IHomeMarketCommandPort;
  perpsCommands: IHomePerpsCommandPort;
  snapshots: IHomeSnapshotRepository;
  lifecycle: IHomeHostLifecycleAdapter;
  hostScheduling: IHomeHostSchedulingAdapter;
};
```

Ports prevent sources and middleware handlers from importing React hooks or
app-specific components. The Banner port, for example, replaces
`useWalletBanner()` with a non-React command API. Ports do not store renderable
Home state.

## 13. Scheduling Model

### 13.1 Two scheduling scopes

`HomeRequestScheduler` is owned by one Home Store runtime and controls logical
session work and that Store's generic publication budget. A logical workflow
may compose cache reads, dependencies, and several physical leaf requests. It
does not consume a physical slot while waiting to schedule child leaves.

`SharedRequestPool` controls physical leaf-request concurrency:

- iOS/Android/Extension: owned in the bg request runtime where the network work
  is physically executed;
- web/desktop: shared only by the current JavaScript runtime
  (tab/renderer), not browser-wide or process-wide.

On split-runtime targets, the call chain is:

```text
main Home source workflow
  -> background port
  -> JSON IRuntimeLeafRequestEnvelope
  -> bg service-owned descriptor validator and handler
  -> SharedRequestPool admission
  -> actual network/database leaf operation
  -> JSON response envelope
  -> main request-bound ResultSink
```

The Pool must surround the actual leaf operation. Limiting the number of RPC
calls while a bg service starts an unrestricted internal fan-out does not
satisfy this contract.

Generic request/cancel/outcome envelopes and JSON validators may live in
`@onekeyhq/shared`. The Pool and service-owned leaf wrappers may live in
`@onekeyhq/kit-bg`. Neither imports Home Store, source, or section identifiers.
Home logical scheduling, registries, result sinks, and commit budgeting remain
in `@onekeyhq/kit`.

### 13.2 Initial configuration

The first implementation uses configurable platform profiles, not immutable
architecture constants:

| Pool scope                         | Running | Interactive reserve | Global pending | Per-client pending |
| ---------------------------------- | ------: | ------------------: | -------------: | -----------------: |
| iOS/Android bg runtime             |       4 |                   1 |             64 |                 32 |
| Extension bg runtime per app epoch |       4 |                   1 |             64 |                 32 |
| Web/Desktop per tab or renderer    |       8 |                   1 |             64 |                 64 |

One Home logical scheduler may retain at most 64 lightweight task descriptors.
These numbers are initial safe profiles and must be verified against Debug
traces and later Release evidence. A profile may change, but no target may
disable the hard queue bounds.

The physical Pool identifies a client by:

```text
appEpoch + clientInstanceId
```

Admission uses round-robin fairness across clients and priority plus aging
within a client. When a queue is full:

1. supersede the same client's oldest eligible background task;
2. otherwise reject the incoming task with a typed overflow outcome;
3. never evict another client's accepted task;
4. never create a hidden secondary queue;
5. emit a privacy-safe diagnostic with global and per-client counts.

Interactive reservation applies to running capacity. Aging prevents background
starvation without allowing one client to monopolize the Pool.

### 13.3 Task contract

```ts
type IRuntimeRequestPriority = "interactive" | "critical" | "background";

type IHomeRequestPriority = IRuntimeRequestPriority;

type IHomeRequestPolicy = "takeLatest" | "exhaust" | "queue";

type IHomeWorkflowContext = {
  signal: AbortSignal; // local runtime cancellation only
  requestLeaf<
    TDescriptor extends IRuntimeJsonValue,
    TValue extends IRuntimeJsonValue
  >(
    descriptor: TDescriptor,
    options: {
      priority: IRuntimeRequestPriority;
      deadlineAt: number;
    }
  ): Promise<IRuntimeLeafResponseEnvelope<TValue>>;
  yieldIfMainBudgetExceeded(): Promise<void>;
};

// main-side or same-runtime only; never serialized
type IHomeLogicalRequestTask<TResult> = {
  taskId: string;
  key: string;
  groupKey: string;
  clientInstanceId: string;
  appEpoch: string;
  sessionId: string;
  requestGroupId: string;
  priority: IHomeRequestPriority;
  policy: IHomeRequestPolicy;
  timeoutMs: number;
  run(context: IHomeWorkflowContext): Promise<TResult>;
};

type IRuntimeJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly IRuntimeJsonValue[]
  | { readonly [key: string]: IRuntimeJsonValue };

// canonical generic envelope; contains no Home source or section identifier
type IRuntimeLeafRequestEnvelope<
  TDescriptor extends IRuntimeJsonValue = IRuntimeJsonValue
> = {
  protocolVersion: number;
  taskId: string;
  clientInstanceId: string;
  appEpoch: string;
  sessionId: string;
  requestGroupId: string;
  priority: IRuntimeRequestPriority;
  deadlineAt: number;
  descriptor: TDescriptor;
};

type IRuntimeLeafCancelEnvelope = Pick<
  IRuntimeLeafRequestEnvelope,
  "taskId" | "clientInstanceId" | "appEpoch" | "sessionId" | "requestGroupId"
>;

type IRuntimeLeafResponseEnvelope<
  TValue extends IRuntimeJsonValue = IRuntimeJsonValue
> = {
  taskId: string;
  clientInstanceId: string;
  appEpoch: string;
  sessionId: string;
  requestGroupId: string;
  producerInstanceId: string;
  outcome:
    | { kind: "fulfilled"; value: TValue }
    | { kind: "cancelled" }
    | { kind: "timedOut" }
    | { kind: "failed"; errorCode: string };
};

type IHomeRequestOutcome<TResult> =
  | { kind: "fulfilled"; value: TResult }
  | { kind: "cancelled" }
  | { kind: "superseded" }
  | { kind: "ignored" }
  | { kind: "timedOut" }
  | { kind: "failed"; error: unknown };
```

Each bg service owns a discriminated JSON descriptor and runtime validator for
the operations it exposes. The generic Pool sees only envelope identity,
priority, deadline, and a callable leaf already selected by the service
wrapper. It does not switch on Portfolio, NFT, Perps, or any other Home source.

Policy semantics:

- `takeLatest`: cancel pending duplicates, request cancellation for a running
  duplicate, and mark any surviving old result superseded;
- `exhaust`: return `ignored` for a duplicate while the active task runs;
- `queue`: bounded FIFO for the same key;
- cancellation, supersession, and timeout do not publish a business error
  result;
- a task that cannot be physically cancelled continues to occupy its physical
  slot until the underlying operation settles;
- workflow orchestration does not consume a leaf slot while waiting to schedule
  child leaf requests.

### 13.4 Cross-runtime cancellation

Native and Extension cancellation carries the full client-scoped identity:

```text
appEpoch
clientInstanceId
sessionId
requestGroupId
taskId
```

The main scheduler may use a local `AbortSignal` for same-runtime work. It sends
`IRuntimeLeafCancelEnvelope` for bg work; the signal object itself never
crosses the boundary.

Services that support physical cancellation cancel only the matching
`appEpoch/client/session/group/task`. Existing global service abort methods
must not be used to cancel one Home session if they can also terminate work
belonging to another scene, client, or newer session.

Correctness never depends on cancellation. Every result is validated again by
owner, app epoch, client, session, producer, source, source key, request
sequence, source revision, request group, and task identity.

On split-runtime targets, `producerInstanceId` originates in bg and travels
with the bg response envelope. Main must not fabricate a producer identity for
bg work.

The physical slot remains occupied until the underlying operation settles,
even when main has already marked its logical task cancelled or timed out.

## 14. Result Sink and Progressive Store Writes

Sources do not receive `emit()` or a Store dispatcher. Middleware creates one
sink per accepted request and binds the complete authority:

```ts
type IHomeResultPhase = "leading" | "intermediate" | "final";

type IHomeResultAuthority = {
  ownerToken: IHomeRuntimeOwnerToken;
  appEpoch: string;
  clientInstanceId: string;
  sessionId: string;
  producerInstanceId: string;
  sourceId: IHomeStoreSourceId;
  sourceKey: string;
  requestSequence: number;
  sourceRevision: number;
  requestGroupId: string;
  taskId: string;
};

type IHomeResultPublication<TWire extends IRuntimeJsonValue> = {
  phase: IHomeResultPhase;
  revision: number;
  wireValue: TWire;
  coverageFingerprint?: string;
};

type IHomeResultPublishOutcome =
  | { kind: "accepted"; publicationId: string }
  | { kind: "unchanged" }
  | { kind: "buffered" }
  | { kind: "backpressured"; retryable: boolean }
  | { kind: "rejected"; reason: IHomeStoreRejectReason };

type IHomeResultSink<TWire extends IRuntimeJsonValue, TModel> = {
  publish(result: IHomeResultPublication<TWire>): IHomeResultPublishOutcome;
};

declare function createHomeResultSink<
  TWire extends IRuntimeJsonValue,
  TModel
>(options: {
  authority: IHomeResultAuthority;
  materialize: (
    wireValue: TWire,
    previous: TModel | undefined
  ) =>
    | IHomeMaterializedResult<TModel>
    | Promise<IHomeMaterializedResult<TModel>>;
}): IHomeResultSink<TWire, TModel>;
```

`wireValue` is the JSON-compatible service result, not the complete render
model. `materialize()` is a main-runtime callback and never crosses the runtime
boundary.

Publication processing order is mandatory:

1. validate the bound owner, app epoch, client, session, producer, source,
   source key, request sequence, source revision, request group, and task;
2. validate monotonic phase/revision and reject publications after the same
   request's terminal `final`;
3. use a trustworthy revision/fingerprint to reject semantic no-ops before
   materialization when possible;
4. reserve bounded publication capacity;
5. run or schedule `materialize()` in bounded chunks;
6. validate the complete authority again after asynchronous materialization;
7. submit the materialized model and its explicit revision metadata to the
   Store-scoped commit budget;
8. release wire/model references immediately after rejection, supersession, or
   commit.

This ordering makes “discard before materialization” executable. Passing an
already materialized `TModel` into `publish()` is prohibited.

### 14.1 Store-scoped commit budget

Every source sink owned by one Home Store submits into one commit queue. Initial
hard bounds are:

```text
max buffered publications per Store: 32
max publications per atomic dispatch: 8
max visible commit dispatches per animation frame: 1
```

There is no live-result or cross-runtime response byte gate. The runtime must
not stringify or clone a result merely to estimate its size, and a valid final
result must not be rejected because it is large. Large results wait for their
normal turn, avoid parallel materialization, yield during transformation where
the source supports chunking, and still commit complete business data.
Pagination and projection are source optimizations, not correctness
requirements.

Coalescing rules:

- retain only the latest intermediate for one
  `sourceKey/requestSequence`;
- a final supersedes a buffered intermediate from the same request;
- a newer request may supersede buffered publications from an older request;
- critical and interactive publications are ordered before background
  publications;
- finals cannot be dropped after admission; capacity is reserved before
  returning `accepted`;
- if capacity cannot be reserved, return typed `backpressured` rather than
  retaining an unbounded value;
- one atomic reducer dispatch may commit several independent source mutations;
- source-specific policy may reduce publication frequency but cannot bypass
  this Store-wide budget.

The animation-frame adapter is platform-specific. When no visible frame exists,
the runtime uses a bounded microtask/macrotask drain and the same per-drain
limit; it never drains the entire queue synchronously.

Default commit policy:

| Source state                   | Policy                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| First useful visible result    | Queue for the next bounded commit drain                                                               |
| Portfolio intermediate         | Existing 350ms LWW window, then Store-wide budget                                                     |
| Other section intermediate     | Disabled unless explicitly declared                                                                   |
| Normal visible final           | Reserve capacity and flush through the next bounded drain                                             |
| Hidden/background final        | Validate and retain only the latest confirmed wire result; no render-model materialization by default |
| Hidden/background intermediate | Discard                                                                                               |
| Visible after hidden           | Materialize only the latest staged confirmed result before live refresh                               |
| Detached or stopped            | Discard                                                                                               |
| Old authority                  | Discard before materialization                                                                        |
| Semantically unchanged result  | No Store mutation                                                                                     |

The write bound for a source with an intermediate window `W` over active
duration `D` is:

```text
commits <= leading + ceil(D / W) + final
```

Multiple Store writes are valid. The required property is bounded writes and
dependency-scoped invalidation, not a single final update.

The Store-wide bound is stricter than the sum of source-local bounds: even when
several sources settle together, the runtime performs at most one visible
atomic commit dispatch per frame.

## 15. Main JavaScript CPU Rules

The scheduler controls async admission; it does not make synchronous work
preemptible. The rewrite must also enforce:

- no full payload `stableStringify` equality in the reducer hot path;
- no stringify/parse clone for section or resource payloads;
- source-produced revisions or fingerprints for unchanged-result detection;
- immutable source outputs and structural sharing;
- semantic projectors update only changed entities;
- large normalization/materialization yields in bounded chunks when it cannot
  be moved to bg;
- snapshot encode is not executed once per progressive Store commit;
- stale session checks occur before expensive main-side transformation;
- task queues retain lightweight task descriptors rather than captured payloads;
- reducer-produced effects contain identifiers and small immutable inputs, not
  section payload snapshots;
- materialization work has an elapsed-time budget per drain and yields before
  processing the next chunk;
- hidden confirmed wire results do not create render models until a visible
  consumer needs them;
- live result, effect, task, and diagnostic queues expose count gauges in
  development; disposable caches additionally expose retained-byte gauges.

For single-runtime web/desktop, removing defensive serialization must not expose
mutable aliasing. Source contracts require immutable output. Development tests
may freeze result objects to detect mutation.

### 15.1 Equality, identity, and revision contract

The prohibition applies to the complete live main-JS path, not only the
reducer. Reducers, result sinks, source materializers, projectors, selectors,
native slot assembly, command routing, lifecycle decisions, and Store
invariants must not use:

- `JSON.stringify()` or `stableStringify()` for equality, deduplication,
  revision generation, dependency keys, or coverage fingerprints;
- stringify/parse cloning;
- generic deep equality such as unbounded `isEqual()`;
- `cloneDeep()` for source, section, resource, or presentation payloads;
- a second full collection traversal solely to calculate a hash after the
  model has already been built.

Replacing stringify equality with another full-object deep comparison does not
satisfy the rewrite.

Required replacement strategies:

| Data shape                            | Equality/revision strategy                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| owner, session, config, command input | explicit scalar field comparison or a typed canonical key builder                         |
| source request input                  | source key built from declared scalar dependencies                                        |
| server result                         | service cursor, block height, ETag equality, or source-maintained monotonic data revision |
| entity collection                     | normalized keyed entities, stable order IDs, per-entity revision, and structural sharing  |
| projector input                       | declared dependency revision tuple plus reference/shallow equality                        |
| native slot                           | slot-local revision and unchanged reference reuse                                         |
| snapshot manifest                     | descriptor/source revision and commit identity comparison before serialization            |

Revision and change information is produced while the source/materializer
constructs the next model. It must not be derived afterward by serializing the
complete model:

```ts
type IHomeMaterializedResult<TModel> = {
  model: TModel;
  dataRevision: string | number;
  changedEntityIds?: readonly string[];
  coverageRevision?: string | number;
};
```

`coverageFingerprint` in a result publication may contain a server-provided or
incrementally maintained compact token. It must not be a stringify/hash of the
complete row-ID array or payload on main JS.

When no trustworthy revision exists, the materializer performs incremental
field/entity comparison during construction and reuses unchanged references.
The reducer does not compensate with a generic deep comparison.

Serialization remains allowed only at real boundaries:

- RPC/runtime transport;
- snapshot/cache encode and decode, outside reducer/render/projector paths;
- persisted URL/local-storage formats;
- deterministic crypto/signature payloads, which continue to use
  `stringUtils.stableStringify()` where required;
- explicit development diagnostics that are not enabled in the production hot
  path.

Boundary serialization cannot be reused as a Store equality key. Snapshot
encoding remains debounced and must not run once per progressive result.

## 16. Render Isolation

Split atoms, write coalescing, and structural sharing solve different layers:

- split atoms limit subscriber invalidation;
- result buffering limits commit count;
- structural sharing limits reference changes;
- scoped render bridges limit React/native presentation work.

The current aggregate Mobile renderer must be replaced with:

```text
MobileNativeHomeHost
├── HomeHeaderSlotBridge
├── HomePortfolioSlotBridge
├── HomePerpsSlotBridge
├── HomeDeFiSlotBridge
├── HomeNFTSlotBridge
├── HomeHistorySlotBridge
└── HomeMarketSlotBridge
```

Each bridge subscribes only to:

- its section/resource atom;
- explicitly declared presentation dependencies;
- minimal shared shell facts needed by that slot.

Real dependencies are permitted. For example, an NFT presentation model may
depend on NFT and Portfolio data. Undeclared dependencies and subscription to
the complete Home state are not permitted.

Acceptance is:

- an unrelated section does not rerun its projector or renderer;
- a declared dependency may rerun;
- unchanged native slot revisions and references remain stable;
- the native renderer does not remount unchanged slots.

## 17. Module Model and Extensibility

Do not create a dynamic plugin framework. Use a static, typed, lazy registry
after the source contracts are stable.

There are four module roles:

1. `source`: remote/cache I/O and wire-result production;
2. `projector`: pure derived render state;
3. `persistenceHandler`: external writes and hydration;
4. `environmentAdapter`: owner, settings, locale, capability, and lifecycle
   facts.

Do not force Balance, Capability, Account Value, or controls into one generic
source abstraction.

Remote source descriptor:

```ts
type IHomeRuntimeMode = "wallet" | "urlAccount";

type IHomeSourceDefinition<TInput, TWire extends IRuntimeJsonValue, TModel> = {
  id: IHomeStoreSourceId;
  dataSchemaVersion: number;
  applicability: {
    modes: readonly IHomeRuntimeMode[];
    requiredCapabilities?: readonly IHomeRuntimeCapability[];
  };
  loadWorkflow: () => Promise<IHomeSourceWorkflow<TInput, TWire>>;
  loadMaterializer: () => Promise<IHomeSourceMaterializer<TWire, TModel>>;
  plan: {
    priority: IHomeRequestPriority;
    polling?: {
      foregroundMs: number;
    };
    background: "pause" | "finalOnly" | "continueLowRate";
  };
  cache:
    | false
    | {
        ttlMs: number;
        hydrate: "critical" | "visible" | "lazy";
        maxRows: number;
        maxBytes: number;
        maxIdentityEntries: number;
        loadCacheCodec: () => Promise<IHomeSourceCacheCodec<TModel>>;
      };
};

type IHomeSourceMaterializer<TWire extends IRuntimeJsonValue, TModel> = {
  materialize(
    wire: TWire,
    previous: TModel | undefined
  ): IHomeMaterializedResult<TModel> | Promise<IHomeMaterializedResult<TModel>>;
};

type IHomeSourceCacheCodec<TModel> = {
  project(model: TModel): IRuntimeJsonValue | undefined;
  restore(value: IRuntimeJsonValue): TModel | undefined;
};

type IHomeProjectorDefinition<TOutput> = {
  id: IHomeProjectorId;
  dependencies: readonly IHomePresentationDependency[];
  project(inputs: IHomeProjectorInputs, previous: TOutput | undefined): TOutput;
  isEqual?(left: TOutput, right: TOutput): boolean;
};
```

Projector `isEqual` is optional and must be constant-time reference/revision or
bounded shallow-field comparison. It cannot call a generic deep-equality
helper.

`TWire` must be JSON-compatible on every target. `TModel` exists only in main
and may contain structurally shared application models. Cache codecs operate on
`TModel` but are imported through a separate lazy edge and must not import
network services, React, or UI.

There are exactly three supported extension paths:

| Change type            | Required registration                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Pure display component | scoped selector + lazy UI/native slot registration                                                               |
| Pure derived section   | projector + output context atom + lazy UI/native slot; no scheduler or snapshot source                           |
| Remote section         | service-owned wire descriptor/handler + source workflow + materializer + optional cache codec + projector + slot |

The source, projector, cache-codec, and UI registries are separate static typed
registries. Hydrating a cache chunk must not import the remote workflow or
renderer. Adding one source must not eagerly load every section on web,
desktop, or Extension.

Renderable Home and derived projector output continues to use the existing
feature context atoms in
`packages/kit/src/states/jotai/contexts/home/atoms.ts`. The rewrite must not
create plain Jotai atoms or new atom directories under `views/Home`.

Wire source IDs have one canonical const in `@onekeyhq/shared`; TypeScript types
and validators derive from it. Unknown non-critical snapshot chunks are skipped
rather than invalidating an entire manifest. Each source owns its data schema
version.

Package ownership is fixed:

| Package                       | Allowed ownership                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `@onekeyhq/shared`            | JSON wire IDs/envelopes, runtime request/cancel/outcome types, validators                  |
| `@onekeyhq/kit-bg`            | generic physical Pool and service-owned leaf wrappers; no Home section branching           |
| `@onekeyhq/kit`               | session reducer, middleware, logical scheduler, sinks, registries, projectors, cache ports |
| app packages                  | lifecycle composition and app-owned native slot registration                               |
| `@onekeyhq/native-components` | renderer/protocol bridge only; no Home service, Store, scheduler, or lifecycle authority   |

Static import-boundary tests enforce this table.

## 18. Cache and Snapshot Ownership

The rewrite keeps the proven CacheV2 ordering, atomicity, retention, and
confirmed-cache semantics, removes React ownership, and replaces immediate
parallel post-bootstrap warming with controlled sequential background warming.

The hydration matrix is frozen:

| Tier             | Contents and trigger                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `critical`       | navigation and minimal shell only; Native synchronous bootstrap                             |
| `visible`        | banner and the currently selected Home section, after the first frame                       |
| `lazy`           | Perps, DeFi, NFT, History, Market, and non-selected section chunks on direct section demand |
| `backgroundWarm` | one non-visible section at a time after first-frame stability and runtime-idle admission    |

Cold start must not immediately or concurrently warm Perps, DeFi, NFT, History,
and Market. Once the first frame is stable, the runtime may automatically warm
them in bounded order so the first section switch remains fast.

A background warm task is eligible only when:

- the first confirmed Home frame has been acknowledged;
- the visible section has produced its first useful result or a terminal
  no-data/error result;
- app activity is `active` and the Home surface is `visible`;
- no interactive task is pending or running;
- the effect queue is empty and result-buffer count/bytes are below their low
  watermarks;
- the host idle adapter has yielded at least one idle turn after interactions;
- no native memory warning or host resource-pressure signal is active.

If a platform exposes no memory-pressure API, the scheduler still enforces the
queue, byte, source-result, and cache bounds; absence of that optional signal
does not create an unbounded fallback.

Warm execution rules:

1. run at `background` priority and admit at most one warm source workflow per
   Home runtime;
2. prefer the user's selected/preferred or most recently visited section,
   followed by the remaining static registry order;
3. hydrate the confirmed cache first; perform live revalidation only when the
   source TTL/deadline requires it;
4. use the same physical request Pool, request-bound ResultSink,
   materialization yielding, and Store-scoped commit budget as visible work;
5. promote and deduplicate the same workflow if the user opens that section
   while it is warming;
6. pause or cancel on user interaction, owner/session change, Home becoming
   hidden/background/detached, queue pressure, or memory/resource pressure;
7. resume by recomputing eligibility and deadlines rather than replaying all
   skipped warm work at once.

Preferred-tab information selects the first eligible warm candidate; it does
not hydrate every lazy chunk together. First navigation to any section remains
cache-first and is part of its acceptance test.

Native synchronous bootstrap has an executable hard boundary:

```text
allowed keys: owner route/manifest + critical chunk only
manifest raw bytes: <= 32 KiB
critical raw bytes: <= 128 KiB
synchronous source chunks: 0
```

Banner and Portfolio records are not synchronously read during bootstrap.
Their hydrate begins after the first committed frame. Any oversized,
malformed, missing, or unknown critical record is a cache miss; it is not
parsed synchronously.

The existing 100ms target is an observed degrade threshold, not a preemptive
timeout: a synchronous MMKV read or JSON parse cannot be interrupted once
started. The implementation checks byte metadata and elapsed time before each
allowed read and stops the bootstrap after the current bounded operation. A
snapshot miss never blocks middleware drain or live-source startup.

Shared limits begin with the existing CacheV2 bounds:

```text
critical chunk: 128 KiB
normal source chunk: 1 MiB
manifest: 32 KiB
retained bytes per owner: 4 MiB
retained bytes per storage namespace: 16 MiB
owner/routes retained per namespace: 16
source-runtime identity cache: 8 entries by default
```

Every source descriptor additionally declares `maxRows`, `maxBytes`, and
`maxIdentityEntries`. On byte pressure, the writer evicts oldest lazy chunks,
then oldest non-active owners; it never expands the limit or evicts the active
owner's critical chunk. It does not rely only on row counts. Oversized jobs are
rejected before entering the persist queue. These initial byte profiles may be
lowered or adjusted only with fixture and startup-memory evidence; hard bounds
remain mandatory.

Snapshot/cache rejection discards only disposable persistence work. It never
rejects, truncates, or rolls back the corresponding live source result in the
Home Store.

Other required semantics:

- prepared owner replacement remains atomic;
- web/desktop/Extension hydrate asynchronously;
- debounce, max-wait, flush, compact, reset, and bounded retention remain;
- confirmed-cache fallback, empty invalidation, terminal final phase, and
  source-revision stale rejection remain;
- the Store does not treat display snapshot data as lifecycle authority;
- a hidden staged wire result is bounded result data, not automatically a
  display snapshot; only a confirmed materialized display model may produce a
  normal snapshot job.

Ownership:

```text
Home Store middleware
  -> immutable owner-scoped persist job
  -> runtime/storage-namespace singleton writer
  -> platform snapshot repository
```

On iOS/Android/Extension, the Home display-snapshot writer is owned by main.
The bg runtime may return confirmed wire data but does not write Home display
manifests. Native MMKV/IndexedDB resources may be shared below JS, so ownership
is enforced by protocol, not by assuming a separate physical store.

Persist jobs contain:

```ts
type IHomeSnapshotSourceVersion = {
  sourceId: IHomeStoreSourceId;
  sourceDataRevision?: string;
  sourceConfirmedAt: number;
  capturedFromRequestSequence: number;
};

type IBoundedHomeSnapshotChunk = {
  sourceId: IHomeStoreSourceId;
  schemaVersion: number;
  byteLength: number;
  rowCount: number;
  value: IRuntimeJsonValue;
};

type IHomeSnapshotPersistJob = {
  ownerKey: string;
  sessionId: string;
  commitId: string;
  sourceVersions: readonly IHomeSnapshotSourceVersion[];
  projectedChunks: readonly IBoundedHomeSnapshotChunk[];
};
```

`sourceConfirmedAt` is captured when the source result becomes confirmed, not
when the persist job happens to execute. Store-local revision numbers are never
compared across tabs or renderer windows.

A writer singleton serializes only one JavaScript runtime. It is not a
cross-tab or cross-window lock. CAS conflict handling is:

1. re-read the current manifest;
2. compare freshness independently for each source;
3. replace a chunk only when the job can prove it is newer;
4. discard a provably older job chunk;
5. when freshness is incomparable, preserve the current chunk and discard the
   conflicting job chunk;
6. update manifest, route index, retention metadata, and chunk references in
   the same transaction/CAS boundary.

Display snapshots are disposable cache data, so an ambiguous job must lose
rather than risk a visible regression. Tests use multiple Stores, web tabs, and
desktop renderer writers with intentionally reordered completion.

The direct rewrite introduces a new snapshot schema version. Incompatible old
display snapshots are ignored and rebuilt. No compatibility decoder or data
deletion step is required.

The dormant legacy `HomeStoreSnapshotController` is deleted rather than
migrated.

## 19. Host Lifecycle Adapters

Common interface:

```ts
type IHomeHostLifecycleSnapshot = {
  appActivity: "active" | "inactive" | "background";
  surfaceVisibility: "visible" | "hidden" | "detached";
};

interface IHomeHostLifecycleAdapter {
  getSnapshot(): IHomeHostLifecycleSnapshot;
  subscribe(listener: () => void): () => void;
}

type IHomeHostResourcePressure = "normal" | "constrained";

interface IHomeHostSchedulingAdapter {
  scheduleIdle(
    callback: (budget: { timeRemainingMs(): number }) => void
  ): () => void;
  getResourcePressure(): IHomeHostResourcePressure;
  subscribeResourcePressure(listener: () => void): () => void;
}
```

Platform inputs:

| Platform    | Inputs                                                   |
| ----------- | -------------------------------------------------------- |
| iOS/Android | AppState, root tab, route focus, native surface lifetime |
| Web         | Page Visibility, pagehide, browser tab lifetime          |
| Desktop     | Electron window visibility and renderer lifetime         |
| Extension   | App epoch and popup/side-panel lifetime                  |

Idle scheduling uses `InteractionManager` or the platform idle primitive where
available, with a cancellable bounded timer fallback. The fallback still
allows only one warm workflow and bounded materialization per drain.
Resource-pressure reporting is optional at the host level: an unsupported
platform reports `normal`, while scheduler concurrency/entry limits and
disposable-cache bounds remain the mandatory safety boundary.

Mapping rules are normative:

- iOS/Android `AppState=background` wins over root-tab and route focus;
- a mounted but non-selected root tab or route is `hidden`, not `detached`;
- destruction of the native surface or Home Store lease is `detached`;
- Web `document.visibilityState=hidden` maps to `hidden`; `pagehide` or tab
  teardown maps to `detached`;
- Desktop window blur alone does not hide Home; minimized/hidden window state
  maps to `hidden`, and renderer teardown maps to `detached`;
- Extension popup/side-panel closure detaches that client, while an app-epoch
  restart creates entirely new runtime identities;
- `detached` always disposes task, result, effect, timer, and demand leases;
- IndexedDB flush during Web/Extension teardown is best-effort and cannot be a
  correctness dependency.

Timer correctness must use timestamps. Resume recalculates polling deadlines;
it must not synchronously replay every timer missed while a page or app was
suspended.

## 20. Complete Current-to-Target Migration Inventory

### 20.1 Runtime and provider ownership

| Current production owner                | Direct replacement                                        |
| --------------------------------------- | --------------------------------------------------------- |
| imperative `HomeSessionMachine`         | pure reducer sub-machine                                  |
| `HomeSessionCoordinator`                | Store session state + middleware runtime handler          |
| `HomeStoreControllerBridge`             | `HomeEnvironmentBridge` + Store runtime                   |
| `homeStoreControllerLease`              | `acquireHomeRuntime(store, config)` WeakMap lease         |
| `HomeBackgroundRecoveryRefreshProvider` | recovery events and middleware recovery handler           |
| `HomeWalletListProvider`                | non-React wallet-list environment adapter + recovery port |
| `HomeStoreSourceControllers`            | `HomeRuntimeRoot`                                         |
| `HomeReadySourceControllers`            | source plan and lazy typed registry                       |
| URL Account provider behavior           | immutable runtime mode `urlAccount`                       |

`HomeWalletListProvider` is fully replaced, not only its recovery callback.
The adapter preserves initial fetch, confirmed-result gating, Wallet/Account
event refresh, request identity, retries at 250/500/1000/2000/4000ms,
no-wallet resolution, and surface-readiness publication.

Runtime config is an immutable discriminated preset:

```ts
type IHomeRuntimeCapabilities = {
  sourceExecution: boolean;
  displaySnapshots: boolean;
  persistence: boolean;
  commands: boolean;
};

type IHomeRuntimeConfig =
  | {
      mode: "wallet";
      accountScope: IHomeWalletAccountScope;
    }
  | {
      mode: "urlAccount";
      accountScope: IHomeUrlAccountScope;
    };

const HOME_RUNTIME_CAPABILITIES = {
  wallet: {
    sourceExecution: true,
    displaySnapshots: true,
    persistence: true,
    commands: true,
  },
  urlAccount: {
    sourceExecution: false,
    displaySnapshots: false,
    persistence: false,
    commands: false,
  },
} as const satisfies Record<
  IHomeRuntimeConfig["mode"],
  IHomeRuntimeCapabilities
>;
```

Lifecycle authority may temporarily stop a capability, but callers cannot
construct contradictory static combinations such as URL Account with wallet
snapshot persistence enabled.

### 20.2 Sources, projectors, and persistence

| Current owner                                      | Direct replacement                                     |
| -------------------------------------------------- | ------------------------------------------------------ |
| `HomePortfolioStoreController`                     | Portfolio source runtime                               |
| `useTokenListReactivePipeline` lifecycle ownership | Portfolio materializer + TokenList demand service      |
| `useAllNetworkRequests` shared enumeration/cache   | `AllNetworkAccountRepository` + source leaf plans      |
| `useHomeStoreSourcePublisher` and source gateways  | request-bound `createHomeResultSink()`                 |
| `useHomeStoreControllerActions`                    | Store-bound dispatcher and command receipts            |
| `HomeNFTStoreController` / source hook             | NFT source                                             |
| `HomeDeFiStoreController` / source hook            | DeFi source                                            |
| `HomeHistoryStoreController` / source hook         | History source                                         |
| `HomePerpsStoreController`                         | Perps source                                           |
| `HomeMarketStoreController`                        | Market source                                          |
| `HomeBannerStoreController`                        | Banner source + command handler                        |
| `HomeCapabilityStoreController`                    | capability environment source/projector                |
| `HomeBalanceStoreController`                       | pure Balance projector                                 |
| `HomeAccountValuePersistenceController`            | Account Value persistence handler                      |
| `HomePortfolioControlPersistenceController`        | controls hydrate/persist handler                       |
| `HomeTokenListProviderMirror` family               | `TokenListStoreProvider` backed by Store/demand leases |

#### 20.2.1 TokenList Store and demand contract

The old Mirror is not retained, but its lifecycle behavior is deliberately
replaced rather than discarded:

```ts
type ITokenListStoreLease = {
  store: ITokenListJotaiStore;
  release(): void;
};

interface IHomeTokenListRuntime {
  acquireStore(input: {
    mode: "wallet" | "urlAccount";
    ownerScope: IHomeTokenListOwnerScope;
    consumerId: string;
  }): ITokenListStoreLease;
  acquireDemand(input: {
    ownerScope: IHomeTokenListOwnerScope;
    consumerId: string;
    reason:
      | "homeVisible"
      | "send"
      | "receive"
      | "assetSelector"
      | "native"
      | "externalRead";
    priority: IHomeRequestPriority;
  }): () => void;
}
```

`TokenListStoreProvider` is a normal Jotai context boundary backed by this
lease. It is not a compatibility wrapper and does not execute Portfolio
effects. The lease service owns:

- `homeTokenList` versus `urlAccountHomeTokenList` routing;
- `getOrCreateStore`;
- reference counting and delayed reset;
- cold-start hydrate;
- Native bg recovery tracker replay;
- owner/session disposal;
- arbitration between Home lifecycle demand and external consumer demand.

If Home is hidden but Send, Receive, Asset Selector, or Native owns a demand
lease, the Portfolio/TokenList source remains eligible at that demand's
priority. Releasing the final demand reconciles the source plan; React mount
state is not inspected by the source.

Home descendants rely on the root `homeVisible` demand. External routes acquire
`send`, `receive`, `assetSelector`, or `externalRead` demand only while that
route/surface is focused; merely remaining mounted in a hidden navigation tree
does not keep live refresh running. Every consumer in the inventory declares
whether it needs a Store lease only or a live demand lease.

A URL Account lease selects the URL-specific Store/producer contract. Its
demand never enables wallet Portfolio sources or wallet persistence.

The atomic cutover inventory for Mirror/provider consumers is:

```text
apps/mobile/src/home/MobileNativeHomeRenderer.tsx
packages/kit/src/components/MoreActionButton/index.tsx
packages/kit/src/components/TabPageHeader/DappHeader.tsx
packages/kit/src/components/TabPageHeader/MDHeader.tsx
packages/kit/src/views/AssetList/pages/TokenManagerModal.tsx
packages/kit/src/views/AssetSelector/pages/AggregateTokenSelector.tsx
packages/kit/src/views/AssetSelector/pages/TokenSelector.tsx
packages/kit/src/views/FiatCrypto/pages/Buy/index.tsx
packages/kit/src/views/Home/components/WalletActions/WalletActionMore.tsx
packages/kit/src/views/Home/components/WalletActions/ZeroBalanceWalletActions.tsx
packages/kit/src/views/Home/pages/DeFiContainer.tsx
packages/kit/src/views/Home/pages/HomeHeaderContainer.tsx
packages/kit/src/views/Home/pages/PortfolioContainer.tsx
packages/kit/src/views/Receive/pages/ReceiveSelector.tsx
packages/kit/src/views/Send/pages/SendAmountInput/SendAmountInputContainer.tsx
packages/kit/src/views/Send/pages/SendDataInput/SendDataInputContainer.tsx
packages/kit/src/views/Staking/components/TradeOrBuy.tsx
packages/kit/src/views/UniversalSearch/pages/UniversalSearch.tsx
packages/kit/src/views/Developer/pages/Gallery/Components/stories/ScanQrCode.tsx
```

Tests and old runtime mounts that import the Mirror, including
`HomeHeaderContainer.test.tsx`,
`HomeStoreSourceControllers.test.tsx`, and
`HomeStoreSourceControllers.tsx`, are updated or deleted in the same cutover.

The following infrastructure is migrated or removed only after lease parity is
tested:

```text
HomeTokenListProviderMirrorBase
HomeTokenListProviderMirror
UrlAccountHomeTokenListProviderMirror
HomeTokenListProviderMirrorWrapper
HomeTokenListRootProvider
UrlAccountHomeTokenListProvider
JotaiContextStoreMirrorTracker
JotaiContextRootProviderRenderer
jotaiContextStore mirror-tracker behavior
```

Generated `apps/mobile/out-dir-bundle/**` files are never edited manually.
They are regenerated by the normal build or excluded from production-source
reference scans.

#### 20.2.2 All Networks account repository

`AllNetworkAccountRepository` is a plain non-React repository shared by
Portfolio, NFT, and DeFi source workflows. It preserves:

- 15-second base account-enumeration TTL;
- 100-entry bounded LRU/age sweep;
- in-flight Promise deduplication;
- no caching of empty or failed results;
- enabled-network global invalidation;
- wallet-scoped invalidation on `AddDBAccountsToWallet`;
- rerun-after-current with merged refresh options;
- `skipAccountsCache`, `ignoreDisabled`, and explicit-refresh semantics;
- cold/warm ordering and scheduler-controlled leaf concurrency.

The repository returns account-enumeration data only. It does not start Home
sources, subscribe to React lifecycle, or perform section materialization. It
lives in `@onekeyhq/kit` and calls the background service through an injected
port; it is not moved into `@onekeyhq/shared` or made business state of the
generic `@onekeyhq/kit-bg` Pool.

#### 20.2.3 Stringify/deep-comparison migration ledger

The current production inventory contains stringify/deep-comparison ownership
in all of these areas. Each row requires an explicit replacement or a reviewed
boundary-serialization exemption:

| Area                              | Current files/symbol groups                                                                                                         | Required migration                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| reducer and invariants            | `homeStoreReducer.ts`, `homeStoreInvariants.ts`, `homeStoreJson.ts`                                                                 | explicit revision/field comparison; delete stringify/parse clone helper |
| source publication                | `useHomeStoreSourcePublisher.ts`, source gateways                                                                                   | request/source revisions and incremental coverage metadata              |
| facts and capability              | `currentHomeBalanceFactsAdapter.ts`, `currentHomeCapabilityFactsAdapter.ts`, `homeCapabilityMatrix.ts`, `homeDisplayModelPolicy.ts` | typed scalar dependency tuple and monotonic revision                    |
| section source adapters           | Spot, Perps, Banner, NFT, Market, History, and DeFi source adapters                                                                 | declared scalar source-key builder; no serialized params fingerprint    |
| section controllers/materializers | Portfolio, DeFi, NFT, History, Market, Perps, Balance                                                                               | structural sharing, per-entity revisions, incremental changed IDs       |
| React/native decisions            | `MobileNativeHomeRenderer.tsx`, `HomeOverviewContainer.tsx`, `HomeHeaderContainer.tsx`, `useHomeWalletTabStore.ts`                  | scoped selector revisions and explicit decision fields                  |
| snapshot comparison               | `homeDisplaySnapshotPersistQueue.ts`, snapshot record comparison                                                                    | compare manifest descriptors/source revisions before boundary encode    |

The following uses are serialization boundaries, not equality mechanisms, and
may remain after confirming that they are outside reducer/render/projector hot
paths:

- CacheV2 and Store snapshot codec encode/decode;
- RPC/runtime transport encode/decode;
- URL Account persisted route formats;
- Banner typed-data signing and other deterministic crypto serialization.

An allowlisted boundary codec must not export its serialized string as a
revision, selector dependency, React key, or Store equality token.

### 20.3 Commands and UI effects

The following must stop importing or inspecting `IHomeStoreEffect`:

- `useHomeBannerIntents`
- `useHomeDeFiIntents`
- `useHomeHistoryIntents`
- `useHomeMarketIntents`
- `useHomePerpsIntents`
- `useHomePortfolioIntents`
- `useHomeRefreshIntents`
- `HomePortfolioControlPersistenceController`
- `MobileNativeHomeRenderer`

Command ownership:

| Command class                 | New owner                                     |
| ----------------------------- | --------------------------------------------- |
| refresh/loadMore              | middleware -> source                          |
| source action succeeded       | middleware -> dependent source plan           |
| navigation/open details       | middleware -> injected navigation port        |
| Market favorite               | Market command/persistence handler            |
| Banner dismiss/snooze/bind    | Banner command/persistence handler            |
| Perps preparation/navigation  | Perps command handler + navigation port       |
| native handoff/refresh status | Store command state with correlation identity |

UI may await a typed command completion, but it never receives or executes an
effect:

```ts
type IHomeCommandCompletion<TResult> =
  | { kind: "completed"; value: TResult }
  | { kind: "failed"; errorCode: string }
  | { kind: "cancelled"; reason: "ownerChanged" | "disposed" | "superseded" }
  | { kind: "timedOut" };

interface IHomeCommandClient {
  execute<TResult>(intent: IHomeCommandIntent<TResult>): {
    receipt: IHomeDispatchReceipt;
    completion: Promise<IHomeCommandCompletion<TResult>>;
  };
}
```

The completion promise is resolved exactly once. Pending callers are cancelled
on owner change or runtime disposal; they are never left waiting on a removed
controller.

Command behavior matrix:

| Command family                          | Accepted when                                             | Completed value / side effects                                                                   | Failure and cancellation                                                      |
| --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| refresh/loadMore                        | source applicability and request policy accept the intent | `void` after the requested final/terminal source outcome                                         | typed failure; owner change cancels caller and source task                    |
| shell balance                           | current owner accepts the intent                          | updated `hideValue` after settings persistence                                                   | rollback Store command status and report typed failure                        |
| open asset/NFT/DeFi/History/Market/Earn | payload and current authority validate                    | `void` when navigation port accepts the route                                                    | no navigation on stale authority                                              |
| Banner open                             | current banner item and injected non-React port validate  | `void`; port performs open action                                                                | typed failure; no React hook ownership                                        |
| Banner dismiss/snooze                   | current item validates                                    | write-through persistence, Store update, dependent refresh when required                         | optimistic state must declare rollback                                        |
| Banner bind referral                    | current referral item validates                           | typed-data build, signing, submit, cache invalidation, rookie task update, and one success Toast | signing/submit error produces one owner-scoped failure and one error owner    |
| Market add/remove/toggle                | current Market command validates                          | preserve `Promise<boolean>` behavior as completion `value`                                       | failed/cancelled returns no false success and rolls back optimistic state     |
| Perps prepare deposit                   | current Perps account validates                           | prepared account returned in completion before deposit UI opens                                  | stale/disposed preparation cannot navigate or open modal                      |
| Perps navigation                        | current instrument validates                              | navigation port call plus required delayed Perps events                                          | timers are owned and cancelled by middleware                                  |
| Native refresh/handoff                  | native request ID and owner/session validate              | native completion/feedback exactly once                                                          | failed, timed out, owner-changed, and disposed requests complete exactly once |

Home-internal command success dispatches directly into the Store/runtime.
Global app events are emitted only when an external non-Home consumer still
requires them; middleware must not round-trip a Home command through the event
bus to trigger its own source.

### 20.4 Cache

| Current owner                                | Direct replacement                            |
| -------------------------------------------- | --------------------------------------------- |
| prepared load in `HomeStoreControllerBridge` | runtime snapshot bootstrap                    |
| `HomeDisplaySnapshotController.native`       | Native repository adapter                     |
| `HomeDisplaySnapshotController.shared`       | async repository adapter                      |
| `homeDisplaySnapshotPersistQueue`            | retained singleton writer without React owner |
| `HomeSectionCoordinator`                     | source runtime cache/generation state         |
| dormant `HomeStoreSnapshotController`        | delete                                        |

Replacing `HomeSectionCoordinator` preserves these exact contracts:

- at most 8 cached identities per source runtime with LRU touch/eviction;
- owner A -> B -> A may reuse A's exact confirmed cache while valid;
- cache keys include the complete source identity, not only owner;
- source revision and request sequence reject regressions;
- phase is monotonic and `final` is terminal for one request sequence;
- loading, partial, and error may fall back only to the exact confirmed cache;
- confirmed empty invalidates the exact cache entry;
- dispose permanently rejects future publication;
- cache payloads, rows, and bytes obey the source and runtime bounds.

## 21. Event Ingress Migration Ledger

Every production event has one subscription owner after cutover.

| Current event                                | Class            | Sole target owner and behavior                                                                               |
| -------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------ |
| WalletUpdate / AccountUpdate / AccountRemove | external ingress | wallet-list environment adapter; owner/source-plan and Banner invalidation                                   |
| AddDBAccountsToWallet                        | external ingress | wallet-scoped `AllNetworkAccountRepository` invalidation and Portfolio/NFT/DeFi plan reconcile               |
| EnabledNetworksChanged                       | external ingress | capability invalidation, All Networks repository invalidation, and Portfolio/NFT/DeFi enumeration reconcile  |
| AccountDataUpdate                            | external ingress | owner-scoped source refresh plan                                                                             |
| NetworkDeriveTypeChanged                     | external ingress | scoped source refresh plan                                                                                   |
| GlobalDeriveTypeUpdate                       | external ingress | Perps derive cache invalidation and Perps plan reconcile                                                     |
| RefreshTokenList                             | mixed            | external adapter refreshes Portfolio and DeFi input cache; Home-internal producers dispatch directly         |
| RefreshHistoryList                           | mixed            | external adapter creates History refresh command; Home-internal producers dispatch directly                  |
| HistoryTxStatusChanged                       | external ingress | History reload/reconcile                                                                                     |
| ClearLocalHistoryPendingTxs                  | external ingress | History pending-row removal followed by exact source reconciliation                                          |
| DeFiPositionRefreshed                        | external ingress | DeFi scoped position refresh/incremental result                                                              |
| RefreshMarketWatchList                       | mixed            | external adapter creates Market refresh command; internal Market command dispatches directly                 |
| AddressBookUpdate                            | external ingress | account-name/address presentation cache invalidation                                                         |
| LocalPendingTxConfirmed                      | external ingress | Perps deposit reconciliation event                                                                           |
| native background ready/recovered            | host ingress     | runtime recovery lifecycle event                                                                             |
| SwitchWalletHomeTab                          | external ingress | navigation intent                                                                                            |
| TabListStateUpdate                           | mixed            | external adapter only for non-Home producer; Home source publishes directly                                  |
| HomePageReady                                | Home outbound    | emit once after first confirmed frame for Splash/external consumers; TokenList cleanup is scheduled directly |
| AccountValueUpdate                           | Home outbound    | persistence completion event for external consumers only                                                     |
| PerpSwitchActiveInstrument                   | Home outbound    | Perps navigation port emits for external Perps UI consumers                                                  |
| PerpSwitchInfoPanelTab                       | Home outbound    | delayed Perps navigation port event with middleware-owned timer                                              |

Each adapter must define:

- subscription owner;
- producer class: external, Home-internal, or Home-outbound;
- owner/session scope;
- coalescing policy;
- dispose behavior;
- whether it refreshes one source or reconciles the source plan.

For `mixed` events, the adapter accepts only externally produced traffic.
Home-internal producers use direct typed dispatch so the same action cannot be
processed once directly and again through the global event bus.

### 21.1 Source behavior parity ledger

Direct rewrite does not mean dropping current business behavior. Each source
must preserve or intentionally replace the following behavior before cutover:

| Source                | Required parity                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Portfolio             | per-network cache floor, 350ms LWW, bg cells ingest, LP/risk/custom/local/aggregate tokens, Account Worth, All Networks         |
| NFT                   | local cache -> live transition, All Networks state, tab-list state, polling, recovery                                           |
| DeFi                  | SimpleDB floor, local overview/currency projection, force-refresh quota, actions, provided-account cache                        |
| History               | local address/transaction cache, first page/load more, indexer, soft timeout, token gate, post-fetch DeFi refresh               |
| Perps                 | derive-type cache, bg portfolio snapshot, polling, pending-deposit retry, confirmed-transaction input                           |
| Market                | basic config, asset/perps lists, category request cache, watchlist refresh, polling                                             |
| Banner                | local floor, remote/referral/bot eligibility, session dismissals, write-through cache, signing/toast commands                   |
| Capability            | enabled-network changes, visible refresh, bounded retry, Perps destination                                                      |
| Balance               | Portfolio/DeFi/Perps/Banner/currency/capability contribution rules                                                              |
| TokenList runtime     | Wallet/URL Store routing, reference-counted lease, delayed reset, cold hydrate, Native recovery replay, external demand         |
| AllNetwork repository | 15s/100-entry cache, Promise dedup, empty/error exclusion, enabled-network and wallet invalidation, rerun-after-current         |
| Portfolio controls    | once-per-session hydrate, persisted LP filter -> Store, Store -> persistence, readiness gate, rejected hydrate behavior         |
| Account Value         | wallet/All Networks/unbacked-wallet clearing, currency conversion, `hasValue` threshold, three profile-write modes, `updateAll` |
| Wallet list           | initial fetch, confirmed gating, retry sequence, wallet/account events, no-wallet state, recovery and surface readiness         |
| Snapshots             | critical/visible/lazy hydrate, generation, partial/error/confirmed-cache semantics, flush/compact/reset                         |

`HomeSectionCoordinator` generation, bounded cache, partial/error, and
confirmed-cache behavior is preserved by the source-runtime contract in
Section 20.4 and its parity tests.

The CacheV2 behavior intentionally replaced by this handoff is immediate
parallel hydration of Perps, DeFi, NFT, History, and Market during bootstrap.
These sources now use the visible/lazy/controlled-warm policy in Section 18.
This preserves automatic warming without allowing it to compete with the first
frame or create a five-source materialization and Store-write burst.

## 22. Direct Rewrite Execution Plan

These are dependency checkpoints on one rewrite branch, not separately
shippable compatibility phases.

### Checkpoint A: Freeze contracts and behavior

Create auditable ledgers for:

- provider modes;
- session transitions;
- event ingress;
- command accepted/completed/failed/return-value semantics;
- source dependencies;
- full-payload stringify/deep-comparison inventory, replacement strategy, and
  boundary-serialization allowlist;
- TokenList Store and external-demand ownership;
- logical-workflow versus physical-leaf request descriptors;
- cache/hydration semantics;
- cross-tab freshness comparison;
- Debug reproduction steps.

Add tests around the current expected behavior before deleting owners.

### Checkpoint B: Build the new runtime off the production render path

Implement:

- Store runtime lease;
- Store-bound dispatcher;
- pure session machine;
- effect middleware;
- host lifecycle adapters;
- request scheduler;
- JSON leaf request/cancel/response protocol;
- multi-client shared request pool and fairness contract;
- request-bound result sink and Store-scoped commit budget;
- source, projector, persistence, and environment ports.

The new runtime may be unit-tested while disconnected. It must not start a
second production request tree.

### Checkpoint C: Move lifecycle, recovery, and cache

Move as one authority set:

- owner/session publication;
- single/split runtime handshake;
- visibility and app activity;
- native recovery sequence and claims;
- wallet-list barrier;
- surface commit acknowledgement;
- prepared snapshot bootstrap;
- display snapshot hydration and persistence.
- per-source cross-tab freshness and CAS merge;
- TokenList Store lease and Native recovery replay.

Delete `HomeSessionCoordinator`,
`HomeBackgroundRecoveryRefreshProvider`, and snapshot React ownership only
after their complete behavior is present in the new runtime.

### Checkpoint D: Move every source and command

Dependency order inside the rewrite:

```text
Capability and Portfolio controls
  -> AllNetworkAccountRepository
  -> Portfolio, TokenList Store, and external demand
  -> NFT
  -> Banner
  -> Market
  -> Perps
  -> DeFi
  -> History
  -> Balance projector
  -> Account Value persistence
```

For each source, move request, polling, event ingress, recovery, cache,
commands, progressive publishing, and error handling together. Do not activate
the new producer until the complete source behavior is ready.

The event ledger and command matrix are executable checklists. An event or
command is not migrated until its old producer/subscriber, return value,
completion, owner-switch, and disposal semantics are accounted for.

### Checkpoint E: Move render ownership

Implement:

- dispatch-only UI intent hooks;
- command status selectors;
- section-scoped React renderers;
- Mobile Native slot bridges;
- explicit presentation dependencies;
- Wallet and URL Account runtime modes;
- URL Account TokenList Store routing;
- external TokenList demand consumers.

### Checkpoint F: Atomic production cutover

In the same final change set:

1. mount `HomeRuntimeRoot`;
2. route all UI dispatch through the new dispatcher;
3. activate the new source plan;
4. remove the old source/controller mounts;
5. remove old effect consumers;
6. remove legacy coordinator and recovery provider;
7. remove old command polling;
8. remove old snapshot React controllers;
9. remove obsolete source hooks and Home-internal event-bus round trips;
10. remove old TokenList Mirror/provider/tracker ownership after lease parity;
11. regenerate build artifacts where required;
12. run production-reference scans and architecture tests.

The branch is not complete if the old runtime remains available as fallback.

## 23. Tests and Static Enforcement

### 23.1 Session machine

- owner creation waits for a producer;
- valid handshake makes the authority ready;
- owner change cancels the old session before starting the new one;
- visibility and app activity remain orthogonal;
- hidden -> visible recalculates deadlines;
- runtime recovery preserves sequence/claim rules;
- degraded retry behavior is deterministic;
- stopped sessions reject further work.

### 23.2 Middleware

- Store mutation occurs before effect execution;
- every effect is delivered exactly once by identity;
- the same input state/event sequence produces the same ordered effect IDs;
- reducers do not read time, random values, or external counters;
- a long source does not block cancellation;
- re-entrant result dispatch preserves FIFO boundaries;
- executor failure produces a typed completion/failure event;
- one runtime lease exists per Store;
- StrictMode replay does not create two runtimes;
- disposal releases handlers and rejects new effects;
- middleware owns no renderable state.

### 23.3 Scheduler and request pool

- physical leaf concurrency never exceeds the configured target;
- measured concurrency surrounds actual service network/database leaves, not
  only main-to-bg RPC calls;
- interactive work retains reserved capacity;
- priority aging prevents starvation;
- logical pending count never exceeds 64 per Home runtime;
- physical pending count never exceeds global or per-client bounds;
- two or more clients receive round-robin progress and one cannot evict the
  other's accepted work;
- overflow supersedes only eligible same-client background work, otherwise
  rejects deterministically;
- `takeLatest`, `exhaust`, and `queue` return typed outcomes;
- logical cancellation never reports a business error;
- non-abortable work retains its physical slot until settle;
- session cancellation drops pending work and supersedes late results;
- cancellation identity includes app epoch, client, session, group, and task;
- a cancel from client A cannot terminate client B or a newer app epoch;
- split-runtime envelopes round-trip through JSON validators and contain no
  function, `AbortSignal`, Store object, or Home source implementation;
- nested workflow scheduling cannot deadlock;
- timeout and disposal release all timers and closures.

### 23.4 Result sink and Store

- sources cannot obtain a raw dispatcher;
- every sink is bound to complete owner/app-epoch/client/session/producer/source/
  source-key/request-sequence/source-revision/request-group/task authority;
- stale wire responses are rejected before `materialize()` is called;
- authority is revalidated after asynchronous materialization;
- terminal final and monotonic revision/phase rules are preserved;
- finals are never lost after capacity admission;
- Portfolio intermediate commits obey the 350ms bound;
- hidden work produces no intermediate commit;
- hidden final work stages only the latest bounded wire result and does not
  construct a render model by default;
- old-authority buffers are discarded before materialization;
- Store publication count never exceeds its bound;
- simultaneous Portfolio/NFT/DeFi/History finals produce no more than one
  visible atomic commit dispatch per frame;
- valid final publications are never rejected because of their byte size;
- unchanged semantic values produce no mutation;
- unchanged entities retain reference identity and changed entities replace
  only their own references;
- result revision/coverage metadata is produced during materialization, not by
  a second serialize/hash pass;
- cold launch, progressive updates, account switching, and bottom-tab
  switching execute zero full-payload stringify/deep-equality calls in the
  reducer/result/projector/render path;
- resource and section mutations are atomic;
- reducer hot paths perform no deep stringify or clone.

### 23.5 Source parity

Each source has tests for:

- input and applicability;
- local/cache floor;
- live request;
- progressive/final behavior;
- polling;
- event-bus refresh;
- recovery refresh;
- owner/session change;
- stale completion;
- command behavior;
- cache projection/restore;
- disposal.

Portfolio additionally covers:

- per-network cache floor;
- 350ms LWW;
- BG token cells ingest;
- LP/risk/custom/local/aggregate tokens;
- Account Worth;
- All Networks state.

Additional parity suites cover:

- AllNetwork repository TTL, 100-entry bound, in-flight dedup, empty/error
  exclusion, both invalidation events, rerun-after-current, and refresh flags;
- TokenList Wallet/URL routing, lease ref-count/reset, cold hydrate, Native
  recovery replay, hidden Home with Send/Receive demand, and final-demand
  release;
- Portfolio controls once-per-session hydrate, readiness gate, persistence
  round trip, and rejected hydrate;
- Account Value clearing variants, currency conversion, `hasValue`, profile
  write variants, `AccountValueUpdate`, and `updateAll`;
- wallet-list retry sequence, confirmed gating, no-wallet state, event refresh,
  recovery barrier, and surface readiness;
- HomeSection runtime identity LRU, A -> B -> A reuse, exact cache fallback,
  empty invalidation, final terminal phase, revision regression, and dispose.

### 23.6 Cache

- prepared owner replacement is atomic;
- Native bootstrap reads only manifest + critical, never Banner/Portfolio;
- manifest over 32 KiB or critical over 128 KiB is a cache miss before parse;
- maximum valid Native bootstrap fixture meets the observed budget without
  blocking middleware drain;
- shared async hydration preserves tier order;
- no background warm starts before every Section 18 eligibility gate passes;
- after eligibility, at most one warm source workflow runs per Home runtime;
- preferred/recent ordering is deterministic and remaining sources warm
  sequentially;
- opening a warming section promotes/deduplicates its task instead of starting
  a second workflow;
- interaction, hidden/background/detached lifecycle, owner change, queue
  pressure, and memory/resource pressure pause or cancel warming;
- resume recomputes TTL/deadlines and does not replay all skipped warm tasks;
- warm results obey the same materialization and Store commit budgets;
- first demand for every section remains cache-first whether or not its warm
  task already ran;
- unknown optional chunks are skipped;
- stale persist jobs lose per-source CAS comparison;
- incomparable job chunks lose without replacing current chunks;
- route index, retention, manifest, and chunks commit atomically;
- owner and namespace byte limits evict deterministically;
- multiple Stores, web tabs, or desktop windows cannot regress one owner
  manifest under reordered completion;
- flush, compact, reset, and cold-start behavior remain;
- incompatible old display snapshots are ignored without clearing app data.

### 23.7 Render isolation

- an NFT-only result does not rerender Portfolio, Perps, DeFi, History, or
  Market unless an explicit dependency exists;
- declared dependencies rerun only their projector and slot;
- unchanged slot reference and revision remain stable;
- bottom-tab changes do not remount a source tree;
- Mobile Native host does not subscribe to all section payloads.
- hidden Home with an external TokenList demand refreshes TokenList without
  rerendering unrelated Home slots.

### 23.8 Static architecture guards

Fail when:

- `model/sources/` imports React, Home hooks, or Home Jotai hooks;
- the scheduler or request pool imports section modules;
- `@onekeyhq/shared` runtime envelopes import any OneKey package;
- `@onekeyhq/kit-bg` Pool code imports kit, components, native-components, or
  Home source IDs;
- a split-runtime envelope contains a non-JSON value;
- UI code imports or switches on `IHomeStoreEffect`;
- a reducer/projector calls timers, background services, or async functions;
- reducer, result sink, materializer, projector, selector, native slot,
  command, lifecycle, or Store-invariant paths use `JSON.stringify`,
  `stableStringify`, stringify/parse cloning, `cloneDeep`, or generic
  `isEqual` for live equality/revision work;
- a source adapter builds its request key or coverage revision by serializing
  the complete params, row IDs, or result payload;
- a boundary codec's serialized value flows back into Store equality,
  selector dependencies, React keys, or native slot revisions;
- a source receives a raw Store dispatcher;
- old controller forest files have production imports;
- more than one runtime can be acquired for one Store;
- platform-specific code violates package import hierarchy.

The static rule uses an explicit allowlist for transport codecs, snapshot
codecs, persisted URL formats, and deterministic signing code. It must not ban
the serialization that those boundaries actually require.

### 23.9 Commands, event ingress, and platform contracts

- every command in Section 20 has accepted/completed/failed/cancelled tests;
- Market completion preserves its boolean result;
- Perps preparation returns the prepared account before navigation;
- pending command callers complete exactly once on owner change and dispose;
- Banner bind owns signing, invalidation, task update, and exactly one Toast
  outcome;
- Native stale intent is rejected, rejected tab selection rolls back, and
  refresh feedback completes exactly once for success/failure/timeout/cancel;
- URL Account mode disables wallet sources/commands/persistence/snapshots,
  selects `urlAccountHomeTokenList`, keeps session/facts/navigation available,
  and never shares a runtime or Store lease between two distinct URL Account
  containers;
- every Section 21 event has one adapter owner and Home-internal production
  cannot round-trip through the global event bus;
- iOS/Android background overrides route visibility;
- Web hidden/pagehide and Desktop blur/hidden/teardown map to the documented
  lifecycle facts;
- Android process death starts a cold runtime with no restored task/effect/
  result authority;
- Extension app-epoch restart creates new identities and empty scheduler,
  result, effect, and demand queues before handshake.

## 24. iOS Debug Verification

Debug verification is mandatory for this rewrite and must preserve the existing
simulator data.

### 24.1 Launch

Use:

```bash
yarn app:ios
agent-device open --platform ios
```

If the app is already installed, do not uninstall it. Do not erase the
simulator. Rebuild or Metro reload in place.

Before interactions:

- clear only transient diagnostic logs, not app data;
- wait for Metro reload to finish;
- capture a screenshot showing stable Home;
- disable the development performance overlay if it intercepts taps;
- prefer `testID` selectors over translated text or coordinates.

### 24.2 Required scenario

Run in this order:

1. terminate and relaunch the app with Account #3 / All Networks preserved;
2. confirm Wallet Home accepts input during initial loading;
3. switch Account #3 -> #1 -> #2 -> #3;
4. repeat Account #1 -> #2 -> #3 -> #1 at least five times;
5. switch Wallet -> Trade -> Perps -> Discover -> Wallet at least five times;
6. switch Portfolio, Perps, DeFi, NFT, History, and Market sections;
7. trigger manual refresh;
8. background and foreground the app;
9. repeat an account switch after foreground recovery.

Capture screenshots and logs after:

- cold launch;
- first successful Account #3 render;
- the fifth account loop;
- the fifth bottom-tab loop;
- foreground recovery.

### 24.3 Debug pass conditions

Functional:

- the app remains responsive;
- account and tab input is processed;
- no redbox or uncaught error appears;
- cached data and progressive loading remain coherent;
- previous-owner rows never appear under the current account;
- native refresh feedback completes.

Runtime:

- running leaf tasks never exceed the configured limit;
- logical, global physical, and per-client pending tasks remain bounded;
- actual service leaf counts match Pool accounting;
- old sessions reach zero running/pending work after settlement;
- Store publication entries remain bounded;
- cross-source Store commit rate follows the one-dispatch-per-frame policy;
- background warm begins only after the first-frame/idle gates and never runs
  more than one warm workflow at once;
- account or bottom-tab interaction preempts warm work without delaying input;
- hidden Home produces no intermediate commits;
- hidden Home without external demand starts no TokenList refresh;
- hidden Home with an explicit Send/Receive demand refreshes only the required
  TokenList source path;
- full-payload stringify/deep-equality counters remain zero in live
  reducer/result/projector/render paths;
- no repeated source restart loop occurs at stable state;
- effect queue depth returns to zero;
- no old producer/controller starts.

Render:

- unrelated section render counters do not increase;
- unchanged native slot revisions remain stable;
- bottom-tab switching does not execute a whole source-controller tree.

Memory:

- Debug JS and process memory do not rise monotonically across five settled
  account loops;
- stopped-session task closures, timers, and result buffers are absent;
- old owner payloads are retained only by documented bounded caches;
- native image/VM growth is reported separately if it remains.

Debug builds include tooling overhead. Use relative trend and ownership
evidence rather than a production absolute memory threshold.

### 24.4 Evidence bundle

Attach:

- commit and branch;
- simulator model and iOS version;
- Debug build command;
- screenshots;
- relevant device/Metro logs;
- source start/cancel/settle counts;
- scheduler pending/running peaks;
- Store commits by source;
- boundary serialization and forbidden hot-path equality counters;
- section render counts;
- memory samples at each settled checkpoint;
- any remaining main-JS long-task stack.

## 25. Observability Contract

Use one privacy-safe Home runtime scope with:

```text
runtime
phase
sceneId
appEpoch
clientInstanceId
sessionSequence
sourceId
taskKeyHash
priority
policy
pendingCount
runningCount
resultBufferCount
effectQueueDepth
workKind
requestSequence
resultPhase
changeDetection
accepted
rejectReason
durationMs
commitCount
rowCount
hotPathFullSerializationCount
```

Do not log:

- wallet IDs;
- account IDs;
- addresses;
- xpubs;
- token or NFT contents;
- raw effect payloads;
- serialized Store or cache snapshots.

Required phases:

- `session-transition`
- `effect-enqueued`
- `effect-started`
- `effect-finished`
- `task-enqueued`
- `task-started`
- `task-cancelled`
- `task-superseded`
- `task-settled`
- `warm-eligible`
- `warm-started`
- `warm-paused`
- `warm-completed`
- `result-buffered`
- `result-committed`
- `source-result-accepted`
- `source-result-rejected`
- `runtime-disposed`

## 26. Subagent Audit Findings and Resolutions

| Audit question                  | Resolution in this handoff                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Is the design over-engineered?  | Keep three core roles; use ports and a static typed registry; no dynamic plugin framework.                             |
| Can it solve the current issue? | Address request, write, subscription, render, and synchronous CPU amplification together.                              |
| Can all old code be migrated?   | Exact TokenList consumers, events, commands, wallet-list, All Networks, cache, and recovery semantics are inventoried. |
| Is it cross-platform?           | JSON leaf protocol for split runtimes plus explicit per-tab/renderer, lifecycle, and snapshot rules.                   |
| Can it create new problems?     | Full authority sinks, cross-source commit bounds, multi-client Pool fairness, and per-source cache CAS.                |
| Is it extensible?               | Separate remote source, projector, cache-codec, persistence, environment, and UI registration paths.                   |

Specific audit defects resolved:

- session machine is a reducer sub-machine, not middleware shadow state;
- source publishing is forced through `HomeResultSink`;
- the sink binds the full request authority and validates before lazy
  materialization;
- cross-source publications share one bounded Store commit budget;
- logical scheduling is separated from physical request capacity;
- split-runtime leaf work uses JSON envelopes instead of `run(signal)`
  closures;
- the physical Pool has global/per-client limits and client fairness;
- physical cancellation is session-scoped;
- non-abortable work does not release its physical slot early;
- full-payload stringify/deep equality/clone is prohibited across live
  reducer, result, materializer, projector, selector, native slot, and command
  paths, with boundary-codec/signing allowlists;
- Native renderer aggregate subscriptions are replaced;
- background recovery is explicitly migrated;
- Balance, Capability, Banner, Account Value, controls, and TokenList ownership
  are explicitly mapped;
- TokenList Store lifecycle, URL routing, Native replay, and external demand
  replace the old Mirror behavior;
- All Networks enumeration cache/dedup/invalidation has a non-React repository
  owner;
- command return/completion and every missing event are explicitly mapped;
- raw effect consumers, including Mobile Native Renderer, are explicitly
  removed;
- snapshot persistence remains a runtime/namespace singleton;
- cache freshness is per source across tabs/windows, with ambiguous CAS jobs
  losing;
- Native synchronous bootstrap is critical-only with exact byte bounds;
- immediate parallel lazy-section warm is replaced by post-stable,
  scheduler-controlled sequential warm;
- URL Account mode is explicit;
- Extension restart behavior is documented as a host invariant;
- no compatibility or partial rollout remains.

## 27. Known Residual Risks

| Risk                                                  | Required control                                                                       |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Middleware becomes another all-knowing controller     | Small typed handlers and injected ports; no business transformation.                   |
| Source starts inner unrestricted fan-out              | Every expensive leaf request must use the shared pool.                                 |
| Main limits RPC count but bg fans out internally      | Pool wraps the actual service leaf; leaf-count integration tests.                      |
| One client fills the shared bg queue                  | Global/per-client bounds, round-robin fairness, no cross-client eviction.              |
| Large result still blocks main synchronously          | Revision identity, structural sharing, bg normalization, bounded yield.                |
| Stringify comparison is replaced by another deep walk | Explicit revisions, incremental entity diff, structural sharing, scoped static guards. |
| Several valid source finals still burst Store commits | One Store publication queue and one atomic visible dispatch per frame.                 |
| Automatic warm recreates the cold-start burst         | Post-stable gates, one warm workflow, interactive preemption, bounded cache retention. |
| Hidden final retains a large render model             | Stage bounded wire only; materialize on visible demand.                                |
| Priority policy starves background work               | Reserved interactive capacity plus aging.                                              |
| Multiple Stores race snapshot persistence             | One namespace writer and revision-aware CAS.                                           |
| Cross-tab revisions are incomparable                  | Per-source confirmed freshness; ambiguous job loses.                                   |
| Cache jobs retain large Store state                   | Immutable projected jobs with bounded payloads.                                        |
| Removing TokenList Mirror stops non-Home refresh      | Store lease plus explicit external consumer demand.                                    |
| Lazy registry regresses startup bundle                | Dynamic source/UI loading and separate registries.                                     |
| Native images remain the primary memory owner         | Separate ImageIO/VM evidence and bounded native image policy.                          |
| Debug succeeds but Release behavior differs           | Follow-up Release trace without changing runtime ownership.                            |

## 28. Removal Checklist

The rewrite is incomplete until production references are removed for:

- `HomeSessionCoordinator`;
- old imperative lifecycle authority;
- `HomeStoreControllerBridge`;
- `HomeBackgroundRecoveryRefreshProvider`;
- `HomeReadySourceControllers`;
- source execution in `HomeStoreSourceControllers`;
- `HomeStoreCommandController`;
- `HomeAccountValuePersistenceController`;
- `HomePortfolioControlPersistenceController`;
- `useHomeStoreSourcePublisher` and old source gateway factories;
- `useHomeStoreControllerActions`;
- old `homeStoreControllerLease` implementation;
- `useHomeBalanceFacts`;
- `useHomeWalletTabSupport`;
- `useHomeDeFiStoreSource`;
- `useHomeNFTStoreSource`;
- `usePerpsHomePortfolio`;
- React lifecycle ownership in `useTokenListReactivePipeline`;
- old source controllers and source hooks;
- source-owned polling timers and command polling;
- source-owned global-event subscriptions moved to Section 21 adapters;
- Home-internal event-bus round trips;
- `execution: 'caller' | 'controller'` command ownership branches;
- old pending command polling/ref sets/timers;
- UI inspection of `IHomeStoreEffect`;
- snapshot React controllers;
- dormant `HomeStoreSnapshotController`;
- `homeStoreJson` stringify/parse clone helper;
- reducer, invariant, source, projector, selector, command, and native-slot
  full-payload stringify/deep-equality helpers;
- serialized source params, row-ID arrays, decisions, and result payloads used
  as revision/fingerprint/dependency keys;
- serialized manifest equality in the persist queue, while retaining actual
  boundary codec serialization;
- aggregate Mobile Native Home section subscriptions;
- compatibility flags, adapters, and fallback runtime paths.
- `HomeTokenListProviderMirrorBase`;
- `HomeTokenListProviderMirror`;
- `UrlAccountHomeTokenListProviderMirror`;
- `HomeTokenListProviderMirrorWrapper`;
- old Mirror tracker/root-provider ownership after lease parity;
- every provider-shape consumer listed in Section 20.2.1.

## 29. Quality Gates

Before Debug launch:

- targeted unit and integration tests pass;
- source parity suites pass;
- static architecture guards pass;
- every Section 20.2.3 stringify/deep-comparison inventory row is resolved or
  is an explicitly allowlisted boundary codec;
- production-reference removal scan passes;
- comments added to code are English;
- `yarn agent:check --profile commit` passes for staged implementation files.

Before PR readiness:

- iOS Debug scenario passes on preserved data;
- Android targeted runtime and process-death tests pass;
- Web lifecycle, multi-tab snapshot CAS, and best-effort teardown tests pass;
- Desktop lifecycle and multi-window snapshot CAS tests pass;
- Extension app-epoch and same-epoch multi-client Pool fairness tests pass;
- no old runtime production import remains;
- live hot-path full-payload serialization/deep-equality counter remains zero
  in the required Debug scenario;
- no Mirror consumer or omitted event/command owner remains;
- `yarn agent:check --profile pr` passes.

## 30. Completion Definition

The rewrite is complete only when the sole production path is:

```text
host fact or UI intent
  -> Store-bound dispatcher
  -> pure Home reducer and HomeSessionMachine
  -> atomic Store mutations and typed effects
  -> HomeEffectMiddleware
  -> HomeRequestScheduler logical workflow
  -> JSON leaf envelope when the target is split-runtime
  -> SharedRequestPool around the actual service leaf
  -> request-bound, session-aware HomeResultSink
  -> pre-materialization authority validation
  -> incremental materializer with explicit revisions and structural sharing
  -> Store-scoped commit budget
  -> token-validated atomic Store event
  -> dependency-scoped projector
  -> split atom
  -> scoped renderer
```

Creating the named classes while retaining React-owned source execution,
aggregate subscriptions, raw effect consumers, full-payload stringify/deep
equality in any live main-JS path, or old fallback paths does not satisfy this
handoff.
