# Source-scanning test audit

## Scope

This audit covers test files changed on the current branch compared with `x`.
The branch changes 132 test files. Twenty-five of them read source files or
configuration with `readFileSync` or `existsSync`.

After the two cleanup batches, none of those 25 files still infer production
behavior from source or configuration text.

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
| Removed | 4 | `development/scripts/react-native-skeleton-lifecycle-patch.node-test.js` | Android disposal order and patch scope from Kotlin/patch text | Removed; lifecycle behavior remains in the Android churn test and patch scope belongs to the patch-generation workflow |
| Removed | 5 | `packages/kit/src/views/Home/NativeHomeRuntimeSurface.test.tsx` | Cross-package renderer wiring, native owner switching, Android list updates, and deleted files | Removed; native behavior remains in TS/Swift/Kotlin protocol tests, and the real feature-flag assertion moved to `nativeHomeFeatureFlag.native.test.ts` |
| Removed | 8 | `packages/kit/src/views/Home/components/DeFiListBlock/DeFiListBlock.storeAuthority.test.ts` | Renderer ownership, request ordering, polling, events, and aggregation | Removed; controller behavior is now rendered in `HomeDeFiStoreController.test.tsx` |
| Removed | 3 | `packages/kit/src/views/Home/components/PopularTrading/PopularTrading.storeAuthority.test.ts` | Market Store display authority and lack of renderer requests | Removed; Market request and payload behavior remains in `HomeMarketStoreController.test.ts` |
| Removed | 8 | `packages/kit/src/views/Home/components/TokenListBlock/TokenListBlock.storeBoundary.test.ts` | Portfolio producer ownership, polling, request fencing, and finalization | Removed; no coverage claim is made from implementation text |
| Removed | 2 | `packages/kit/src/views/Home/components/WalletBanner/WalletBanner.storeBoundary.test.ts` | Banner renderer and root-controller ownership | Removed; banner commands remain covered by Store command/reducer tests |
| Fixed | 3 | `packages/kit/src/views/Home/model/react/HomeDeFiStoreController.test.tsx` | DeFi applicability, visibility, and source identity handling | Replaced with component tests for tab activation, recovery registration, refresh commands, position actions, and acknowledgement |
| Fixed | 2 | `packages/kit/src/views/Home/model/react/HomeDisplaySnapshotController.shared.test.tsx` | Lazy source selection and non-blocking warming | Replaced with a mounted controller test that verifies initial hydration order and the exact warmed source IDs |
| Cleaned | 3 | `packages/kit/src/views/Home/model/react/HomeHistoryStoreController.test.ts` | Controller ownership, pagination, and inactive-tab hydration | Removed source assertions; retained request ordering, stale completion, side-effect, payload, and pure pagination tests |
| Cleaned | 1 | `packages/kit/src/views/Home/model/react/HomeMarketStoreController.test.ts` | All Market producers live outside the renderer | Removed source assertions; retained request, failure, prefetch, recommendation, and control normalization tests |
| Fixed | 1 | `packages/kit/src/views/Home/model/react/HomePerpsStoreController.test.tsx` | Producer activation and recovery registration | Replaced with component rendering that verifies producer arguments, recovery registration, tab transitions, and command acknowledgement |
| Cleaned | 2 | `packages/kit/src/views/Home/model/react/useHomeNFTStoreSource.test.ts` | No renderer-facing state and identity implementation shape | Removed source assertions; retained five mounted hook tests covering cache/live ordering, inactive hydration, manual refresh, and all-network completion |
| Fixed | 3 | `packages/kit/src/views/Home/model/tests/homeStoreActionBoundary.test.ts` | Internal action exports and consumer allowlists | Replaced with an exhaustive TypeScript public-action key contract; import restrictions belong to lint/module boundaries |
| Removed | 7 | `packages/kit/src/views/Home/model/tests/homeUnifiedStoreProductionBoundary.test.ts` | Unified Store architecture from forbidden strings, component text counts, deleted files, and hook names | Removed. Controller composition is already rendered in `HomeStoreSourceControllers.test.tsx`; remaining behavior belongs in the owning component/hook tests |
| Cleaned | 2 | `packages/kit/src/views/Home/pages/HomeBackgroundRecoveryRefreshProvider.test.tsx` | Event absence and layout-effect implementation | Removed source assertions; retained the provider's mounted transaction, dedupe, owner, suspension, and platform tests |
| Removed | 3 | `packages/kit/src/views/Home/pages/HomeControllerOwnership.test.ts` | Header, Wallet Home, and URL Account controller placement | Removed; Wallet Home and source composition are already rendered by `HomePageContainer.test.tsx` and `HomeStoreSourceControllers.test.tsx` |
| Removed | 2 | `packages/kit/src/views/Home/pages/HomePageView.storeTabAuthority.test.ts` | Store-selected tab authority and local state implementation | Removed; navigation and tab behavior remains in reducer, semantic, and page tests |
| Removed | 3 | `packages/kit/src/views/Home/pages/NFTListContainer.storeAuthority.test.ts` | NFT renderer/controller ownership and deleted producer | Removed; NFT source behavior remains in the mounted hook suite |
| Removed | 3 | `packages/kit/src/views/Home/pages/PerpsContainer.storeAuthority.test.ts` | Perps display authority, loading fallback, and lack of duplicate sources | Removed; Perps controller and projection policies have real tests |
| Removed | 4 | `packages/kit/src/views/Home/pages/TxHistoryContainer.storeAuthority.test.ts` | History payload authority, renderer restrictions, and deleted producer | Removed; History controller utilities and Store model behavior have real tests |
| Cleaned | 6 | `packages/kit/src/views/Home/pages/usePerpsHomePortfolio.test.ts` | Scope invalidation, prefetch activation, request ordering, errors, and completion ordering | Removed source assertions; retained six pure scope, persistence, authority, and evidence projection tests |
| Fixed | 1 | `packages/kit/src/views/Prime/hooks/purchasesSdkLogout.native.test.ts` | Dynamic rather than static RevenueCat import | Replaced with a module-evaluation assertion proving RevenueCat loads only after `logoutPurchasesSdk` is called |
| Cleaned | 2 | `packages/native-components/src/HomeContainerBackground.test.ts` | Prop wiring and initial-state effect implementation | Removed source assertions; retained the pure background-color authority tests |
| Removed | 1 | `packages/native-components/src/importHierarchy.test.ts` | Presence of `no-restricted-imports` configuration | Removed; the repository type-aware oxlint gate is the enforcement mechanism |
| Fixed | 1 | `packages/shared/src/utils/nftUtils.test.ts` | Absence of a runtime transport import | Replaced with a mocked-module evaluation assertion while retaining the pure result assertion |

## Resolution principles

- Deleting a source assertion does not claim that the described behavior is
  covered.
- Existing behavior tests were retained even when they shared a file with
  source assertions.
- New tests were added only where an observable component, hook, module-load,
  or pure-function contract was available.
- Import and package constraints remain the responsibility of type-aware lint
  and module visibility.

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

### Batch 2

- Replaced DeFi Controller and Display Snapshot source assertions with mounted
  component tests.
- Removed source-only renderer/authority/tombstone suites.
- Removed source blocks from mixed History, Market, NFT, background recovery,
  Perps, and native background suites while preserving real tests.
- Replaced the Home action boundary scan with an exhaustive TypeScript public
  key contract.
- Reduced the audited source/config-reading test file count from 21 to 0.
