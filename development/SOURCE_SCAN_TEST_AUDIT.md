# Source-scanning test audit

## Scope

This audit covers test files changed on the current branch compared with `x`.
The branch changes 132 test files. Twenty-five of them read source files or
configuration with `readFileSync` or `existsSync`.

The problematic pattern is narrower than the presence of `toContain` itself:

- A test reads production source code as text.
- It infers runtime behavior, ownership, ordering, or architecture from string
  presence, absence, or position.
- Renames and formatting can fail the test without changing behavior.
- Aliases, wrappers, indirection, or equivalent implementations can pass the
  test while violating the intended behavior.

Assertions against returned values, rendered trees, serialized fixtures, or
parsed data structures are not included merely because they use `toContain`.

## Replacement rules

1. Render React components or hooks with Jest and assert observable calls,
   output, effects, cleanup, and ordering.
2. Extract deterministic policies and projections as pure functions and test
   their inputs and outputs.
3. Enforce import boundaries with the actual lint rule or a compiler-visible
   module boundary, not a Jest string scan.
4. Test native behavior in Swift/Kotlin protocol or component tests.
5. Delete migration tombstone checks for files that no longer exist.

## Inventory

`Blocks` counts source-based `it`/`test` blocks, not the number of individual
assertions. `homeUnifiedStoreProductionBoundary.test.ts` had seven blocks but
its parameterized renderer block expanded to eight Jest cases.

| Status | Blocks | Test file | What the source scan claims to verify | Required replacement |
| --- | ---: | --- | --- | --- |
| Pending | 4 | `development/scripts/react-native-skeleton-lifecycle-patch.node-test.js` | Android disposal order and patch scope from Kotlin/patch text | Run the patched lifecycle implementation in the Android churn test; validate patch scope in the patch-generation workflow |
| Pending | 5 | `packages/kit/src/views/Home/NativeHomeRuntimeSurface.test.tsx` | Cross-package renderer wiring, native owner switching, Android list updates, and deleted files | Render the registered renderer/provider; use the existing TS/Swift/Kotlin protocol tests for native behavior; delete tombstone checks |
| Pending | 8 | `packages/kit/src/views/Home/components/DeFiListBlock/DeFiListBlock.storeAuthority.test.ts` | Renderer ownership, request ordering, polling, events, and aggregation | Render the DeFi surfaces and controller with mocked Store/BG gateways; extract request coordination policies |
| Pending | 3 | `packages/kit/src/views/Home/components/PopularTrading/PopularTrading.storeAuthority.test.ts` | Market Store display authority and lack of renderer requests | Render `PopularTrading` from Store payloads and assert intents/output; enforce forbidden imports through lint/module boundaries |
| Pending | 8 | `packages/kit/src/views/Home/components/TokenListBlock/TokenListBlock.storeBoundary.test.ts` | Portfolio producer ownership, polling, request fencing, and finalization | Render the controller/hook and assert gateway ordering and stale response rejection; extract finalization policies |
| Pending | 2 | `packages/kit/src/views/Home/components/WalletBanner/WalletBanner.storeBoundary.test.ts` | Banner renderer and root-controller ownership | Render `WalletBanner` and `HomeBannerStoreController`; assert payload rendering, intents, and source calls |
| Pending | 3 | `packages/kit/src/views/Home/model/react/HomeDeFiStoreController.test.ts` | DeFi applicability, visibility, and source identity handling | Render the controller for tab transitions; test identity/request-handle policies as pure functions |
| Pending | 2 | `packages/kit/src/views/Home/model/react/HomeDisplaySnapshotController.shared.test.ts` | Lazy source selection and non-blocking warming | Mount the controller with a deferred repository and assert initial hydration completes before background chunks; extract source selection |
| Pending | 3 | `packages/kit/src/views/Home/model/react/HomeHistoryStoreController.test.ts` | Controller ownership, pagination, and inactive-tab hydration | Keep existing request utility tests; render the controller for polling/load-more/visibility behavior |
| Pending | 1 | `packages/kit/src/views/Home/model/react/HomeMarketStoreController.test.ts` | All Market producers live outside the renderer | Keep existing request/prefetch pure tests; mount the controller and assert actual API and refresh registrations |
| Fixed | 1 | `packages/kit/src/views/Home/model/react/HomePerpsStoreController.test.tsx` | Producer activation and recovery registration | Replaced with component rendering that verifies producer arguments, recovery registration, tab transitions, and command acknowledgement |
| Pending | 2 | `packages/kit/src/views/Home/model/react/useHomeNFTStoreSource.test.ts` | No renderer-facing state and identity implementation shape | Keep the existing hook behavior tests; add stale-response cases and remove implementation-shape assertions |
| Pending | 3 | `packages/kit/src/views/Home/model/tests/homeStoreActionBoundary.test.ts` | Internal action exports and consumer allowlists | Make internal actions unavailable from the public module; enforce imports with lint/TypeScript boundaries |
| Removed | 7 | `packages/kit/src/views/Home/model/tests/homeUnifiedStoreProductionBoundary.test.ts` | Unified Store architecture from forbidden strings, component text counts, deleted files, and hook names | Removed. Controller composition is already rendered in `HomeStoreSourceControllers.test.tsx`; remaining behavior belongs in the owning component/hook tests |
| Pending | 2 | `packages/kit/src/views/Home/pages/HomeBackgroundRecoveryRefreshProvider.test.tsx` | Event absence and layout-effect implementation | Keep the extensive provider behavior tests; add a suspended-owner commit test and remove source assertions |
| Pending | 3 | `packages/kit/src/views/Home/pages/HomeControllerOwnership.test.ts` | Header, Wallet Home, and URL Account controller placement | Render each owning page/provider with controller probes and assert mount/unmount counts |
| Pending | 2 | `packages/kit/src/views/Home/pages/HomePageView.storeTabAuthority.test.ts` | Store-selected tab authority and local state implementation | Render tab changes from Store navigation and assert pager/intent behavior |
| Pending | 3 | `packages/kit/src/views/Home/pages/NFTListContainer.storeAuthority.test.ts` | NFT renderer/controller ownership and deleted producer | Render the NFT container and controller; retain the existing NFT source hook behavior tests; delete tombstone check |
| Pending | 3 | `packages/kit/src/views/Home/pages/PerpsContainer.storeAuthority.test.ts` | Perps display authority, loading fallback, and lack of duplicate sources | Render loading/empty/ready Store payloads and assert output; verify producer calls through controller tests |
| Pending | 4 | `packages/kit/src/views/Home/pages/TxHistoryContainer.storeAuthority.test.ts` | History payload authority, renderer restrictions, and deleted producer | Render full/recent History from Store payloads; assert intent/load-more behavior; delete tombstone check |
| Pending | 6 | `packages/kit/src/views/Home/pages/usePerpsHomePortfolio.test.ts` | Scope invalidation, prefetch activation, request ordering, errors, and completion ordering | Keep existing pure scope/projection tests; extract request orchestration or test the hook with deferred BG promises |
| Fixed | 1 | `packages/kit/src/views/Prime/hooks/purchasesSdkLogout.native.test.ts` | Dynamic rather than static RevenueCat import | Replaced with a module-evaluation assertion proving RevenueCat loads only after `logoutPurchasesSdk` is called |
| Pending | 2 | `packages/native-components/src/HomeContainerBackground.test.ts` | Prop wiring and initial-state effect implementation | Render `HomeContainer` with a mocked native host and assert submitted props/effects |
| Replace with lint execution | 1 | `packages/native-components/src/importHierarchy.test.ts` | Presence of `no-restricted-imports` configuration | Run oxlint against positive and negative fixture imports, or rely on the repository lint gate |
| Fixed | 1 | `packages/shared/src/utils/nftUtils.test.ts` | Absence of a runtime transport import | Replaced with a mocked-module evaluation assertion while retaining the pure result assertion |

## Priorities

### P0: remove duplicate source-only suites

- `homeUnifiedStoreProductionBoundary.test.ts`
- `HomeControllerOwnership.test.ts`
- Per-renderer `*.storeAuthority.test.ts` and `*.storeBoundary.test.ts`

These suites provide no runtime evidence and substantially duplicate each
other.

### P1: preserve mixed suites while replacing only bad blocks

- Controller and hook suites with existing real behavior tests
- `HomeBackgroundRecoveryRefreshProvider.test.tsx`
- `usePerpsHomePortfolio.test.ts`
- `HomeContainerBackground.test.ts`

### P2: move static constraints to their real enforcement layer

- Import hierarchy
- Dynamic-import requirements
- Public/internal API boundaries
- Patch-package scope validation

## Progress

### Batch 1

- Removed `homeUnifiedStoreProductionBoundary.test.ts`.
- Replaced the source assertions in `HomePerpsStoreController.test.tsx` with
  real component/effect tests.
- Reused the existing rendered composition coverage in
  `HomeStoreSourceControllers.test.tsx` instead of preserving duplicate source
  scans.
- Replaced RevenueCat and NFT transport source scans with runtime module
  evaluation assertions.
- Reduced the changed-branch source/config-reading test file count from 25 to
  21.
