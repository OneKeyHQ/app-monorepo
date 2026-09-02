// Outcome vocabularies for every account selector operation.
//
// These strings are read in three places that cannot see each other: control
// flow inside the actions, perf trace assertions in the web e2e suite, and
// humans reading logs. A bare string literal satisfies all three until someone
// renames one end, and nothing fails - the branch silently stops matching and
// the e2e filter silently finds nothing. Enums give every value one definition
// to rename from.
//
// String values are the wire format. They are asserted verbatim by
// apps/web/e2e/account-selector.e2e.js, which is plain JS and cannot import
// this file, so changing a value is a breaking change to that suite.

/** reloadActiveAccountInfo() - returned to callers, drives AccountSelectorEffects. */
export enum EActiveReloadOutcome {
  Commit = 'commit',
  Noop = 'noop',
  SkipIncomplete = 'skip-incomplete',
  StaleAfterBuild = 'stale-after-build',
  StaleBeforeBuild = 'stale-before-build',
  StaleScheduleBeforeBuild = 'stale-schedule-before-build',
}

/** How the background build behind a reload resolved. */
export enum EBuildActiveAccountOutcome {
  ErrorFallback = 'error-fallback',
  Partial = 'partial',
  Success = 'success',
}

/** updateSelectedAccount() - returned to callers. */
export enum ESelectionUpdateOutcome {
  Commit = 'commit',
  // Trace-only: the mutex body threw and the error is rethrown to the caller,
  // so this value never reaches ISelectionUpdateResult.
  Error = 'error',
  Noop = 'noop',
  SkipEmpty = 'skip-empty',
  // Compare-if-newer drops for event-driven updates (`eventUpdatedAt`): the
  // event's own source revision lost against the revision already committed,
  // which is the sync protocol converging, not a caller losing its update.
  // Kept apart from Stale so they never feed the repeated-stale-drop alert.
  SkipEqualEventConflict = 'skip-equal-event-conflict',
  SkipOlderEvent = 'skip-older-event',
  // An event that carried no source revision (`eventUpdatedAt: null`) arrived
  // while this runtime already holds a committed revision. Such events are
  // cold-start replays of a disk snapshot, not user actions, so they may only
  // fill a slot that has no revision at all. Same family as the two skips
  // above: protocol convergence, never counted toward the stale-drop alert.
  SkipUnversionedEvent = 'skip-unversioned-event',
  Stale = 'stale',
}

/** Which guard rejected a selection update. */
export enum ESelectionStaleGuard {
  CommitGuard = 'commit-guard',
  // Narrow CAS (`expectedPartialSelection`): only the fields the caller's
  // decision was derived from went stale, unrelated fields are ignored.
  PartialSelection = 'partial-selection',
  Revision = 'revision',
  Selection = 'selection',
}

/** confirmAccountSelect() perf trace. */
export enum EAccountSelectOutcome {
  Commit = 'commit',
  Error = 'error',
  Stale = 'stale',
  StaleAfterCommit = 'stale-after-commit',
  UnavailableWallet = 'unavailable-wallet',
  WalletCheckError = 'wallet-check-error',
}

/** syncHomeAndSwapSelectedAccount() cross scene sync. */
export enum ECrossSceneSyncOutcome {
  Error = 'error',
  SkipPolicy = 'skip-policy',
  // Only for a same-scene event that is this runtime's own local echo (no
  // $$isRemoteEvent). A same-scene event from a peer runtime is applied
  // through compare-if-newer and forwards the selection-update verdict
  // (commit/noop/skip-*) instead.
  SkipSameScene = 'skip-same-scene',
  StaleBeforeFix = 'stale-before-fix',
}

// The sync forwards the selection update's own verdict when it gets that far,
// so both vocabularies reach the same trace field.
export type ICrossSceneSyncOutcome =
  | ECrossSceneSyncOutcome
  | ESelectionUpdateOutcome;

/** syncLocalDeriveTypeFromGlobal() global derive type sync. */
export enum EAutoDeriveSyncOutcome {
  Error = 'error',
  NoGlobalDerive = 'no-global-derive',
  NoopAlreadySelected = 'noop-already-selected',
}

export type IAutoDeriveSyncOutcome =
  | EAutoDeriveSyncOutcome
  | ESelectionUpdateOutcome;

/** initFromStorage() stages, also composed into its stale outcomes. */
export enum EStorageInitPhase {
  ApplyStorage = 'apply-storage',
  BackgroundCasRejectedCurrentCleanup = 'background-cas-rejected-current-cleanup',
  BackgroundCasRejectedRecentCleanup = 'background-cas-rejected-recent-cleanup',
  BackgroundCasRejectedStorageCleanup = 'background-cas-rejected-storage-cleanup',
  CurrentSelection = 'current-selection',
  DiscoverConnection = 'discover-connection',
  NormalizeStorage = 'normalize-storage',
  ReadPrimary = 'read-primary',
  RecentSelection = 'recent-selection',
  SwapMerge = 'swap-merge',
}

export enum EStorageInitOutcomeBase {
  ErrorFinalized = 'error-finalized',
  KeptCurrentSelection = 'kept-current-selection',
  ReadyFinalized = 'ready-finalized',
  ReadyNoStorage = 'ready-no-storage',
  RestoredRecentCache = 'restored-recent-cache',
  RestoredStorage = 'restored-storage',
  StorageAlreadyCurrent = 'storage-already-current',
}

// A generation newer than ours took over; the phase we reached is part of the
// outcome so a log line says where it was abandoned without a second field.
export type IStorageInitOutcome =
  | EStorageInitOutcomeBase
  | `stale-${EStorageInitPhase}`;

/** saveToStorage() persistence result. */
export enum EStorageSaveOutcome {
  JoinInflight = 'join-inflight',
  NoopAlreadySaved = 'noop-already-saved',
  Persisted = 'persisted',
  SkipCompletedRevision = 'skip-completed-revision',
  SkipDefaultSelection = 'skip-default-selection',
  SkipIncompatible = 'skip-incompatible',
  SkipInitPending = 'skip-init-pending',
  SkipNoIdentity = 'skip-no-identity',
  SkipNotReady = 'skip-not-ready',
  StaleAfterFix = 'stale-after-fix',
  StaleAfterGlobalDerive = 'stale-after-global-derive',
  StaleAfterWrite = 'stale-after-write',
  StaleBeforeEvent = 'stale-before-event',
  StaleBeforeFix = 'stale-before-fix',
  StaleBeforeRead = 'stale-before-read',
  StaleBeforeWrite = 'stale-before-write',
  StaleSelectionIntent = 'stale-selection-intent',
  // Terminal results of a save that reached the write.
  Error = 'error',
  Partial = 'partial',
  ProcessedNonpersistent = 'processed-nonpersistent',
  ReplayedSideEffects = 'replayed-side-effects',
}

/** savePersistentlyUnavailableWalletSelectionToStorage() result. */
export enum EUnavailableSelectionStorageOutcome {
  NoopAlreadySaved = 'noop-already-saved',
  Persisted = 'persisted',
  ProcessedNonpersistent = 'processed-nonpersistent',
}

/** autoSelectNextAccount() result. */
export enum EAutoSelectOutcome {
  ClearedRemovedAccount = 'cleared-removed-account',
  Error = 'error',
  NoopNotNeeded = 'noop-not-needed',
  SkipNotReady = 'skip-not-ready',
  SkipScene = 'skip-scene',
  StaleUserSelection = 'stale-user-selection',
}

export type IAutoSelectOutcome = EAutoSelectOutcome | ESelectionUpdateOutcome;

/** syncFromScene() result. */
export enum ESceneSyncOutcome {
  Error = 'error',
}

export type ISceneSyncOutcome = ESceneSyncOutcome | ESelectionUpdateOutcome;

/**
 * AccountSelectorEffects: whether a scheduled reload reached the action.
 * Diagnostics only - no branch reads these, unlike EActiveReloadOutcome.
 */
export enum EActiveReloadDispatchOutcome {
  CancelledStaleScheduler = 'cancelled-stale-scheduler',
  Dispatch = 'dispatch',
  Error = 'error',
  SkipNotReady = 'skip-not-ready',
  SkipTransferFlow = 'skip-transfer-flow',
}

/** AccountSelectorEffects: what followed a completed reload. */
export enum EActiveReloadPostProcessOutcome {
  Error = 'error',
  SkipStaleAction = 'skip-stale-action',
  SkipStaleScheduler = 'skip-stale-scheduler',
  Success = 'success',
}

/** AccountSelectorEffects: the auto-save-to-storage effect. */
export enum ESelectionStorageEffectOutcome {
  CancelledCleanup = 'cancelled-cleanup',
  SkipDefaultSelection = 'skip-default-selection',
  SkipDuplicateRevision = 'skip-duplicate-revision',
  SkipInitPending = 'skip-init-pending',
  SkipNotReady = 'skip-not-ready',
}

/** useExternalAccountActivate() peer wallet sync. */
export enum EExternalActivateOutcome {
  Cancelled = 'cancelled',
  Error = 'error',
  Synced = 'synced',
}

/** useAutoSelectDeriveType() result. */
export enum EAutoSelectDeriveTypeOutcome {
  Cancelled = 'cancelled',
  Error = 'error',
  NoDeriveOptions = 'no-derive-options',
  SkipExistingDerive = 'skip-existing-derive',
  StaleNetwork = 'stale-network',
}

// The hook reports the selection update's own verdict, and prefixes it with
// 'global-' when the verdict came from the global derive type sync rather than
// from its own fallback.
export type IAutoSelectDeriveTypeOutcome =
  | EAutoSelectDeriveTypeOutcome
  | ESelectionUpdateOutcome
  | `global-${ESelectionUpdateOutcome | 'resolved'}`;

/** updateHwWalletsDeprecatedStatus() / updateTrezorWalletsDeprecatedStatus(). */
export enum EWalletDeprecatedStatusUpdateOutcome {
  Error = 'error',
  Success = 'success',
}

/** useAccountSelectorAvailableNetworks() resolution. */
export enum EAvailableNetworksOutcome {
  Error = 'error',
  Success = 'success',
}
