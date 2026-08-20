# Bug Fix Case Studies

Cases are appended by AI after each bug fix. Do NOT reorder or delete entries — the `1k-retrospective` skill reads this file to analyze patterns and propose rule updates.

---

<!-- New cases are appended below this line -->

## Case: iOS OneKey ID logout dialog stuck with loading spinner
**Date**: 2026-02-26 | **Platforms**: iOS (native)
**Symptom**: After clicking logout in OneKey ID page, the confirmation dialog showed a permanent loading spinner and never closed, even after the modal behind it was dismissed.
**Root Cause**: Race condition between explicit logout (Dialog onConfirm) and automatic `handleLoggedOutWhileFocused` effect. When `apiLogout()` updated `primePersistAtom`, the effect fired and called `popModalPagesOnNative()` while the dialog's `onConfirm` was still executing, orphaning the dialog.
**Fix**: Added `isExplicitLogoutRef` flag set via `onBeforeLogout` callback before `logout()` starts, preventing `handleLoggedOutWhileFocused` from interfering with user-initiated logout.
**Catchable by**: Section 5: No race conditions in async operations

## Case: Web header settings dropdown overlap
**Date**: 2026-02-26 | **Platforms**: Web
**Symptom**: In the web header settings dropdown, clicking currency then language (or vice versa) caused both Select floating panels to appear simultaneously, overlapping.
**Root Cause**: Two `Select` components inside a `Popover` managed their own `isOpen` state independently. Opening one did not close the other.
**Fix**: Extracted popover content into `MoreDappActionContent` with key-based mutual exclusion. When one Select opens, the other is force-remounted (closed) by incrementing its key.
**Catchable by**: NEW — not covered (UI component interaction within shared container)

## Case: Perps history tab title highlighted when share dialog opens
**Date**: 2026-02-26 | **Platforms**: iOS, Android (native)
**Symptom**: When opening the share position dialog from the history page, the tab header text got visually highlighted/selected.
**Root Cause**: Tab header `SizableText` and `XStack` elements lacked `userSelect="none"`, allowing text selection when focus shifted to the dialog.
**Fix**: Added `userSelect="none"` to `XStack` and `SizableText` in both `PerpTradersHistoryListModal` TabHeader and `PerpOrderInfoPanel` TabBarItem.
**Catchable by**: Section 1: Code Quality — UI interactive elements should have userSelect="none"

## Case: Web language dropdown stays open when clicking Settings
**Date**: 2026-02-28 | **Platforms**: Web
**Symptom**: In the DappHeader MoreDappAction popover, opening the language Select dropdown then clicking "Settings" left the dropdown visible while the Settings modal opened.
**Root Cause**: `SettingListItem` only called `closePopover()` to close the parent Popover, but due to `keepChildrenMounted`, the child `LanguageListItem`'s Select stayed mounted with `isOpen=true`.
**Fix**: Added `closeAllDropdowns` callback in `MoreDappActionContent` that bumps keys for both Language and Currency Selects (forcing remount and state reset), called via `onBeforeNavigate` prop before `closePopover()`.
**Catchable by**: Section 5: No stale state after parent container dismissal (related to existing case "Web header settings dropdown overlap")

## Case: Keyless avatar provider fallback
**Date**: 2026-03-12 | **Platforms**: mobile, desktop, web, extension
**Symptom**: Keyless wallet avatar badge could show the original login provider instead of the provider parsed for avatar display.
**Root Cause**: Wallet avatar rendering only read `keylessProvider`, while the refreshed avatar-specific provider was not persisted or prioritized.
**Fix**: Stored `avatarProvider` in `keylessDetails` during avatar repair and updated avatar rendering to prefer `avatarProvider` before falling back to `keylessProvider`.
**Catchable by**: Section 4: Type definitions changed -> all consumers updated

## Case: Swap invitee reward counted undistributed bonus twice
**Date**: 2026-08-13 | **Platforms**: mobile, desktop, web, extension
**Symptom**: The Swap invitee reward summary showed the cumulative total as distributed and then added the undistributed reward again, so a fully undistributed reward appeared as already distributed.
**Root Cause**: The client treated `totalBonus`, which already includes `undistributed`, as the distributed amount instead of deriving the distributed portion.
**Fix**: Derived `distributedBonus` with BigNumber as `totalBonus - undistributed` and passed it explicitly to the summary card, with regression coverage for partially, fully, and zero undistributed rewards.
**Catchable by**: Section 4: Data flow end-to-end: API -> state -> UI
## Case: Perps stuck on "Loading tokens..." after IndexedDB blob corruption
**Date**: 2026-08-11 | **Platforms**: desktop (Electron/Chromium storage; web/ext share the code path)
**Symptom**: Desktop 6.5.0 user's Perps chart and token selector permanently stuck on "Loading tokens..." across restarts; realtime prices kept updating; mobile unaffected (OK-59997).
**Root Cause**: All Perps caches live in one `simple_db_v5:perp` record. Chromium stores large IndexedDB values as external blob files; a crash corrupted the blob so every read rejected with `UnknownError: Failed to read large IndexedDB value`. `setRawData(builder)` reads the old record before writing, so all writes failed too — the record could never be repaired by normal usage.
**Fix**: Opt-in self-heal in `SimpleDbEntityBase` (perp only): on the exact corruption signature, retry once, then remove the record with write-overlap vetoes (writeSeq + pendingWrites snapshot); read generation prevents in-flight reads from resurrecting cleared/overwritten cache; Settings → Clear cache gained a "Perps" item backed by a runtime clear epoch in ServiceWebviewPerp.
**Catchable by**: NEW — storage-layer read errors need a recovery path for caches that can be rebuilt; read-before-write persistence cannot self-repair a corrupted record

## Case: Mobile Market Detail TradingView height flicker
**Date**: 2026-08-17 | **Platforms**: iOS, Android (native main runtime)
**Symptom**: The Market Detail TradingView flashed and resized when its async indicator quick bar loaded; an earlier fix also left a permanent 31px blank strip when indicators were explicitly disabled.
**Root Cause**: The parent treated a null quick bar during configuration loading and a null quick bar after `indicatorsEnabled: false` as the same state, so it could not reserve or release chart height at the correct lifecycle point.
**Fix**: Added explicit loading, visible, and hidden quick bar states; reserve the slot only while loading or visible, and restore the chart height when the quick bar is hidden.
**Catchable by**: Section 5: "Not loaded" versus intentionally unavailable state must be distinguished

## Case: WalletConnect Pay expiry popStack dropped in-flight txid
**Date**: 2026-08-18 | **Platforms**: mobile, desktop, web (hardware wallets especially)
**Symptom**: If a WalletConnect Pay payment expired while an eth_sendTransaction confirmation was already submitting, the broadcast could succeed while the executor treated the wait as failed, so the txid was neither confirmed to the server nor stored for retry.
**Root Cause**: confirmWithinDeadline closed the SignatureConfirm modal on expiry. TxConfirm only sets isSubmitted after broadcast returns, so unmount fired onCancel and rejected waitForConfirm. The late-persist `.then` on that promise never ran; onSuccess's resolve was a no-op.
**Fix**: Persist the txid inside onSuccess, decoupled from waitForConfirm settling. The happy path still awaits that persist promise before the next action; expiry-during-broadcast relies on the fire-and-forget persist from onSuccess.
**Catchable by**: Section 5: No race conditions in async operations — do not persist irreversible results through a promise that modal unmount can reject

## Case: WalletConnect Pay KYC collected before platform broadcast refusal
**Date**: 2026-08-18 | **Platforms**: web, desktop without safeStorage
**Symptom**: Users on platforms without durable progress filled the hosted compliance form, submitted personal data to the merchant's KYC provider, then were told on-chain payments are not supported.
**Root Cause**: supportsDurableProgress was checked only in getRequiredPaymentActions, which runs after handlePay's collectData step.
**Fix**: Shared shouldRefuseWcPayWithoutDurableProgress helper; options page disables broadcast options and preflights before the form; getRequiredPaymentActions remains the backstop. Tests cover broadcast×durable combinations.
**Catchable by**: Section 4: Data flow end-to-end — platform gates that abort a flow must run before side-effecting steps such as KYC submission

## Case: Private Send dropped the Gas Account quote when the server preferred Megafuel
**Date**: 2026-08-19 | **Platforms**: mobile, desktop, web, extension
**Symptom**: On BNB-chain Private Send, when the fee service returned `payer='megafuel'` together with an eligible Gas Account quote, the confirm flow suppressed Megafuel for display but kept `selectedPayer='user'`, so the sponsored quote was silently dropped and the tx broadcast user-paid (OK-59993 follow-up, PR #12916).
**Root Cause**: The display payer (`effectiveFeePayer`) and the submit wiring (`selectedPayer`) were derived in separate places from different inputs — display from the post-filtered sponsor state, submit from the raw backend `payer` — so scenario suppression (Private Send disables Megafuel) could update one without the other. Review also caught that the extracted eligibility check (`gasAccountEligible && gasAccountQuote`) omitted the non-empty `quoteId` guard every downstream consumer requires, which would have shown a sponsored UI while broadcasting user-paid.
**Fix**: Extracted `resolveSponsorPayerState()` to derive `effectiveFeePayer` and `selectedPayer` together from the post-filtered sponsor state, with the megafuel-suppressed preference falling through to an eligible Gas Account quote; hardened eligibility via `isGasAccountQuoteEligible()` requiring a non-empty `quoteId`; locked both invariants with unit tests.
**Catchable by**: Section 4: Data flow end-to-end: API -> state -> UI (display state and submit wiring must derive from the same filtered source); Section 5: runtime-validate network-response fields even when typed as required
