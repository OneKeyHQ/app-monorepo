# PR 12371 Review Findings Fix Plan

Date: 2026-07-09
PR: OneKeyHQ/app-monorepo#12371
Branch under review: `feat/defi-lending-step-ux-v2`
Base branch: `x`

## Purpose

This document records the verified review findings for PR 12371, the repair
order, and the implementation status after the fix pass. It is intended as a
follow-up checklist so later review can focus on the remaining verification
instead of rediscovering the DeFi transaction state-machine behavior.

## Implementation Status

Last updated: 2026-07-09

- Conflict shape with `x`: code migrated to `x`'s
  `useUniversalBorrowWithdrawRepayHooks.ts` split and the PR settle behavior was
  moved into the new helper. Local `git merge-tree upstream/x HEAD` still checks
  the pre-fix HEAD until these working-tree changes are committed.
- Mono font fallback: fixed in `packages/components/tamagui.config.ts`.
- Borrow settle timeout: fixed with a regression test for no-`onSettleResult`
  legacy `onSuccess`.
- Generic DeFi loading: fixed by deferring submit guard release to
  settle/fail/cancel/catch in both generic position dialogs.
- Borrow lending approve session: fixed by arming `approveSessionActive` only
  from `onAllowanceReady()`.
- DeFi confirm sheet polling after close: fixed by aborting receipt polling when
  the user dismisses the pending sheet.
- Focused Jest, Prettier, oxlint, `git diff --check`, and
  `yarn agent:check --profile commit` passed for the current working tree.

## Runtime Scope

Most findings are `main` runtime UI/state issues:

- Runtime scope: `main`.
- Native resource ownership: no direct native resource mutation in the findings,
  except calls through `backgroundApiProxy` to bg services.
- JS heap copies: dialog state, loading flags, and hook refs are per-main-runtime
  React state. Data returned by bg services is deserialized into the main JS heap.
- Timing/order: the signature-confirm modal is pushed from the main runtime and
  later invokes callback props. `navigationToTxConfirm()` only prepares/pushes the
  confirm route; it does not wait for user signing, broadcast, receipt polling, or
  callback completion.

Background service calls involved:

- `serviceStaking.addEarnOrder()`
- `serviceStaking.clearBorrowAssetsListCache()`
- `serviceDeFi.refreshAccountDeFiPositionsAfterAction()`
- `serviceHistory.fetchTxDetails()`

These calls cross into bg-owned services, but the user-visible regressions here
are caused by main-runtime UI lifecycle and callback timing.

## Verified Findings

### 1. Merge Conflict Against `x`

Priority: High
Confidence: High
Status: Code-level fix prepared; final mergeability verification pending commit
Type: Build / merge blocker

Evidence:

- `gh pr view 12371 --repo OneKeyHQ/app-monorepo --json mergeable,mergeStateStatus`
  returned `mergeable=CONFLICTING` and `mergeStateStatus=DIRTY`.
- `git merge-tree --write-tree upstream/x HEAD` reported a content conflict in:
  `packages/kit/src/views/Borrow/hooks/useUniversalBorrowHooks.ts`.

Impact:

- PR cannot be merged as-is.
- The conflict is in the same file that owns the borrow success/settle behavior,
  so fixing business logic before resolving the conflict risks rework.

Fix direction:

1. Rebase or merge latest `x` into the PR branch.
2. Resolve `useUniversalBorrowHooks.ts` by preserving both upstream changes and
   the PR's settle plumbing where still needed.
3. Re-run the focused borrow hook tests before touching dependent dialogs.

Implemented fix:

- Added `packages/kit/src/views/Borrow/hooks/useUniversalBorrowWithdrawRepayHooks.ts`
  using the helper split that already exists on `x`.
- Re-exported `useUniversalBorrowRepay()` and `useUniversalBorrowWithdraw()` from
  `useUniversalBorrowHooks.ts`.
- Moved the PR's `onSettleResult` and `onCancel` plumbing into the new helper.
- Preserved `useUniversalBorrowRepayWithCollateral()` in
  `useUniversalBorrowHooks.ts`, where it now imports shared borrow helpers.

Pass condition:

- GitHub no longer reports `CONFLICTING`.
- A local merge simulation against current `x` reports no conflicts.

### 2. Mono Font Fallback Regression

Priority: High
Confidence: High
Status: Fixed
Type: Web/Desktop UI regression

Files:

- `packages/components/tamagui.config.ts`
- `packages/components/src/hocs/Provider/web-fonts.css`

Evidence:

- PR removed the web/desktop mono fallback constants:
  - `monoRegularFontFamily`
  - `monoMediumFontFamily`
- Current PR code uses only:
  - `family: 'GeistMono-Regular'`
  - `family: 'GeistMono-Medium'`
- `web-fonts.css` sets GeistMono `font-display: optional`.

Why this matters:

With `font-display: optional`, browser font loading may decide not to swap in the
custom face. Without a fallback family in Tamagui's font stack, `$monoRegular`
and `$monoMedium` text can fall back to the browser/default proportional font
instead of a monospace family.

Likely affected surfaces:

- addresses
- signature confirmation
- orderbook / market numeric columns
- tickers
- any `$mono*` DeFi, send, receive, history, or market text

Fix direction:

Restore platform-specific font family constants:

```ts
const monoRegularFontFamily = isTamaguiNative
  ? 'GeistMono-Regular'
  : '"GeistMono-Regular", monospace';
const monoMediumFontFamily = isTamaguiNative
  ? 'GeistMono-Medium'
  : '"GeistMono-Medium", "GeistMono-Regular", monospace';
```

Then use those constants in `monoRegularFont` and `monoMediumFont`.

Do not change native font names unless native font registration is separately
validated.

Pass condition:

- Web/desktop `$monoRegular` has a monospace fallback.
- Web/desktop `$monoMedium` falls back to regular GeistMono and then monospace.
- Native continues to use the registered GeistMono font names directly.

Implemented fix:

- Restored `monoRegularFontFamily` and `monoMediumFontFamily`.
- Kept native font registration names unchanged.

### 3. Borrow Settle Timeout Skips Legacy `onSuccess`

Priority: Medium
Confidence: High
Status: Fixed
Type: Behavior change / refresh regression

File:

- `packages/kit/src/views/Borrow/hooks/useUniversalBorrowHooks.ts`

Evidence:

- PR changed the borrow success path from "skip `onSuccess` only on Failed" to
  "continue only on Success".
- Current code returns early when:
  - final status is `Failed`
  - final status is `undefined`
  - `onSettleResult` returns `false`
- Added tests explicitly assert that undefined settle status skips `onSuccess`.
- Inline comment says this applies to callers with no `onSettleResult`, including
  the Aave ManagePosition page.

Affected flow:

`Borrow ManagePosition -> WithdrawSection -> useUniversalBorrowRepay/Withdraw`

`ManagePositionContent.handleOperationSuccess()` owns:

- `refreshManageData()`
- `refreshPendingRef.current?.()`
- `onStakeWithdrawSuccess?.()`
- modal pop when `isInModalContext`

When receipt polling exhausts and returns `undefined`, the current PR can skip
that legacy success callback even though a transaction was broadcast.

Fix direction:

Keep the new `onSettleResult` override for dialog-owned flows, but preserve old
semantics for callers that did not opt into the new settle contract.

Recommended rule:

- If `onSettleResult` is provided:
  - call it with `{ status, data }`
  - return early if it returns `false`
  - return early for non-`Success` statuses unless the callback explicitly
    handled the state and allowed continuation
- If `onSettleResult` is not provided:
  - preserve legacy behavior: only explicit `Failed` skips `onSuccess`
  - `undefined` should still call `onSuccess` because broadcast succeeded and
    the old refresh/pending path must run

Pass condition:

- Existing PR dialog flows still keep success-only refresh guarded by final
  status.
- A ManagePosition withdraw/repay tx whose receipt poll exhausts still triggers
  `handleOperationSuccess()`.
- Focused tests cover both:
  - with `onSettleResult`, undefined can be handled by the dialog and skip legacy
    success
  - without `onSettleResult`, undefined preserves legacy `onSuccess`

Implemented fix:

- `handleBorrowSuccess()` now applies final-status gating differently based on
  whether the caller supplied `onSettleResult`.
- Dialog-owned flows with `onSettleResult` still skip legacy `onSuccess` for
  non-`Success` statuses.
- Legacy callers without `onSettleResult` skip only explicit `Failed`; undefined
  settle status continues to call `onSuccess`.
- Added test coverage for the no-`onSettleResult` timeout path.

### 4. Generic DeFi Action Loading Releases Too Early

Priority: Medium
Confidence: High
Status: Fixed
Type: Runtime / UX

Files:

- `packages/kit/src/components/DeFi/ProtocolPositionActionDialog.tsx`
- `packages/kit/src/components/DeFi/ProtocolLendingActionDialogContent.tsx`

Evidence:

- `navigationToTxConfirm()` in `useSignatureConfirm.ts` prepares unsigned txs and
  pushes the signature confirm modal.
- It returns after navigation setup, not after user signing or receipt settle.
- `TxConfirmActions` calls `onSuccess?.(result)` without awaiting the returned
  promise.
- In generic DeFi action content, the dialog `finally` block calls
  `setSubmitting(false)` after `submitProtocolPositionAction()` returns.
- Therefore the footer loading state can stop while the tx confirm modal,
  pending sheet, or settle callback is still active.

Affected current code shape:

- `ProtocolPositionActionDialogContent.handleConfirm()`
  - sets `submitting=true`
  - awaits `submitProtocolPositionAction()`
  - unconditionally sets `submitting=false` in `finally`
- `ProtocolLendingActionDefiContent.handleConfirm()`
  - same pattern for DeFi-backed lending action content

Fix direction:

Use a deferred release model:

1. Set a synchronous guard before navigating.
2. Do not release the guard immediately after `navigationToTxConfirm()` returns.
3. Release in explicit terminal branches:
   - `onSettleResult` closes to page
   - `onSettleResult` stays and refreshes
   - `onFail`
   - `onCancel`
   - tx confirm initialization error before confirm UI opens
4. Keep the footer loading state true during the confirm/pending handoff.

The borrow lending content already has a more advanced guard model with
`submittingRef`, `releaseSubmitGuard()`, and `deferRelease`. Reuse that shape
instead of inventing a second state machine.

Pass condition:

- Footer loading does not flash off between clicking confirm and the tx confirm
  sheet/pending result flow.
- Duplicate submit is blocked while confirm/pending is in flight.
- Inline errors still render when tx build or confirm initialization fails.

Implemented fix:

- Added optional `onConfirmFail` and `onConfirmCancel` callbacks to
  `useProtocolPositionActionSubmit()`.
- `ProtocolPositionActionDialogContent` now uses a synchronous `submittingRef`
  guard and releases it only through settle/fail/cancel/catch paths.
- `ProtocolLendingActionDefiContent` now uses the same deferred release model.

### 5. Borrow Lending Footer Loading Does Not Fully Cover Confirm/Pending

Priority: Medium
Confidence: High
Status: Verified existing path after related fixes
Type: Runtime / UX

File:

- `packages/kit/src/components/DeFi/ProtocolLendingActionDialogContent.tsx`

Evidence:

- Borrow content has a guarded runner:
  - `submittingRef`
  - `submittedStepKindRef`
  - `setSubmitting(true)`
  - optional `deferRelease`
- The business tx submit uses `{ deferRelease: true }`.
- Release is delegated to:
  - `onSettleResult`
  - `onSuccess`
  - `onFail`
  - `onCancel`
- This is the right general direction.

Residual risk:

- The reviewer finding points to the footer loading lifecycle still needing
  coverage across confirm/pending.
- After resolving the merge conflict, verify that every terminal branch calls
  `releaseSubmitGuardOnce()` exactly once.
- Pay special attention to undefined settle status, because the PR currently
  uses undefined as "stay and refresh", while `useUniversalBorrowHooks` can also
  short-circuit legacy `onSuccess`.

Fix direction:

- Keep the deferred guard pattern.
- Make the release ownership explicit:
  - setup/approve step release: after approve confirm cancel/fail or after
    allowance-ready state transition
  - business step release: after settle decision or tx fail/cancel
- Add or adjust tests so loading/guard release is covered for:
  - Success
  - Failed
  - undefined settle
  - user cancel
  - tx build failure

Pass condition:

- One click cannot submit twice during auto-advance.
- Loading state remains stable through step 2 confirm and pending.
- The guard always releases on terminal paths.

Implementation note:

- The borrow-backed lending content already used `submittingRef`,
  `submittedStepKindRef`, deferred release, and terminal `onSettleResult`,
  `onSuccess`, `onFail`, `onCancel` release callbacks.
- This pass kept that model and changed the footer's early submit check to read
  `submittingRef.current` instead of potentially stale React state.

### 6. Approve Cancel Can Leave Step-2 Session Armed

Priority: Medium
Confidence: Medium
Status: Fixed
Type: Runtime / state-machine edge case

File:

- `packages/kit/src/components/DeFi/ProtocolLendingActionDialogContent.tsx`

Evidence:

- `handleFooterConfirm()` sets `setApproveSessionActive(true)` before
  `onApprove()` opens the approve tx confirm.
- `useBorrowApproveAndSubmit()` clears loading on approve cancel, but does not
  clear the caller's `approveSessionActive`.
- `resolveLendingStepState()` returns `actionStep2` when:
  - `needsApproval=false`
  - `waitingAllowance=false`
  - `approveSessionActive=true`
- `shouldAutoSubmitLendingStep2()` auto-fires step 2 when:
  - step kind is `actionStep2`
  - no submit is currently active
  - it has not already auto-submitted for this session

Why confidence is Medium:

- Pure cancel with unchanged insufficient allowance will normally remain
  `approveStep1`, so it will not auto-submit immediately.
- The risk appears when allowance becomes covered from an external update, stale
  allowance poll result, previous approval, or any state change while the session
  flag remains armed from a canceled approve attempt.
- The state machine does not distinguish "approve session started" from
  "approve succeeded and allowance is ready".

Fix direction:

Preferred:

- Do not call `setApproveSessionActive(true)` before `onApprove()`.
- Let `onAllowanceReady()` be the only place that arms the step-2 session.

Alternative:

- Thread an approve cancel callback from `useBorrowApproveAndSubmit()` and clear:
  - `setApproveSessionActive(false)`
  - `autoSubmittedRef.current = false`

Preferred pass condition:

- Canceling approve never leaves `approveSessionActive=true`.
- `actionStep2` is only reachable after allowance is confirmed ready.
- Auto-submit step 2 fires only after a confirmed approve/allowance-ready state.

Implemented fix:

- Removed the early `setApproveSessionActive(true)` from `handleFooterConfirm()`.
- Kept `autoSubmittedRef.current = false` so a fresh successful approval can
  still auto-submit step 2 once.
- `onAllowanceReady()` is now the only place that arms `approveSessionActive`.

### 7. Closing DeFi Confirm Sheet Leaves Receipt Poll Running

Priority: Low
Confidence: High for behavior, Medium for fix necessity
Status: Fixed with abort-on-close behavior
Type: Performance / background work

File:

- `packages/kit/src/components/DeFi/DeFiActionTxConfirmResult.tsx`

Evidence:

- PR removed the component-owned `AbortController`.
- `showDeFiActionTxConfirmDialog()` now creates `finalStatusPromise` outside the
  component and does not pass an abort signal.
- `waitForTxFinalStatus()` defaults to:
  - `maxAttempts=24`
  - `intervalMs=5s`
- If the user dismisses the pending sheet before final status, the promise keeps
  polling for up to about two minutes.
- Added test explicitly expects a later Success to call
  `serviceDeFi.refreshAccountDeFiPositionsAfterAction()`.

Impact:

- One dismissed sheet can keep polling in the background.
- Multiple dismissed DeFi actions could stack polling work.
- This is not a correctness blocker if product wants automatic refresh after an
  early dismissal.

Fix direction options:

Option A: keep current behavior, but bound cost.

- Keep post-dismiss refresh.
- Consider lower `maxAttempts` after dismiss.
- Consider shared polling/dedup by `(accountId, networkId, txid)`.

Option B: restore abort-on-close.

- Reintroduce `AbortController`.
- Stop receipt polling when the user closes the sheet.
- Do not auto-refresh after close; rely on pending/history refresh paths.

Decision needed:

- Product/UX should decide whether "close pending sheet but still refresh later"
  is required.

Pass condition:

- If keeping behavior: tests document that post-dismiss refresh is intentional
  and polling is bounded.
- If aborting: tests prove close aborts the poll and no post-dismiss refresh is
  fired.

Implemented decision:

- Chose Option B for this fix pass: user dismissal aborts receipt polling.
- `showDeFiActionTxConfirmDialog()` now creates an `AbortController`, passes the
  signal to `waitForTxFinalStatus()`, aborts on user close, and ignores final
  status resolution after abort.
- Test updated to prove pending-sheet dismissal aborts polling and does not run
  post-dismiss DeFi position refresh.

## Recommended Repair Order

### Step 1. Resolve merge conflict

Why first:

- It blocks merge.
- It touches `useUniversalBorrowHooks.ts`, which is also where the borrow
  timeout/onSuccess behavior must be fixed.

Files:

- `packages/kit/src/views/Borrow/hooks/useUniversalBorrowHooks.ts`

Validation:

- `git merge-tree --write-tree <latest-x> HEAD` or equivalent merge simulation.
- Focused hook tests for `useUniversalBorrowHooks`.

### Step 2. Restore mono font fallback

Why second:

- Global UI regression.
- Small, low-risk change.
- Independent from DeFi state-machine changes.

Files:

- `packages/components/tamagui.config.ts`
- `packages/components/src/hocs/Provider/web-fonts.css` only if needed for
  verification context.

Validation:

- Inspect built font family output if available.
- Run components/type checks included in commit profile.

### Step 3. Fix borrow settle timeout semantics

Why third:

- Must be solved in the conflict file.
- Protects existing ManagePosition refresh and modal-close behavior.

Files:

- `packages/kit/src/views/Borrow/hooks/useUniversalBorrowHooks.ts`
- `packages/kit/src/views/Borrow/hooks/useUniversalBorrowHooks.test.tsx`

Validation:

- Add/adjust tests for:
  - `onSettleResult` provided + Failed
  - `onSettleResult` provided + undefined
  - no `onSettleResult` + undefined still calls legacy `onSuccess`
  - no `onSettleResult` + Failed skips legacy `onSuccess`

### Step 4. Fix generic DeFi action loading defer

Why fourth:

- It is a real UX/runtime issue.
- It depends on a correct understanding of signature-confirm callback timing.

Files:

- `packages/kit/src/components/DeFi/ProtocolPositionActionDialog.tsx`
- `packages/kit/src/components/DeFi/ProtocolLendingActionDialogContent.tsx`

Validation:

- Unit tests if the dialog logic is testable.
- Manual/visual verification for:
  - build tx loading
  - confirm modal opens
  - pending sheet appears
  - loading does not flash off early
  - duplicate confirm is blocked

### Step 5. Fix lending approve/session state

Why fifth:

- Closely related to loading/guard behavior.
- Needs a state-machine test rather than a cosmetic edit.

Files:

- `packages/kit/src/components/DeFi/ProtocolLendingActionDialogContent.tsx`
- `packages/kit/src/components/DeFi/protocolLendingActionUtils.ts`
- `packages/kit/src/components/DeFi/protocolLendingActionUtils.test.ts`
- possibly `packages/kit/src/views/Borrow/components/ManagePosition/hooks/useBorrowApproveAndSubmit.ts`

Validation:

- Tests for:
  - approve cancel does not arm step 2
  - allowance-ready arms step 2
  - auto-submit runs once
  - cancel/fail releases guard

### Step 6. Decide and handle post-dismiss polling

Why last:

- Lowest priority.
- It is a product/UX tradeoff.
- It should not delay correctness fixes unless polling cost is observed to be
  problematic.

Files:

- `packages/kit/src/components/DeFi/DeFiActionTxConfirmResult.tsx`
- `packages/kit/src/components/DeFi/DeFiActionTxConfirmResult.test.tsx`

Validation:

- Tests should match the chosen behavior.
- If keeping post-dismiss refresh, document that it is intentional in code/test
  names.

## Suggested Test Plan

Focused tests:

```bash
yarn jest packages/kit/src/views/Borrow/hooks/useUniversalBorrowHooks.test.tsx
yarn jest packages/kit/src/views/Borrow/components/ManagePosition/hooks/useBorrowApproveAndSubmit.test.tsx
yarn jest packages/kit/src/components/DeFi/protocolLendingActionUtils.test.ts
yarn jest packages/kit/src/components/DeFi/DeFiActionTxConfirmResult.test.tsx
```

Repository gate before commit:

```bash
yarn agent:check --profile commit
```

Manual scenarios:

1. Generic DeFi portfolio withdraw/repay/remove action:
   - open action dialog
   - confirm
   - verify footer loading remains stable until confirm/pending handoff
   - verify close-to-page on final Success/Failed
   - verify stay-and-refresh on undefined settle if that remains desired
2. Borrow lending dialog with approval:
   - click approve
   - cancel approve
   - verify it remains on step 1 and does not auto-submit step 2
   - approve successfully
   - verify allowance-ready changes to step 2 and auto-submit runs once
3. Borrow ManagePosition withdraw/repay:
   - simulate or force receipt polling timeout
   - verify broadcast success still triggers legacy refresh/pending/modal behavior
4. Web/desktop mono font:
   - delay/block GeistMono load if practical
   - verify `$monoRegular` and `$monoMedium` text still renders monospace

## Open Questions

1. Should undefined receipt settle be considered "broadcast succeeded but final
   status unknown" for every legacy borrow flow, or only for ManagePosition?
2. Should dialog-owned flows always suppress legacy `onSuccess` on undefined, or
   should some stay-and-refresh flows still trigger page-level pending refresh?

## Tracking Checklist

- [x] Conflict with `x` code shape resolved in working tree.
- [x] Mono font fallback restored for web/desktop.
- [x] Borrow no-`onSettleResult` timeout preserves legacy `onSuccess`.
- [x] Generic DeFi action loading guard deferred until settle/fail/cancel.
- [x] Borrow lending footer loading covers confirm/pending terminal paths.
- [x] Approve cancel cannot arm step 2.
- [x] Post-dismiss polling decision made and tests aligned.
- [x] Focused tests pass.
- [x] `git diff --check` passes.
- [x] File-level Prettier check passes.
- [x] File-level oxlint passes.
- [ ] Commit/stage the new helper file and verify local merge simulation against `x`.
- [x] `yarn agent:check --profile commit` passes.
