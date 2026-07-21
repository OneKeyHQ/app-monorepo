# Home State Model Refactor Plan / Handoff

> Status: superseded and completed by
> `HOME_UNIFIED_STORE_MIGRATION_HANDOFF.md`. Retained only as historical
> behavior and correctness evidence; do not restore its multi-authority or
> permanent Shadow design.
>
> Audited workspace: `codex/native-home-container`
>
> Audited HEAD: `54d97829640032351f278068760a68ca4502a482`
>
> Last updated: 2026-07-22

## 0. Read This First

This document hands off the cross-platform Home state-model refactor for:

- Web;
- Desktop;
- Browser Extension;
- Mobile React Native Legacy Home;
- iOS Native Home;
- Android Native Home.

The goal is not to make Native Home the source of truth. Native Home is one
renderer of the same shared Home semantics used by Legacy React Home.

Before implementation, read in full:

1. `AGENTS.md`;
2. `ANDROID_NATIVE_HOME_HANDOFF.md`;
3. this document;
4. `.skillshare/skills/1k-architecture/SKILL.md`;
5. `.skillshare/skills/1k-cross-platform/SKILL.md`;
6. `.skillshare/skills/1k-state-management/SKILL.md`;
7. `.skillshare/skills/1k-performance/SKILL.md`;
8. `.skillshare/skills/1k-dev-commands/SKILL.md`.

### 0.1 Workspace safety

The audited worktree contained multiple unrelated modified and untracked files.
They belong to the user or other tasks.

Implementation must not:

- switch, reset, clean, or stash the worktree;
- overwrite or revert unrelated dirty files;
- assume a dirty Home or native file belongs to this refactor;
- run `yarn app:ios` unless the user explicitly authorizes it in the
  implementation task;
- modify a simulator unless explicitly authorized;
- commit or push unless explicitly requested.

Always re-run these read-only checks before implementation:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

Line numbers in the current-problem map below refer to the audited worktree and
must be reverified if surrounding dirty files change.

## 1. Executive Decision

Legacy Home and Native Home must ultimately consume the same logical
`HomeSemanticModel`.

They do not share:

- the same JS object on split-runtime targets;
- renderer-local visual state;
- layout dimensions;
- scroll and gesture ownership;
- Dynamic Type measurement;
- hover, focus, or pressed behavior;
- Native slot implementation.

The recommended architecture is:

```text
Platform services / bg proxy / atoms
                ↓
        HomeRuntimeAdapter
                ↓
      HomeFacts + runtime events
                ↓
 HomeSessionActor + resource actors
                ↓
 Pure authority/capability/policy selectors
                ↓
        HomeSemanticStore
       ↙       ↓          ↘
    shell   navigation   sections
                ↓
        HomeSurfacePolicy
          ↙              ↘
 React renderer       Native DTO adapter
 Web/Desktop/Ext/RN   iOS/Android snapshot
```

### 1.1 State-machine decision

Use state machines, but only for temporal async lifecycles.

Recommend exactly two machine definitions:

1. `HomeSessionMachine` — one active instance per Home scope incarnation;
2. `ScopedResourceMachine<T>` — one generic definition, instantiated for each
   applicable source.

Do not create separate state machines for backup, balance presentation, tab
capability, or section presentation.

Use two small pure reducers:

1. `ConfirmedCacheReducer`;
2. `TabIntentReducer`.

Use pure selectors and decision tables for:

- backup presentation;
- balance aggregation completeness;
- confirmed/live/error authority;
- zero/funded classification;
- actions;
- banners;
- capability matrix;
- applicable tabs and ordering;
- selected-tab fallback;
- section hidden/loading/empty/ready/error;
- cache commit eligibility.

### 1.2 Machine admission rule

Put information in a machine only if:

1. it cannot be derived from current inputs; and
2. its current state changes which future events or side effects are allowed.

Otherwise keep it as a fact, selector, policy, decision table, or renderer-local
layout state.

## 2. Why the Current Model Is Not Predictable Enough

Today, tests can predict fragments of Home behavior, but not the complete
rendered state.

Reasons:

- the displayed number and zero/funded action state use different authority
  paths;
- confirmed cache, live worth, holdings evidence, session latches, and sticky
  fallback are combined at render time;
- capability and tab fallback decisions exist in both Legacy and Native paths;
- sections own independent async conventions;
- Native React host, Native DTO adapters, Swift, and Kotlin contain overlapping
  fallback behavior;
- snapshot data and React Native slots are separate update channels;
- many tests assert helper fragments or source-text contracts rather than the
  full semantic output.

Consequently, a unit test such as “balance is zero” does not by itself prove:

- which header is visible;
- which actions are visible;
- whether a positive banner remains;
- which tabs exist;
- what selected tab is effective;
- whether sections are loading or showing stale rows;
- whether Native is displaying a snapshot and slots from the same owner.

The refactor must make this functionally testable:

```text
HomeFacts + event sequence → exact HomeSemanticModel
```

## 3. Runtime Topology

### 3.1 Split-runtime targets

iOS, Android, and Browser Extension run `main` and `bg` in isolated JS
runtimes/heaps.

Required assumptions:

- main and bg initialize independently;
- JS objects are not shared;
- data crosses a serialization/proxy boundary;
- the same logical data may be deserialized once per runtime;
- Native DB, MMKV, images, fonts, and native singletons may share underlying
  native/process resources;
- bg readiness is connection-scoped, not a persisted boolean;
- request completion may arrive after account/network/session replacement;
- Browser Extension MV3 service workers may terminate and lose globals.

### 3.2 Single-runtime targets

Desktop and Web execute main/bg code in the same JS runtime/thread.

Required assumptions:

- do not simulate split heaps or unnecessary serialization;
- use the same owner/source/request identity and stale-response checks;
- use the same HomeFacts, machines, reducers, policies, and SemanticModel;
- identify Electron/process-owned resources separately from JS state.

### 3.3 Adapter hierarchy

```text
HomeRuntimeAdapter
├── SplitRuntimeHomeAdapter
│   ├── iOS
│   ├── Android
│   └── Extension
└── SingleRuntimeHomeAdapter
    ├── Desktop
    └── Web
```

Adapters normalize platform data into facts. They must not decide:

- zero/funded;
- backup presentation;
- action semantics;
- tab visibility/order/fallback;
- section presentation;
- confirmed/live/error fallback;
- empty/error UI;
- positive banners.

## 4. Identity Model

Do not overload one string with business owner, request parameters, currency,
and surface environment.

```ts
type HomeOwnerScope = {
  walletId: string;
  accountId: string;
  network:
    { kind: 'allNetworks' } | { kind: 'singleNetwork'; networkId: string };
};

type HomeOwnerToken = {
  scopeKey: string;
  sessionId: string;
};

type HomeSourceKey = {
  scopeKey: string;
  sourceId: HomeSourceId;
  paramsFingerprint: string;
  dataSchemaVersion: number;
  quoteBasis?: {
    currency: string;
    pricingRevision?: string;
  };
};

type HomeRequestToken = {
  clientInstanceId: string;
  sessionId: string;
  sourceId: HomeSourceId;
  requestSeq: number;
};
```

### 4.1 `scopeKey`

`scopeKey` represents the business owner only:

- wallet;
- account;
- All Networks vs single network;
- network ID when single-network.

It must be generated by one canonical function and versioned if its format
changes.

Do not include:

- theme;
- locale;
- form factor;
- input mode;
- hover support;
- Dynamic Type;
- temporary request generation.

### 4.2 Why `sessionId` is required

`scopeKey` alone cannot distinguish:

```text
Account A session 1 → Account B → Account A session 2
```

A late response or Native callback from A session 1 has the same `scopeKey` as
A session 2. Each scope activation therefore receives a new `sessionId`.

### 4.3 Currency identity

- If an upstream result is already valued in a selected fiat currency, currency
  must be part of `HomeSourceKey`.
- If cache stores canonical amounts, conversion requires an authoritative FX
  rate and rate revision.
- Never relabel a cached USD number as another currency.

## 5. HomeFacts

`HomeFacts` contains facts only. It must not contain `showSend`, `isZeroUI`,
`visibleTabs`, or similar presentation decisions.

```ts
type HomeFacts = {
  owner: HomeOwnerScope;

  wallet: {
    backupStatus: 'unknown' | 'required' | 'complete' | 'notApplicable';
    accountType: HomeAccountType;
  };

  environment: {
    currency: string;
    locale: string;
    theme: HomeThemeFacts;
  };

  runtime: {
    topology: 'split' | 'single';
    connection: 'waiting' | 'ready' | 'degraded';
    producerInstanceId: string;
    protocolVersion: number;
  };

  capabilityInputs: {
    networkFamily: HomeNetworkFamily;
    accountType: HomeAccountType;
    allNetworks: boolean;
    serverConfig: HomeServerCapabilityConfig;
    productAvailability: HomeProductAvailability;
  };

  sources: Readonly<Record<HomeSourceId, ScopedResource<unknown>>>;
  confirmed: HomeConfirmedIndex;
};
```

`theme` and `locale` are facts because they affect formatted output, but they do
not change business ownership or source-request authority.

## 6. ScopedResource Contract

```ts
type ScopedResource<T> =
  | { kind: 'idle' }
  | { kind: 'loading'; token: HomeRequestToken }
  | {
      kind: 'partial';
      token: HomeRequestToken;
      data: T;
      coverage: SourceCoverage;
    }
  | {
      kind: 'complete';
      token: HomeRequestToken;
      result: { kind: 'success'; data: T } | { kind: 'empty' };
      coverage: CompleteCoverage;
      sourceVersion?: string;
    }
  | {
      kind: 'error';
      token: HomeRequestToken;
      errorKind:
        'source' | 'transport' | 'schemaMismatch' | 'runtimeUnavailable';
    };
```

### 6.1 Acceptance contract

A response is accepted only when all conditions match:

```text
protocolVersion === negotiated protocol
clientInstanceId === current main instance
producerInstanceId === current producer/bg instance
sessionId === active session
sourceId === expected source
requestSeq === latest sequence for the source
sourceKey === expected source key
coverage/requiredSetRevision === current aggregation run
```

If any condition fails:

- do not update current semantic state;
- do not publish a Native patch;
- do not write confirmed cache;
- record only a bounded stale-rejection trace.

### 6.2 Cancellation

Cancellation is best effort and primarily saves resources.

Correctness must not depend on cancellation because:

- a Promise may already have resolved;
- a proxy response may already be queued;
- a native callback may already be enqueued;
- an Extension worker may terminate or reconnect;
- an API may ignore `AbortSignal`.

Request-token validation is the correctness boundary.

### 6.3 Partial data

- Partial balance sums are never exact header totals.
- Partial responses never write confirmed cache.
- Partial data without positive evidence cannot prove zero.
- Reliable positive holdings evidence may produce
  `fundedPendingTotal`: funded-safe actions with a balance skeleton.
- Sections remain loading while partial unless a future product-specific policy
  explicitly introduces a distinct progressive presentation.

### 6.4 Main/bg ownership

Main owns:

- the active Home session and `sessionId`;
- selected-tab intent;
- accepted source snapshots;
- aggregation-run completeness;
- confirmed Home cache commit commands;
- `HomeSemanticStore`;
- Surface projection and renderer intents.

Bg owns:

- data retrieval and existing domain/data-layer caches;
- DB/native-service access appropriate to the source;
- source-level cancellation when supported;
- JSON-safe source responses with producer identity.

Bg must not produce `HomeSemanticModel`, choose zero/funded, select tabs, or
decide UI fallback. If main and bg share an underlying native store, document a
single logical writer for each Home-owned record rather than assuming isolated
JS heaps imply isolated native resources.

## 7. Balance Aggregation and Authority

Do not add “latest Portfolio + latest DeFi + latest Perps” from unrelated runs.

```ts
type BalanceAggregationRun = {
  runId: string;
  owner: HomeOwnerToken;
  requiredContributors: readonly BalanceContributorId[];
  requiredSetRevision: string;
  results: Partial<Record<BalanceContributorId, ContributorResult>>;
};
```

A run is complete only when every required contributor has a terminal complete
result for the same owner and required-set revision.

If capability/server config changes the required contributor set, create a new
run. Never mix results across required sets.

### 7.1 Confirmed cache

```ts
type ConfirmedRecord<T> = {
  sourceKey: HomeSourceKey;
  quality: 'confirmed';
  result: { kind: 'success'; data: T } | { kind: 'empty' };
  coverageFingerprint: string;
  sourceVersion?: string;
  confirmedAt: number;
};
```

Rules:

- exact `HomeSourceKey` lookup only;
- no cross-owner `latest` fallback;
- write only accepted current complete success/empty;
- complete empty can commit zero only with complete coverage;
- errors and partial results never commit zero;
- cache provenance is preserved in SemanticModel;
- cache write happens after the live in-memory semantic transaction;
- cache persistence failure does not roll back valid live UI;
- different sources may have different TTL and byte budgets;
- use LRU/TTL and measure before selecting final limits;
- never let an unbounded in-memory map grow across account switching.

### 7.2 Balance decision table

| Live/source state                   | Exact confirmed | Semantic result                    | Cache write |
| ----------------------------------- | --------------- | ---------------------------------- | ----------- |
| loading                             | none            | loading skeleton                   | no          |
| loading                             | exists          | confirmed + refreshing             | no          |
| partial, no positive evidence       | none            | loading; never `$0`                | no          |
| partial, no positive evidence       | exists          | confirmed + refreshing             | no          |
| partial, reliable positive evidence | any             | fundedPendingTotal; total skeleton | no          |
| complete, total > 0                 | any             | funded/live                        | yes         |
| complete, complete total = 0        | any             | zero/live                          | yes         |
| error                               | exists          | confirmed/degraded                 | no          |
| error                               | none            | unavailable                        | no          |
| cancelled/superseded                | any             | keep previous legal semantic state | no          |
| stale response                      | any             | ignore                             | no          |

## 8. State Machines and Reducers

### 8.1 `HomeSessionMachine`

```text
waitingForRuntime → active ↔ degraded → stopped
```

Each active scope incarnation owns one instance. Its scope is immutable.

Responsibilities:

- runtime handshake/readiness;
- `sessionId` ownership;
- start/stop applicable resource actors;
- request-token validation;
- invalidate in-flight work on producer restart;
- aggregation-run identity;
- emit guarded cache commands;
- publish semantic transactions;
- stop the complete old actor tree on scope replacement.

Non-responsibilities:

- zero/funded calculation;
- actions;
- tab capabilities;
- selected fallback;
- section visibility;
- renderer layout.

### 8.2 `ScopedResourceMachine<T>`

```text
idle → loading → complete | empty | error
          │
          └── partial/progress
```

One generic definition is instantiated for Portfolio, DeFi, Perps, NFT,
History, Market, and future sources.

Responsibilities:

- request sequence;
- cancellation;
- partial progress;
- retry;
- terminal result;
- stale completion rejection.

Do not fork this into six unrelated machines with different meanings for
loading or error.

### 8.3 Pure reducers

`ConfirmedCacheReducer` manages exact confirmed records and eviction.

`TabIntentReducer` manages user intent and deterministic fallback. Do not store
both an independently mutable preferred tab and independently mutable effective
tab without a reducer contract.

### 8.4 Model-based test scope

Graph/path traversal should cover only:

- `HomeSessionMachine`;
- the generic `ScopedResourceMachine<T>`.

Do not attempt exhaustive traversal of the entire Home Cartesian product.
Business combinations belong in golden vectors, invariant/property tests, and
pairwise capability tests.

## 9. Capability Matrix

Centralize capability input and output:

```ts
type HomeCapabilityContext = {
  scope: HomeOwnerScope;
  networkFamily: HomeNetworkFamily;
  accountType: HomeAccountType;
  serverConfig: HomeServerCapabilityConfig;
  productAvailability: HomeProductAvailability;
};

type HomeCapabilitySet = {
  tabs: readonly HomeTabId[];
  sections: Readonly<Record<HomeSectionId, boolean>>;
  actions: Readonly<Record<HomeActionId, boolean>>;
  balanceContributors: readonly BalanceContributorId[];
  destinations: Readonly<Record<HomeCommandId, HomeCommandDestination>>;
  revision: string;
};
```

The matrix must cover:

- All Networks;
- BTC;
- ETH;
- SOL;
- Polygon;
- TON;
- TRON;
- account type;
- Perps;
- DeFi;
- NFT;
- History;
- Market;
- backup entry;
- server config/kill switches;
- selected fallback.

Rules:

- platform name is not a business capability;
- if a feature differs by platform, express the real feature capability, such
  as `supportsPerpsInline`, not `surface === 'iosNative'`;
- renderer layout may choose inline, modal, or handoff presentation only after
  shared policy has selected the semantic destination;
- tab list must be non-empty when navigation is ready;
- effective selected tab must be present in the tab list;
- Native must not silently select the first tab when the contract is invalid.

## 10. HomeSemanticModel

Use correlated discriminated unions so invalid combinations cannot be
constructed.

```ts
type HomePortfolioPresentation =
  | {
      kind: 'loading';
      header: { kind: 'loading' };
      actions: { kind: 'loading'; items: [] };
      banner: { kind: 'none' };
    }
  | {
      kind: 'fundedPendingTotal';
      header: { kind: 'loading' };
      actions: { kind: 'funded'; items: readonly HomeActionId[] };
      banner: HomePositiveBanner | { kind: 'none' };
    }
  | {
      kind: 'zero';
      header: { kind: 'zero'; balance: MoneyViewModel };
      actions: { kind: 'zero'; items: readonly HomeZeroActionId[] };
      banner: { kind: 'none' };
    }
  | {
      kind: 'funded';
      header: {
        kind: 'funded';
        balance: MoneyViewModel;
        authority: 'live' | 'confirmedCache';
      };
      actions: { kind: 'funded'; items: readonly HomeActionId[] };
      banner: HomePositiveBanner | { kind: 'none' };
    }
  | {
      kind: 'unavailable';
      header: { kind: 'unavailable'; reason: HomeUnavailableReason };
      actions: { kind: 'loading'; items: [] };
      banner: { kind: 'none' };
    };
```

```ts
type HomeSemanticModel = {
  owner: HomeOwnerToken;

  shell:
    | { kind: 'backupRequired'; cta: HomeCommandId }
    | { kind: 'missingNetworkAccount' }
    | {
        kind: 'portfolio';
        presentation: HomePortfolioPresentation;
      };

  navigation:
    | { kind: 'hidden' }
    | {
        kind: 'ready';
        tabs: NonEmptyReadonlyArray<HomeTabSemanticModel>;
        selectedTabId: HomeTabId;
      };

  sections: Readonly<Record<HomeSectionId, HomeSectionSemanticModel>>;
};
```

```ts
type HomeSectionSemanticModel =
  | { kind: 'hidden'; reason: HomeSectionHiddenReason }
  | { kind: 'loading'; placeholder: HomePlaceholderId }
  | { kind: 'empty'; emptyState: HomeEmptyStateId }
  | {
      kind: 'ready';
      rows: readonly HomeRowSemanticModel[];
      freshness: 'live' | 'confirmedCache';
      refresh: 'idle' | 'refreshing' | 'failed';
    }
  | { kind: 'error'; errorState: HomeErrorStateId };
```

### 10.1 Required impossible states

The public types and constructors must make these impossible:

- loading header with `$0.00`;
- zero actions containing send;
- funded balance from another owner;
- hidden section with rows;
- stale owner entering the current semantic store;
- loading displaying a partial total;
- error committing zero to confirmed cache;
- positive actions paired with a fabricated `$0`;
- zero actions paired with a positive banner;
- selected tab absent from ready tabs;
- Native slot owner different from snapshot owner;
- command for an old semantic revision executing against a new owner.

## 11. One Logical Exit, Fine-Grained Publication

Do not interpret “one HomeSemanticModel” as “every subscriber receives one
giant new object for every price or section change.”

```ts
type Versioned<T> = {
  revision: number;
  value: T;
};

type HomeSemanticStore = {
  owner: HomeOwnerToken;
  shell: Versioned<HomeShellSemanticModel>;
  navigation: Versioned<HomeNavigationSemanticModel>;
  sections: ReadonlyMap<HomeSectionId, Versioned<HomeSectionSemanticModel>>;
};
```

Public API:

```ts
materializeHomeSemanticModel(): HomeSemanticModel;
subscribeHomeShell(): Versioned<HomeShellSemanticModel>;
subscribeHomeNavigation(): Versioned<HomeNavigationSemanticModel>;
subscribeHomeSection(id: HomeSectionId): Versioned<HomeSectionSemanticModel>;
dispatchHomeIntent(intent: HomeIntent): void;
```

Consistency groups:

- active owner + shell reset;
- header + actions + banner + balance authority;
- tabs + selected fallback;
- each section's state + rows;
- Native snapshot + Native/RN slot owner manifest.

Fields in one group update atomically. Unrelated sections retain their object
identity through structural sharing.

## 12. HomeSurfaceModel

```ts
type HomeSurface =
  | 'iosNative'
  | 'androidNative'
  | 'mobileReactNative'
  | 'extension'
  | 'desktop'
  | 'web';

type HomeSurfaceContext = {
  surface: HomeSurface;
  formFactor: 'compact' | 'regular' | 'wide';
  inputMode: 'touch' | 'pointer' | 'mixed';
  supportsHover: boolean;
  supportsDynamicType: boolean;
};

type HomeSurfaceModel = {
  owner: HomeOwnerToken;
  semanticRevision: number;
  surface: HomeSurface;
  layout: {
    columns: number;
    headerReservedHeight?: number;
    sectionReservedHeights: Readonly<Partial<Record<HomeSectionId, number>>>;
    contentMaxWidth?: number;
  };
  interaction: {
    supportsHover: boolean;
    focusStyle: HomeFocusStyle;
    pressStyle: HomePressStyle;
  };
  slots?: HomeSlotLayoutContract;
};
```

Surface policy may decide:

- height and reserved slot height;
- grid and responsive breakpoints;
- horizontal/vertical placement;
- touch/pointer affordance;
- hover/pressed/focus rendering;
- Dynamic Type measurement behavior;
- scroll and gesture ownership;
- full snapshot vs typed patch layout contract;
- Native slot placement.

Surface policy must not change:

- backupRequired/portfolio;
- zero/funded/loading/unavailable;
- actions semantics;
- tabs capability/order/fallback;
- section semantic state;
- balance authority;
- stale-response rejection.

Stable height must come from placeholder and reserved layout contracts. It must
never be achieved by displaying an incorrect business state.

## 13. Native DTO and Transport Protocol

Current snapshot and patch types include schema/revision but not owner,
baseRevision, or resync identity:

- `packages/native-components/src/HomeContainer.types.ts:205-224`;
- `packages/native-components/src/HomeContainerController.ts:192-211`.

Current callbacks also lack owner/revision:

- `packages/native-components/src/HomeContainer.types.ts:226-237`;
- `packages/native-components/src/HomeContainer.native.tsx:249-274`.

### 13.1 Proposed envelope

```ts
type HomeNativeEnvelope =
  | {
      kind: 'snapshot';
      protocolVersion: 2;
      schemaVersion: 2;
      owner: HomeOwnerToken;
      revision: number;
      payload: HomeNativeSnapshot;
    }
  | {
      kind: 'patch';
      protocolVersion: 2;
      schemaVersion: 2;
      owner: HomeOwnerToken;
      baseRevision: number;
      revision: number;
      changes: readonly HomeNativeChange[];
    };
```

```ts
type HomeNativeChange =
  | { kind: 'replaceShell'; value: HomeNativeShellDTO }
  | { kind: 'replaceNavigation'; value: HomeNativeNavigationDTO }
  | {
      kind: 'replaceSection';
      tabId: HomeTabId;
      sectionId: HomeSectionId;
      value: HomeNativeSectionDTO;
    }
  | {
      kind: 'removeSection';
      tabId: HomeTabId;
      sectionId: HomeSectionId;
    }
  | { kind: 'replaceSurface'; value: HomeNativeSurfaceDTO };
```

Use stable IDs and explicit order. Do not rely on JSON array index as identity.

Do not use a generic RFC 6902 path patch for the bridge. A typed domain patch
can validate Home owner, transaction groups, stable IDs, and invariants before
applying.

### 13.2 Native apply contract

Full snapshot:

1. validate supported protocol/schema;
2. validate all DTO invariants;
3. if owner differs, replace current owner regardless of old owner's revision;
4. if owner is the same, require a newer revision;
5. atomically swap the validated snapshot.

Patch:

1. owner must exactly match current owner;
2. `baseRevision` must equal current revision;
3. new revision must be greater than base revision;
4. apply all changes to a temporary copy;
5. validate cross-field invariants;
6. atomically swap only if all changes are valid;
7. otherwise request a full snapshot.

```ts
type HomeNativeApplyResult =
  | { kind: 'applied'; owner: HomeOwnerToken; revision: number }
  | { kind: 'duplicate'; owner: HomeOwnerToken; revision: number }
  | {
      kind: 'needSnapshot';
      owner?: HomeOwnerToken;
      currentRevision?: number;
      reason:
        | 'ownerMismatch'
        | 'revisionGap'
        | 'invalidInvariant'
        | 'unsupportedSchema';
    };
```

Current Swift/Kotlin fallback silently selects the first tab when selected ID is
invalid:

- `packages/native-components/ios/HomeContainerView.swift:942-946`;
- `packages/native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerView.kt:372-383`.

After migration, Native may defensively reject invalid input and request resync,
but it must not choose the business fallback.

### 13.3 Stale intent protection

```ts
type HomeNativeIntent = {
  intentId: string;
  owner: HomeOwnerToken;
  renderedRevision: number;
  intent:
    | { kind: 'action'; commandId: HomeCommandId; itemId?: string }
    | { kind: 'refresh'; tabId: HomeTabId; requestId: string }
    | { kind: 'selectTab'; tabId: HomeTabId };
};
```

The main dispatcher executes only when:

- owner is current;
- command still exists in the current command registry;
- capability still allows the command;
- a sensitive/non-idempotent command's rendered revision is still valid.

Commands are typed IDs/descriptors, never closures embedded in semantic state.

### 13.4 Slots

Current snapshot and `slots` are separate props, and slots have no owner:

- `packages/native-components/src/HomeContainer.types.ts:189-203`;
- `packages/native-components/src/HomeContainer.native.tsx:319-389`.

Proposed wrapper:

```ts
type HomeSlotBundle = {
  owner: HomeOwnerToken;
  semanticRevision: number;
  slotContractRevision: number;
  slots: IHomeContainerSlots;
};
```

Rules:

- snapshot and slot owner must match;
- React wrapper is keyed by `sessionId`;
- an unready slot displays its current owner's reserved placeholder;
- old-owner slot content is never retained for stable height;
- background result, semantic snapshot, Native DTO, and slot bundle all carry
  compatible owner identity.

### 13.5 Schema evolution

Keep these versions separate:

- `protocolVersion` — envelope, owner, revision, ack, and resync behavior;
- `schemaVersion` — DTO fields and discriminated-union variants.

Rules:

- every supported schema has canonical JSON fixtures;
- published fields never silently change meaning;
- additive optional fields may remain backward compatible;
- new required fields, removed fields, type changes, or new mandatory union
  kinds require a schema bump;
- unknown optional fields may be ignored;
- an unknown union `kind` must be rejected, never mapped to a known business
  state;
- protocol negotiation happens before patches are enabled;
- TS, Swift, and Kotlin must decode the same golden fixtures and produce the
  same invariant result.

## 14. Renderer Contract

Correct target:

```text
React renderer
  = SemanticSlice + SurfaceProjection + local visual state + typed intents

Swift/Kotlin renderer
  = Native DTO + native local visual state + typed intents
```

Allowed renderer conditions:

- exhaustive `switch (model.kind)` rendering;
- Dark Mode;
- Dynamic Type;
- hover, focus, pressed;
- measured size;
- scroll, gesture, inertia;
- image loading/fallback assets;
- invalid DTO defensive fallback.

Forbidden renderer behavior:

- import/read raw balance, backup, account, network, capability, or server
  config to decide Home business presentation;
- derive zero/funded from raw values;
- calculate action sets;
- calculate applicable tabs or selected fallback;
- choose section hidden/loading/empty/ready/error;
- choose confirmed/live/error fallback;
- silently reinterpret an invalid semantic state.

Do not ban every renderer `if`. Ban raw-business imports and recomputation.

### 14.1 Bidirectional UI integration contract

The renderer contract is bidirectional, but the two directions have different
authority:

```text
Home Core -> immutable Semantic/Surface slices -> renderer
renderer  -> typed HomeIntent                   -> Home dispatcher
```

Conceptual contract:

```ts
type HomeRendererInput = {
  owner: HomeOwnerToken;
  shell: Versioned<HomeShellSemanticModel>;
  navigation: Versioned<HomeNavigationSemanticModel>;
  sections: ReadonlyMap<HomeSectionId, Versioned<HomeSectionSemanticModel>>;
  surface: HomeSurfaceModel;
  dispatch: (intent: HomeIntent) => void;
};

type HomeIntent =
  | {
      kind: 'selectTab';
      owner: HomeOwnerToken;
      tabId: HomeTabId;
    }
  | {
      kind: 'refresh';
      owner: HomeOwnerToken;
      sourceId?: HomeSourceId;
      sectionId?: HomeSectionId;
    }
  | {
      kind: 'retry';
      owner: HomeOwnerToken;
      sourceId: HomeSourceId;
    }
  | {
      kind: 'executeCommand';
      owner: HomeOwnerToken;
      renderedRevision: number;
      commandId: HomeCommandId;
    };
```

Rules:

- renderers receive immutable values and never mutate the semantic store;
- UI events return typed intent IDs, never raw service calls or closures;
- the dispatcher revalidates current owner, capability, command registration,
  and revision before producing effects;
- React consumes semantic slices directly; Native receives the equivalent
  slices through the Native DTO adapter and stale-intent envelope;
- renderer-local state is limited to visual mechanics such as focus, hover,
  pressed, measured size, animation, scroll, and image loading;
- renderer-local state must not become a second owner of Home business state.

The React integration should expose narrow hooks such as:

```ts
useHomeShellSemantic();
useHomeNavigationSemantic();
useHomeSectionSemantic(sectionId);
useHomeSurfaceModel();
useHomeIntentDispatcher();
```

These are the conceptual public API, not permission to add atoms under
`views/Home`. The OneKey implementation should use feature-scoped
`contextAtom`s under `packages/kit/src/states/jotai/contexts/home/`, with pure
model code under `packages/kit/src/views/Home/model/`. Components must not use
`materializeHomeSemanticModel()` as their normal subscription path.

### 14.2 UI extension playbook

Classify every UI addition before implementation. The classification determines
which contract is allowed to change.

#### A. Pure visual or layout addition

Examples: Desktop wide grid, hover/focus treatment, Dynamic Type measurement,
Native reserved height, or a compact breakpoint.

- change `HomeSurfacePolicy`, a renderer, or a platform-specific
  `.native`/`.web`/`.desktop`/`.ext` implementation;
- do not add semantic states, capabilities, balance rules, or raw-business
  reads;
- preserve the same `HomeSemanticModel` for all surfaces;
- add SurfacePolicy tests and real screenshots/recordings for the affected
  surface, form factor, theme, and input mode.

#### B. New section using existing business semantics

Examples: a new server-configured card or a new asset subsection that still
uses hidden/loading/empty/ready/error.

- add a stable `HomeSectionId`, facts adapter, capability/policy entry, and
  semantic row mapping;
- instantiate an existing `SectionLoadMachine` for a new asynchronous source;
  do not define a new machine merely because the section is new;
- add a React renderer and, where applicable, Native DTO mapping using the
  existing `replaceSection` change;
- subscribe only to the new section slice; do not make unrelated shell or
  section consumers depend on it;
- add a golden vector, source lifecycle tests, DTO fixture/decoder tests, and
  renderer contract tests;
- do not fetch directly or read raw account/network/balance atoms from the
  section renderer.

#### C. New business semantic or capability

Examples: a genuinely new header authority state, a new action eligibility
rule, or a new tab capability dimension.

- change the central discriminated union, decision table, capability matrix,
  or authority policy first;
- add exhaustive selector tests and golden vectors before platform rendering;
- require every affected renderer to handle the new semantic `kind`
  exhaustively;
- bump Native schema only when the change cannot be represented by the current
  versioned union/optional fields;
- never introduce a platform-first business `if` and later attempt to copy it
  to other platforms.

Every new Home renderer or surface must pass this checklist:

1. It imports only the Home public Semantic/Surface contract, not raw Home
   business sources.
2. It supports owner/revision validation and emits typed intents.
3. It uses `platformEnv` and platform files only for real platform behavior.
4. It renders discriminated unions exhaustively without recomputing them.
5. It has contract tests and representative screenshot/recording evidence.
6. It passes architecture checks that prohibit forbidden raw-business imports.

### 14.3 Update and invalidation impact matrix

An atomic semantic transaction does not imply a whole-screen render. It means
only that fields in the affected consistency group become observable together.

| Change                                                     | Semantic transaction              | React subscribers invalidated                                    | Native transport                                             | Native/UI invalidation          | Full snapshot? |
| ---------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------- | -------------- |
| Balance authority changes header/actions/banner            | `shell`                           | shell consumers only                                             | `replaceShell`                                               | shared chrome/header only       | no             |
| User selects an already-applicable tab                     | `navigation`                      | tab chrome/pager selection                                       | `replaceNavigation` or an equivalent typed navigation change | tab chrome and pager only       | no             |
| Capability changes tab set/order/fallback                  | `navigation`                      | navigation and affected page-mount consumers                     | `replaceNavigation`                                          | tab structure and selected page | normally no    |
| NFT loading becomes ready/error                            | `section:nft`                     | NFT section consumers only                                       | `replaceSection(nft)`                                        | NFT section only                | no             |
| Portfolio asset prices change                              | affected portfolio section        | that section/row list only                                       | `replaceSection(sectionId)`                                  | affected rows/section only      | no             |
| Theme, form factor, measured layout, or input mode changes | `surface`                         | surface/layout consumers                                         | `replaceSurface`                                             | layout/paint/interaction only   | no             |
| Owner/session changes                                      | owner plus all consistency groups | all current Home consumers reset to the new owner                | full snapshot                                                | complete owner replacement      | yes            |
| Protocol/schema mismatch or revision gap                   | no patch is applied               | existing model stays valid or a safe resync placeholder is shown | request full snapshot                                        | atomic resync                   | yes            |
| Native/RN slot content becomes ready                       | owner-matched slot bundle         | slot wrapper only                                                | owner-matched slot update, not a business DTO recomputation  | that slot only                  | no             |

Publication rules:

- the owner/global semantic revision may advance without invalidating every
  subscriber; each subscriber compares its slice revision and stable reference;
- structural sharing is mandatory: unchanged shell, navigation, and section
  objects keep their identity;
- header + actions + banner update as one shell consistency group, but this does
  not invalidate section consumers;
- tabs + selected fallback update as one navigation consistency group;
- several section changes may be batched into one Native `changes[]` envelope
  per frame, while Native rebinds only the changed section IDs;
- `materializeHomeSemanticModel()` is for full snapshots, golden tests,
  diagnostics, and resync—not a general React subscription;
- the React/Jotai publication layer uses separate context atoms or derived cells
  for shell, navigation, surface, and individual sections; a giant atom consumed
  by every Home component would defeat this design;
- a full snapshot is reserved for owner replacement, bootstrap/resync, schema or
  protocol recovery, not ordinary balance or section refreshes.

### 14.4 Meaning of SemanticStore slicing and SurfaceModel

`HomeSemanticStore` is not a second business model. It is the publication and
subscription container for the single `HomeSemanticModel` truth. The complete
model is comparable to one immutable document; the store exposes indexed,
versioned portions of that document so a consumer can observe only `shell`,
`navigation`, or one section. Slices share the same owner and transaction rules,
so they cannot drift into independent Home states.

`HomeSurfaceModel` is also not a second business model. It is the result of
projecting shared semantics through a `HomeSurfaceContext`. It answers **how the
current terminal presents the meaning**, not **what the business meaning is**.

For the same semantic input—funded header, send/receive actions, and an NFT
loading section—Desktop may produce a three-column pointer/hover surface, while
iOS produces a one-column touch/Dynamic-Type surface with a Native slot height
contract. Both surfaces must retain the same funded/actions/NFT-loading meaning.

## 15. Decision Tables

### 15.1 Backup

| backupStatus  | Wallet/account readiness | Shell                               |
| ------------- | ------------------------ | ----------------------------------- |
| unknown       | not ready                | loading/entry gate; never zero      |
| required      | ready                    | backupRequired + shared CTA command |
| complete      | ready                    | portfolio                           |
| notApplicable | ready                    | portfolio                           |

No-wallet/onboarding remains an application entry/navigation concern outside
the Home portfolio session. Home begins once a usable owner can be identified.

### 15.2 Header/actions/banner

| Portfolio presentation | Header                    | Actions             | Banner            |
| ---------------------- | ------------------------- | ------------------- | ----------------- |
| loading                | skeleton                  | loading/none        | none              |
| fundedPendingTotal     | balance skeleton          | funded-safe actions | optional positive |
| zero                   | authoritative zero amount | zero actions only   | none              |
| funded                 | authoritative amount      | funded actions      | optional positive |
| unavailable            | unavailable               | none/retry policy   | none              |

### 15.3 Tabs

| Capability state                         | Output                                                |
| ---------------------------------------- | ----------------------------------------------------- |
| not ready, no exact confirmed capability | navigation loading/hidden                             |
| not ready, exact confirmed capability    | confirmed tabs + refreshing metadata                  |
| ready                                    | matrix-derived non-empty tabs                         |
| selected still applicable                | preserve selected                                     |
| selected removed                         | central deterministic fallback                        |
| capability required set changes          | increment capability revision and start affected runs |

### 15.4 Sections

| Applicability/source        | Semantic section                         |
| --------------------------- | ---------------------------------------- |
| not applicable              | hidden, no rows                          |
| idle/loading                | loading with placeholder contract        |
| partial                     | loading; no partial total/empty claim    |
| complete empty              | empty                                    |
| complete data               | ready/live                               |
| error + allowed exact cache | ready/confirmedCache with refresh failed |
| error + no cache            | error                                    |

### 15.5 Surface layout

| Context             | Surface decision               | Semantic impact |
| ------------------- | ------------------------------ | --------------- |
| compact/touch       | compact spacing, touch targets | none            |
| regular/mixed       | responsive columns             | none            |
| wide/pointer        | desktop grid, hover/focus      | none            |
| Dynamic Type        | measured/reserved heights      | none            |
| Native slot loading | stable placeholder height      | none            |
| theme change        | colors/assets, surface patch   | none            |

## 16. Required State-Transition Contract

| Transition/event             | Allowed display                     | Forbidden display                        | Cache                             | Cancellation/rejection                          | Stable height              | Renderer difference               |
| ---------------------------- | ----------------------------------- | ---------------------------------------- | --------------------------------- | ----------------------------------------------- | -------------------------- | --------------------------------- |
| first launch                 | entry/loading gate                  | fabricated zero                          | read exact only after owner known | no owner requests                               | yes                        | layout only                       |
| bg not ready                 | loading or exact confirmed/degraded | live claim                               | no writes                         | wait for handshake                              | yes                        | split only; single ready directly |
| new account created          | new owner loading                   | previous account content                 | exact new-owner read only         | retire previous session                         | yes                        | none semantically                 |
| unbacked zero wallet         | backupRequired                      | portfolio zero actions                   | no balance write needed           | owner checks still apply                        | yes                        | layout only                       |
| backed zero wallet           | zero after complete coverage        | send/positive banner                     | write confirmed zero              | reject stale                                    | yes                        | layout only                       |
| funded account               | funded/live or exact confirmed      | zero actions                             | write complete live               | reject stale                                    | yes                        | layout only                       |
| zero → funded                | fundedPendingTotal or funded        | stale `$0` once positive evidence exists | write only complete total         | supersede older request                         | yes                        | animation may differ              |
| funded → zero                | loading until complete zero         | early zero from partial                  | write complete zero               | supersede older request                         | yes                        | animation may differ              |
| Account A → B                | B exact cache/loading               | any A data/slot                          | read B only                       | abort A; reject A completions                   | yes                        | none semantically                 |
| A → B → A                    | new A session exact cache/loading   | old A session completion                 | exact A source key                | sessionId rejects old A                         | yes                        | none semantically                 |
| All Networks → single        | single exact cache/loading          | aggregate rows in single                 | exact single key                  | retire aggregate session                        | yes                        | layout only                       |
| single → All Networks        | aggregate exact cache/loading       | single-only content                      | exact aggregate key               | retire single session                           | yes                        | layout only                       |
| confirmed → live             | confirmed refreshing then live      | provenance loss                          | commit live complete              | current token only                              | yes                        | none semantically                 |
| loading → error              | confirmed degraded or unavailable   | zero from error                          | no write                          | request terminal                                | yes                        | error styling/layout only         |
| error + cache                | confirmed/degraded                  | cache presented as live                  | no write                          | retry gets new sequence                         | yes                        | none semantically                 |
| error + no cache             | unavailable/error                   | zero                                     | no write                          | retry gets new sequence                         | yes                        | layout only                       |
| partial response             | loading or fundedPendingTotal       | exact partial sum                        | no write                          | wait for complete/new request                   | yes                        | none semantically                 |
| old response late            | unchanged current model             | any stale content                        | no write                          | reject token                                    | yes                        | none                              |
| bg restart                   | confirmed/degraded or loading       | old-bg live claim                        | no write                          | invalidate producer ID; replay idempotent reads | yes                        | split only                        |
| capability update            | atomic tabs/selected and new run    | tab without capability                   | capability cache only if exact    | cancel affected sources                         | yes                        | destination layout may differ     |
| selected tab removed         | deterministic fallback              | Native local first-tab decision          | no balance effect                 | cancel hidden source if policy says             | yes                        | animation may differ              |
| theme/locale change          | same semantics, new surface/text    | source/scope replacement                 | no source cache effect            | no source cancellation                          | preserve measured contract | expected surface difference       |
| snapshot/slot owner mismatch | current-owner placeholder/resync    | mixed owner UI                           | no write                          | reject slot/snapshot                            | yes                        | Native-specific handling          |
| stale action tap             | no command execution                | command against new owner                | no write                          | reject intent                                   | n/a                        | transport differs only            |

React and Native may animate or lay out the same transition differently. They
must not differ in semantic state or owner authority.

## 17. Current Problem Map

This map is evidence for migration planning, not a claim that every existing
branch is a bug. Phase 0 must classify each difference as intentional design,
historical drift, or defect.

| Condition/state                     | Current location                                                                                                                                                                           | Legacy semantic                                                       | Native semantic                                                  | Duplicate/conflict                                                                                        | Recommended owner                                         | Phase   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------- |
| launch/account/wallet readiness     | `packages/kit/src/views/Home/pages/HomePageContainer.tsx:95-156`                                                                                                                           | combines onboarding, storage, active-account, wallet list readiness   | Native/Legacy choice occurs after the same page surface resolver | mixed entry and Home concerns                                                                             | app entry gate + HomeSession readiness                    | 0-2     |
| Legacy/Native/backup surface choice | `packages/kit/src/views/Home/pages/HomePageContainer.tsx:125-190`                                                                                                                          | chooses not-backed-up RN, legacy, no-wallet                           | chooses Native via feature path                                  | central choice but semantic ownership still split downstream                                              | entry/surface routing                                     | 0-2     |
| balance authority composition       | `packages/kit/src/hooks/useHomeBalanceState.ts:53-69`, `80-203`                                                                                                                            | held tokens, confirmed cache, live worth, funded latch, wallet sticky | separately reimplemented in Native helper/page                   | duplicate; sticky can bridge scopes inside a wallet                                                       | shared authority selector/session                         | 1-4     |
| session funded latch                | `packages/kit/src/hooks/useHomeBalanceState.ts:150-169`                                                                                                                                    | funded may remain until restart after true funded→zero                | Native has its own funded-owner set                              | duplicate and intentionally lossy                                                                         | complete aggregation + exact confirmed                    | 1-4     |
| header banner and reserved height   | `packages/kit/src/views/Home/pages/HomeHeaderContainer.tsx:36-63`, `121-131`                                                                                                               | banner and height depend on local balance hook                        | Native page builds its own banner/actions/height                 | duplicate; business and layout mixed                                                                      | semantic shell + SurfacePolicy                            | 4, 7    |
| Legacy positive/zero actions        | `packages/kit/src/views/Home/components/WalletActions/index.tsx:465-483`                                                                                                                   | positive uses full RawActions; all other states use zero actions      | Native independently builds action DTO                           | unknown/loading falls through to zero component in this local branch unless upstream mounting prevents it | semantic correlated union                                 | 4       |
| Legacy NFT capability               | `packages/kit/src/views/Home/pages/HomePageView.tsx:334-354`                                                                                                                               | derives All Networks/vault/network support                            | Native repeats the derivation                                    | duplicate                                                                                                 | capability matrix                                         | 5       |
| Legacy tabs and ordering            | `packages/kit/src/views/Home/pages/HomePageView.tsx:494-555`                                                                                                                               | constructs Portfolio/Perps/DeFi/NFT/History                           | Native constructs from native tab IDs                            | duplicate; future drift risk                                                                              | capability policy                                         | 5       |
| Legacy selected fallback            | `packages/kit/src/views/Home/pages/HomePageView.tsx:614-659`                                                                                                                               | effect fixes active ID/name after capability change                   | Native host/controller/Swift/Kotlin also defend/fallback         | repeated across layers                                                                                    | TabIntentReducer/policy                                   | 5       |
| shared Native capability helper     | `packages/kit/src/views/Home/homeWalletCapabilityTabModel.ts:21-60`, `77-110`                                                                                                              | partially shared with Legacy                                          | partially shared with Native                                     | improvement, but still tied to Native DTO types and not complete matrix                                   | Home Core capability module                               | 5       |
| capability cache                    | `packages/kit/src/views/Home/hooks/homeWalletTabSupportUtils.ts:21-129`                                                                                                                    | exact-scope LRU for DeFi/Perps support                                | consumed by Native too                                           | useful precursor, but limited capability set                                                              | capability fact adapter/cache                             | 1, 5    |
| Native balance authority            | `packages/kit/src/views/Home/nativeHomeBalanceAuthority.ts:53-65`, `136-208`, `225-315`                                                                                                    | separate from Legacy                                                  | generation/scope, latch, cache, header layout                    | duplicate; combines business with 62/82 layout                                                            | shared authority + SurfacePolicy                          | 1, 4, 7 |
| Native balance aggregation          | `packages/kit/src/views/Home/NativeHomePage.native.tsx:1243-1282`                                                                                                                          | Legacy uses different worth/holdings flow                             | mixes Portfolio/DeFi/Perps readiness and cached state            | conflict risk across run completeness                                                                     | aggregation run + selector                                | 1-4     |
| Native header actions/banner        | `packages/kit/src/views/Home/NativeHomePage.native.tsx:1285-1379`                                                                                                                          | separate Legacy components                                            | builds action arrays and positive banner                         | duplicate                                                                                                 | semantic shell policy                                     | 4       |
| Native tabs/sections                | `packages/kit/src/views/Home/NativeHomePage.native.tsx:1382-1469`                                                                                                                          | separate Legacy tab config                                            | builds Native shells and atomic state                            | duplicate                                                                                                 | semantic navigation                                       | 5-6     |
| source-specific empty/loading       | `packages/kit/src/views/Home/nativeHomeDataAdapters.ts:105-134`                                                                                                                            | Legacy sections have their own conventions                            | Native adapters infer empty/loading from `initialized + count`   | duplicate; error/partial not explicit                                                                     | section policy                                            | 6       |
| NFT async lifecycle                 | `packages/kit/src/views/Home/pages/NFTListContainer.tsx:42-95`, `97-218`                                                                                                                   | local state, polling, explicit abort, incremental All Networks merge  | separate Native NFT hook/adapter                                 | duplicated source lifecycle and owner checks                                                              | ScopedResourceMachine                                     | 6       |
| DeFi loading                        | `packages/kit/src/views/Home/pages/DeFiContainer.tsx:126-164`                                                                                                                              | derives loading and resets image bookkeeping locally                  | separate Native DeFi adapter                                     | duplicate presentation; layout logic is valid local state                                                 | resource facts + section policy; keep scroll/layout local | 6-7     |
| Perps loading/empty/ready           | `packages/kit/src/views/Home/pages/PerpsContainer.tsx:1672-1712`                                                                                                                           | renderer branches on local view state                                 | Native builds its own section DTO                                | duplicated presentation                                                                                   | shared section union                                      | 6       |
| Perps owner authority               | `packages/kit/src/views/Home/pages/perpsHomePortfolioAuthority.ts:17-57`                                                                                                                   | recent local hardening                                                | Native/Legacy may consume via different paths                    | incomplete common request identity                                                                        | generic source actor/token                                | 1, 6    |
| Native request lifecycle            | `packages/kit/src/views/Home/nativeHomePortfolioRequestLifecycle.ts:10-90`, `99-141`                                                                                                       | Native-only scope epoch/generation/single-flight                      | Native-only                                                      | useful precursor but source-specific                                                                      | generic HomeSession/resource actor                        | 1       |
| Native DTO owner/revision           | `packages/native-components/src/HomeContainer.types.ts:205-224`                                                                                                                            | n/a                                                                   | schema + revision, no owner/base revision                        | protocol gap                                                                                              | Native DTO envelope                                       | 3       |
| Native patch granularity            | `packages/native-components/src/HomeContainerController.ts:136-153`, `201-211`                                                                                                             | n/a                                                                   | replaces all sections for a tab                                  | performance and revision-gap risk                                                                         | typed section transaction                                 | 3, 7    |
| Native selected fallback            | `packages/native-components/ios/HomeContainerView.swift:942-946`; `packages/native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerView.kt:372-383` | Legacy has separate fallback                                          | Native chooses first tab                                         | masks shared-policy defects                                                                               | Native validation/resync only                             | 3, 5    |
| Native patch acceptance             | `packages/native-components/ios/HomeContainerView.swift:952-970`; `packages/native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerView.kt:387-400` | n/a                                                                   | accepts `revision >= current`, lacks base revision               | duplicate/reordered/gap ambiguity                                                                         | owner/baseRevision protocol                               | 3       |
| Native slot ownership               | `packages/native-components/src/HomeContainer.types.ts:189-203`; `packages/native-components/src/HomeContainer.native.tsx:319-389`                                                         | React tree owns slot content                                          | snapshot and slot channels can update separately                 | mixed-owner risk                                                                                          | HomeSlotBundle                                            | 3, 7    |

## 18. Package Boundary

Recommended structure:

```text
packages/kit/src/views/Home/model/
  core/
  facts/
  lifecycle/
  authority/
  capabilities/
  policies/
  semantic/
  surface/
  runtime/
  react/
  native/
  tests/
```

Important state-management correction:

Do not create Jotai atoms under `packages/kit/src/views/Home/model/`.

Feature-specific Home atoms belong in:

```text
packages/kit/src/states/jotai/contexts/home/
  atoms.ts
  actions.ts
  index.ts
```

Use `contextAtom` through the established `createJotaiContext` pattern.

If split-runtime main/bg need a shared serialization contract, place only the
low-level transport envelope in a legal lower package, preferably:

```text
packages/shared/src/types/homeRuntime/
```

Only JSON-safe source request/response identity and transport types belong
there. Do not move `HomeFacts`, capability policy, `HomeSemanticModel`, or
`HomeSurfaceModel` into `shared` or `core`.

Import hierarchy remains mandatory:

- `shared` imports no other OneKey package;
- `components` imports only `shared`;
- `kit-bg` imports only `shared` and `core`;
- `kit` may import `shared`, `components`, `kit-bg`, and existing legal lower
  packages;
- `native-components` contains transport/rendering contracts, not Home business
  policy.

## 19. Progressive Migration

No big-bang rewrite.

### Phase 0 — Behavior oracle

Modify:

- tests and fixtures only;
- current behavior matrix and golden decision vectors.

Do not modify:

- production rendering;
- cache ownership;
- Native bridge;
- feature selection.

Platform impact: test-only for all six surfaces.

Runtime boundary: record split/single behavior separately.

Risk: codifying an existing bug as intended behavior.

Rollback: remove only new fixtures/tests.

Tests:

- current Legacy/Native behavior matrix;
- golden inputs and expected outputs;
- classify intentional product difference vs drift/bug.

UI acceptance: baseline screenshots/recordings.

Done when every required golden vector has an explicit expected result and open
product decisions are listed rather than guessed.

### Phase 1 — Owner, source, request authority

Modify:

- identity types;
- runtime adapters;
- HomeSession/resource actor shadow path;
- stale-rejection trace.

Do not modify:

- visible UI;
- existing confirmed cache writes;
- Native DTO schema.

Web/Desktop: use direct SingleRuntime adapter.

Extension/iOS/Android: use split-runtime envelope and producer handshake.

Risk: duplicate requests and shadow memory overhead.

Rollback: disable/remove shadow coordinator; current UI remains authoritative.

Tests: request permutation, A→B→A, same-scope request 2→1, producer restart.

UI acceptance: no behavior or performance regression.

Done when all stale shadow responses are rejected deterministically and
single/split adapters pass the same conformance vectors.

### Phase 2 — HomeFacts and SemanticStore shadow

Modify:

- facts adapters;
- pure selectors/policies;
- semantic slice store;
- shadow comparison reason codes.

Do not modify:

- renderers;
- Native DTO;
- old cache ownership.

Platform impact: all surfaces run the same semantic projection in shadow.

Risk: extra calculations and false-positive drift logs.

Rollback: remove shadow subscription.

Tests: complete golden vectors and invariants.

UI acceptance: unchanged pixels and interactions.

Done when shadow output is explainably equal or every difference is classified.

### Phase 3 — Native transport authority

Modify:

- Native envelope owner/session/baseRevision;
- typed transaction patches;
- ack/resync;
- stale intent;
- slot owner bundle;
- Swift/Kotlin validation.

Do not modify:

- Home business semantics;
- Legacy renderer.

iOS/Android: direct impact.

Extension: use the same runtime request identity principles, not the Native DTO.

Web/Desktop: no Native transport impact.

Risk: schema negotiation and fallback failure.

Rollback: retain protocol-v1 compatibility adapter until v2 is proven.

Tests: TS/Swift/Kotlin fixtures, duplicate/gap/reorder/resync, owner mismatch,
stale callback.

UI acceptance: Native full snapshot and patch parity, no mixed slots.

Done when Native never performs a business fallback and can recover from every
invalid/gapped patch with a full resync.

### Phase 4 — Balance, header, actions, banner

Modify:

- balance aggregation run;
- exact confirmed cache policy;
- shell semantic selector;
- Legacy shell adapter;
- Native shell DTO adapter.

Do not modify:

- tab capability;
- individual section semantics;
- surface layout except required compatibility mapping.

Platform impact: all six surfaces consume the same shell semantics.

Runtime boundary: main owns semantic/cache commit; bg supplies facts only.

Risk: visible zero/funded behavior changes and cache migration.

Rollback: per-surface compatibility adapter reads the new semantic model and
maps back to the old props.

Tests: authority decision table, partial, error/cache, currency, funded→zero,
zero→funded.

UI acceptance: loading/zero/funded/error screenshots and transition recordings.

Done when header/actions/banner cannot disagree by type and all platforms match
golden semantics.

### Phase 5 — Capability and navigation

Modify:

- centralized capability matrix;
- TabIntentReducer;
- navigation semantic slice;
- Legacy and Native tab adapters.

Do not modify:

- section data rendering;
- layout-specific tabs implementation.

Platform impact: same tabs/order/selected semantics; layout remains platform
specific.

Risk: network/account/server-config behavior drift.

Rollback: compatibility adapter can map matrix output into existing tab config.

Tests: All Networks/BTC/ETH/SOL/Polygon/TON/TRON, account types, server kill
switch, selected fallback.

UI acceptance: continuous switching and capability updates.

Done when no renderer computes tab capability or selected fallback.

### Phase 6 — Sections one by one

Migration order:

1. Spot/Portfolio;
2. Perps;
3. DeFi;
4. NFT;
5. History;
6. Market and remaining supplemental sections.

For each section modify only:

- source adapter;
- source actor instance;
- section policy;
- Legacy semantic adapter;
- Native DTO adapter;
- tests.

Do not modify unrelated sections.

Risk: section-specific polling/cache/scroll behavior.

Rollback: per-section compatibility adapter.

Tests: hidden/loading/partial/empty/ready/error/cache/stale scope.

UI acceptance: height stability, scrolling, images, refresh, pagination.

Done when the section renderer no longer reads raw business facts to choose its
semantic state.

### Phase 7 — Surface policy, performance, cleanup

Modify:

- SurfacePolicy per surface;
- fine-grained subscriptions;
- typed section patches;
- architecture import checks;
- removal of compatibility logic only after all gates pass.

Do not remove current behavior paths before parity and rollback criteria pass.

Risk: rerender regression, bridge DTO size, scroll/slot jitter.

Rollback: full snapshot mode and compatibility renderer remain available until
performance/UI acceptance is complete.

Tests: reference stability, DTO bytes, patch thresholds, renderer contracts,
restricted imports.

UI acceptance: full cross-platform screenshot/recording matrix and release-mode
performance traces.

Done when renderers consume only Semantic/Surface contracts and architecture
gates prevent reintroduction of raw business logic.

## 20. Test Strategy

### 20.1 Semantic parity tests

Given identical normalized `HomeFacts` and event sequence, every surface must
receive the same `HomeSemanticModel`.

Surface output may differ only when `HomeSurfaceContext` differs.

If a product capability truly differs, represent it as a capability fact; do
not make surface name an implicit exception.

### 20.2 Golden decision vectors

Required vectors:

- `newUnbackedWallet`;
- `backedZeroWallet`;
- `fundedAllNetworks`;
- `fundedBitcoin`;
- `scopeSwitchWithExactCache`;
- `scopeSwitchWithoutCache`;
- `backgroundNotReady`;
- `partialPortfolioResponse`;
- `staleDefiResponse`;
- `stalePerpsResponse`;
- `historyEmpty`;
- `nftError`;
- `marketLoading`;
- `capabilityChanged`;
- `sameScopeRequestTwoFinishesBeforeOne`;
- `producerRestartWithOldResponse`;
- `partialPositiveWithExactZeroCache`;
- `aggregationRequiredSetChanged`;
- `nativeRevisionGap`;
- `snapshotSlotOwnerMismatch`;
- `staleNativeIntent`.

### 20.3 State-transition tests

Model/path tests cover the two machine definitions only.

Property invariants:

```text
semantic.owner === active session owner
live/confirmed owner exactly matches active owner
zero implies complete coverage
cache write implies accepted current complete result
a response token commits at most once
retired session never changes current semantic
producer restart invalidates prior in-flight tokens
partial never writes confirmed aggregate
header/actions/banner update as one transaction
ready navigation contains selectedTabId
hidden section has no rows
```

### 20.4 Runtime adapter tests

- split and single adapter equivalent inputs produce equivalent facts;
- both construct and validate the same request tokens;
- split serialization handles missing/unknown/null fields explicitly;
- single runtime does not bypass stale-response validation;
- Extension worker restart is treated as a new producer instance.

### 20.5 Renderer contract tests

- React renderer imports only semantic/surface public APIs and intent dispatcher;
- Native DTO adapter imports Semantic/Surface and is the only DTO producer;
- Swift/Kotlin do not receive raw `backupStatus`, raw balance authority inputs,
  account type, or server config;
- `switch(model.kind)` is exhaustive;
- source code architecture checks ban imports, not all conditionals;
- TS/Swift/Kotlin decode the same JSON fixtures;
- invalid DTO produces resync/fallback, not business reinterpretation.

### 20.6 UI tests and evidence

Real screenshots required:

- Web/Desktop/Extension breakpoints;
- Mobile React Native/iOS Native/Android Native;
- Dark Mode;
- Dynamic Type sizes;
- long localized strings;
- first launch;
- new account;
- zero/funded/loading/error;
- image all-candidates-failed state;
- Legacy/Native header/tab/slot geometry.

Recordings or device traces required:

- rapid continuous tab switching;
- account/network A→B→A with delayed old responses;
- loading→empty/ready height stability;
- scroll offset, inertia, bottom reachability;
- hover/pressed/focus/touch feedback;
- Native slot replacement without old-owner flash;
- consecutive section patches;
- iOS/Android Native + RN slot synchronization;
- release-mode frame time and jank.

Compilation and unit tests cannot prove:

- actual font/Dynamic Type measurement;
- Native bridge scheduling and reordering;
- scroll/gesture ownership;
- visible layout jitter;
- image fallback pixels;
- release frame budget;
- stale-view one-frame flashes;
- accessibility focus behavior.

## 21. Performance Contract

### 21.1 React subscriptions

- publish immutable slices with structural sharing;
- unchanged `getSnapshot`/atom values keep the same reference;
- subscribe header, navigation, and each section independently;
- do not create new context atoms inside render;
- keep Home feature atoms in `states/jotai/contexts/home`;
- memoize only measured expensive selectors or new-reference outputs;
- do not depend on `useMemo` for correctness.

### 21.2 Snapshot and patch

Use full snapshot for:

- first attach;
- owner/session replacement;
- schema negotiation;
- explicit Native resync;
- measured cases where patch bytes exceed full snapshot bytes.

Use typed transaction patch for:

- shell transaction;
- navigation transaction;
- one section replacement/removal;
- surface-only changes.

Measure:

- full and patch bytes;
- JS serialization time;
- Native parsing time;
- apply/layout time;
- affected section count;
- dropped frames.

### 21.3 Requests

- keep independent requests parallel where safe;
- cap fan-out request concurrency at 3-5 when many chains/accounts are involved;
- cancellation saves resources but token rejection ensures correctness;
- avoid duplicate serialization on Desktop/Web single runtime;
- do not pass giant raw datasets through Native bridge when stable IDs/section
  slices suffice.

### 21.4 Lists and layout

- retain existing `ListView` built-in virtualization unless profiling proves a
  different need;
- preserve platform-specific scroll/gesture state in renderers;
- do not add semantic calculations to Native main-thread layout;
- reserved height must be part of SurfaceModel/slot contract;
- preserve stable item IDs across patches.

### 21.5 Cache and trace

- source-specific LRU/TTL and an overall byte budget;
- use the current eight-entry exact-scope limits as a compatibility baseline,
  not as a universal permanent constant;
- Phase 0/1 metrics must determine whether balance, capability, and section
  caches need different limits before increasing them;
- no unbounded per-owner maps;
- trace only owner/session hash, event category, transition reason, source ID,
  and duration;
- never trace wallet/account IDs, addresses, balances, or sensitive data in
  plaintext;
- use a bounded ring buffer and production sampling;
- disable expensive payload serialization in production trace.

## 22. Architecture Enforcement

Prevent future platform-specific business drift with automated boundaries:

1. Legacy renderer directories cannot import `facts`, `authority`, runtime
   adapters, raw Home service hooks, or raw capability sources.
2. Native DTO adapter is the only package/kit module allowed to construct Home
   Native DTOs.
3. Swift/Kotlin DTOs do not expose raw business inputs that invite recomputation.
4. Add AST/import-boundary tests for renderer directories.
5. Add source contract checks for DTO producer ownership.
6. Add semantic golden vectors to the normal validation profile.
7. Add cross-language DTO fixtures and protocol version tests.
8. Require a capability-matrix test whenever a new network/account/product
   condition is introduced.
9. Require a decision-vector update whenever a semantic union gains a new kind.
10. Allow exhaustive rendering conditionals; reject raw-value business
    derivations.

## 23. Risk Register

| Risk                            | Mitigation                                                 |
| ------------------------------- | ---------------------------------------------------------- |
| giant Home state machine        | only two lifecycle machine definitions; independent actors |
| Cartesian state explosion       | selectors + golden/property/pairwise tests                 |
| selector cycle                  | explicit dependency DAG; pure modules; cycle checks        |
| cache treated as live           | provenance in SemanticModel                                |
| cross-owner latest fallback     | exact SourceKey only                                       |
| partial-sum flicker             | complete coverage barrier                                  |
| stale async completion          | owner/session/source/request/producer token checks         |
| capability/server mismatch      | capability revision + required-set restart                 |
| Legacy/Native double judgment   | one Semantic publisher and import guards                   |
| DTO schema drift                | protocol/schema split + cross-language fixtures            |
| platform adds business `if`     | restricted imports/AST checks                              |
| stable height via wrong state   | Surface placeholder contract only                          |
| migration behavior drift        | shadow comparison and per-module compatibility adapter     |
| same semantic reinterpreted     | renderer contract and golden DTO fixtures                  |
| giant semantic object rerenders | transaction slices + structural sharing                    |
| Native patch gap/mixed UI       | owner/baseRevision/atomic apply/resync                     |
| stale Native action             | owner + rendered revision + command registry validation    |
| Extension worker loss           | producer handshake; replay idempotent reads only           |
| currency cache corruption       | quote basis and pricing revision in SourceKey              |
| cache persistence failure       | live commit first; guarded async cache effect              |

## 24. Expected Future File Scope

New candidates:

```text
packages/shared/src/types/homeRuntime/
packages/kit/src/views/Home/model/
packages/kit/src/states/jotai/contexts/home/
```

Likely existing integration points:

```text
packages/kit/src/hooks/useHomeBalanceState.ts
packages/kit/src/views/Home/pages/HomePageContainer.tsx
packages/kit/src/views/Home/pages/HomePageView.tsx
packages/kit/src/views/Home/pages/HomeHeaderContainer.tsx
packages/kit/src/views/Home/pages/HomeOverviewContainer.tsx
packages/kit/src/views/Home/pages/PortfolioContainer.tsx
packages/kit/src/views/Home/pages/PerpsContainer.tsx
packages/kit/src/views/Home/pages/DeFiContainer.tsx
packages/kit/src/views/Home/pages/NFTListContainer.tsx
packages/kit/src/views/Home/pages/TxHistoryContainer.tsx
packages/kit/src/views/Home/components/WalletActions/
packages/kit/src/views/Home/homeWalletCapabilityTabModel.ts
packages/kit/src/views/Home/hooks/useHomeWalletTabSupport.ts
packages/kit/src/views/Home/hooks/homeWalletTabSupportUtils.ts
packages/kit/src/views/Home/NativeHomePage.native.tsx
packages/kit/src/views/Home/nativeHomeBalanceAuthority.ts
packages/kit/src/views/Home/nativeHomePortfolioRequestLifecycle.ts
packages/kit/src/views/Home/nativeHomeDataAdapters.ts
packages/kit/src/views/Home/useNativeHome*Data.ts
packages/native-components/src/HomeContainer.types.ts
packages/native-components/src/HomeContainerController.ts
packages/native-components/src/HomeContainer.native.tsx
packages/native-components/ios/HomeContainerView.swift
packages/native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerView.kt
```

This is a candidate map, not authorization to edit every listed file in one
phase. Each implementation task must name its phase and limit its diff.

## 25. Validation Commands for Future Implementation

Do not run the ambiguous root `yarn test` alias as the primary targeted check.

For each phase:

1. run the exact affected Jest test files;
2. run the affected package type/lint check if needed;
3. run `yarn agent:check --profile commit` before a requested commit;
4. run `yarn agent:check --profile pr` before PR readiness.

Only use lower-level commands to diagnose a failed `agent:check`.

Do not run `yarn app:ios` or change simulators without explicit authorization.

## 26. External Architecture References

- Harel, Statecharts: <https://doi.org/10.1016/0167-6423(87)90035-9>
- W3C SCXML: <https://www.w3.org/TR/scxml/>
- React, Choosing the State Structure:
  <https://react.dev/learn/choosing-the-state-structure>
- React, You Might Not Need an Effect:
  <https://react.dev/learn/you-might-not-need-an-effect>
- React, useSyncExternalStore:
  <https://react.dev/reference/react/useSyncExternalStore>
- Redux, Deriving Data with Selectors:
  <https://redux.js.org/usage/deriving-data-selectors>
- Android UI layer/UDF:
  <https://developer.android.com/topic/architecture/ui-layer>
- Android state holders:
  <https://developer.android.com/topic/architecture/ui-layer/stateholders>
- TanStack Query keys:
  <https://tanstack.com/query/latest/docs/framework/react/guides/query-keys>
- TanStack Query cancellation:
  <https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation>
- Chrome Extension service worker lifecycle:
  <https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle>
- Chrome Extension messaging:
  <https://developer.chrome.com/docs/extensions/develop/concepts/messaging>
- RFC 6902 JSON Patch: <https://www.rfc-editor.org/rfc/rfc6902>
- TypeScript discriminated unions:
  <https://www.typescriptlang.org/docs/handbook/2/narrowing.html>

## 27. Final Answers

1. **Recommend state machines?** Yes, only for temporal async lifecycle.
2. **How many?** Two machine definitions; one session instance plus applicable
   resource instances.
3. **Machine responsibilities?** Runtime/session, request lifecycle,
   cancellation, stale rejection, retry, terminal completion, cache commands.
4. **Selector/table responsibilities?** Backup, authority, zero/funded, actions,
   banners, capability, tabs, selected fallback, section presentation.
5. **100% reusable semantics?** Owner authority, backup, balance authority,
   zero/funded, action IDs, capability, tabs, section states, stale rejection.
6. **Semantics only, not layout?** Heights, grid, breakpoints, Dynamic Type,
   hover/focus/pressed, scrolling, gestures, slots.
7. **Home Core package?** `packages/kit/src/views/Home/model/`; feature atoms in
   `packages/kit/src/states/jotai/contexts/home/`; only the JSON-safe low-level
   main/bg transport envelope may live in `packages/shared`.
8. **Unique Semantic exit?** `HomeSemanticStore` public publisher/materializer.
9. **Native DTO origin?** The sole adapter under
   `packages/kit/src/views/Home/model/native/`.
10. **React input?** Semantic slices + SurfaceModel + renderer-local visual
    state only.
11. **Split/single reuse?** Different transport adapters, identical facts,
    tokens, machines, policies, and semantics.
12. **Legacy coexistence?** Shadow model, compatibility adapters, incremental
    shell/navigation/section migration.
13. **Prevent new platform business logic?** Import/AST boundaries, DTO shape,
    golden contracts, capability tests.
14. **Detect semantic drift?** Golden vectors, shadow comparison, adapter
    conformance, cross-language fixtures, bounded semantic trace.
15. **First priority?** Scope/session/request authority; first visible module is
    balance/header/actions/banner.
16. **Expected files?** Listed in section 24; edit only the files required by the
    active phase.
17. **Real screenshots/recordings?** Cross-platform layout, Dark Mode, Dynamic
    Type, interaction states, slots, height, scrolling, images, rapid switching.
18. **Not provable by compile/unit tests?** Real bridge timing, font/layout,
    scrolling, gesture ownership, stale one-frame flashes, images,
    accessibility focus, release frame budget.

## 28. Implementation Start Gate

Implementation must not start merely because this document exists.

Before Phase 0 or Phase 1 begins, the user must confirm:

1. the two-machine architecture;
2. the package boundary;
3. the owner/session/source/request identity;
4. the balance aggregation completeness rule;
5. the split/single adapter contract;
6. the Native protocol-v2 direction;
7. the migration order;
8. the first implementation phase and exact permitted file scope.
