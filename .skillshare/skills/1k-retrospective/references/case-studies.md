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

## Case: Swap invite history showed invite-code remarks unlike other rebate modules
**Date**: 2026-08-18 | **Platforms**: mobile, desktop, web, extension
**Symptom**: Rebate Swap invite history rendered the invite-code remark under the code badge; Perps and hardware invite/list rows only showed the invite code.
**Root Cause**: Swap invite rows had a dedicated remark renderer that other rebate invite histories never used.
**Fix**: Removed the remark from Swap invite history and kept only the invite-code badge, matching Perps and other rebate lists.
**Catchable by**: Section 4: Shared hook/utility modified → checked all consumers (cross-module UI consistency)

## Case: Rebate module order was inconsistent across invite reward surfaces
**Date**: 2026-08-18 | **Platforms**: mobile, desktop, web, extension
**Symptom**: Commission rates, share links, and reward cards listed Hardware / Perps / Swap / DeFi in different orders.
**Root Cause**: Commission-rate sorting put DeFi before Swap, and share-link items were hardcoded as Hardware / DeFi / Perps / Swap.
**Fix**: Used one Hardware → Perps → Swap → DeFi subject order for commission rates, share links, and remaining rebate lists.
**Catchable by**: Section 4: Shared hook/utility modified → checked all consumers

## Case: DeFi referral bonus entry unreachable on mobile
**Date**: 2026-08-18 | **Platforms**: iOS, Android (Earn tab)
**Symptom**: The Earn "Referral Bonus" trigger was invisible on mobile; desktop showed it only because the overview reserved `paddingRight="$24"` for it.
**Root Cause**: The trigger was absolutely positioned at the top-right of the Earn overview, so on narrow layouts it landed under the tab header and its slot depended on hardcoded padding.
**Fix**: Removed the absolutely positioned trigger and moved invitee reward details into a dialog/sheet opened from the shared Activity Hub gift entry, dropping the reserved padding.
**Catchable by**: Section 3: UI changes verified on mobile (narrowest) and desktop (widest)

## Case: Canonical rebate order table gave two DeFi subjects the same rank
**Date**: 2026-08-18 | **Platforms**: mobile, desktop, web, extension
**Symptom**: Commission rate lists could still order DeFi subjects differently per surface even after the "one canonical order" fix; the unit test only passed because the fixture happened to list `Earn` before `Onchain`.
**Root Cause**: `COMMISSION_RATE_SUBJECT_ORDER` assigned rank 3 to both `Earn` and `Onchain`, so a stable sort fell back to API response order for that pair.
**Fix**: Gave the two DeFi subjects distinct adjacent ranks and added tests asserting the same output for two different input orders.
**Catchable by**: NEW — an ordering/priority map must be a total order over its keys; equal ranks silently defer to input order

## Case: Reward history opened behind the still-open rewards dialog
**Date**: 2026-08-18 | **Platforms**: iOS, Android (Earn tab)
**Symptom**: Tapping the history icon inside the DeFi invitee reward sheet pushed the history screen while the sheet overlay stayed up.
**Root Cause**: The original popover called `setOpen(false)` before navigating; when the content moved into a dialog the close step was not carried over.
**Fix**: `EarnInviteeRewardContent` now awaits `useDialogInstance().close()` before `pushModal`.
**Catchable by**: Section 4: Logic moved between files carries its surrounding guard/condition and scope

## Case: Activity Hub popover ignored half of its own layout contract
**Date**: 2026-08-19 | **Platforms**: desktop, web, extension (Earn, Swap, Perps gift menus)
**Symptom**: The gift menu on Earn and Swap rendered its two shortcut tiles at a quarter of the row each inside a panel with no width driver; Perps also lost the fixed 384px panel it had before the refactor.
**Root Cause**: `getActivityHubLayout` pairs a panel width with a tile basis, but the paired values were passed in as props: the dialog host set both while the popover host set neither, so the content fell back to a hardcoded `'25%'`.
**Fix**: The content derives the basis from its own campaign list and each host only supplies the matching panel width, so the pair can no longer be split.
**Catchable by**: NEW — values that must change together should be derived from one source, not passed as independent props to every call site

## Case: Swap settings gated the Activity Hub on stale store state
**Date**: 2026-08-19 | **Platforms**: iOS, Android, web, extension (medium/mobile Swap layouts)
**Symptom**: On layouts where Swap settings is the only hub entry, the Activity Hub row could briefly appear on Limit/Stock or be missing on Swap right after a route-driven tab switch.
**Root Cause**: The header used the route-aware placement hook while `SwapHeaderRightActionContainer` called the pure placement helper straight from the swap store, which lags the route by the delayed mount-time tab switch.
**Fix**: Extracted the route/store reconciliation into `useSwapActivityHubPendingRouteSwapType` and fed the route tab into the settings surface so both entries converge on the same value.
**Catchable by**: Section 4: Shared hook/utility modified → checked all consumers

## Case: Activity Hub tiles grew to half the screen on the md sheet
**Date**: 2026-08-19 | **Platforms**: iOS, Android, web (Earn, Swap gift entries below md)
**Symptom**: The two shortcut tiles filled a whole phone row (~180pt each) in Earn and Swap, while Perps kept ~89pt tiles because its campaign cards force the 4-column grid.
**Root Cause**: The tile basis was chosen by "does the panel have campaign cards", which is only a proxy for panel width on desktop. Below md the hub is a screen-wide sheet no host sizes, so the grown basis meant for the 208px desktop panel was applied to the full screen.
**Fix**: The basis is now chosen by "does the panel have the wide 4-column room", which the md sheet always does; only the desktop shortcut-only panel narrows and grows the basis.
**Catchable by**: Section 3: UI changes verified on mobile (narrowest) and desktop (widest)

## Case: Activity Hub inferred compact layout from gtMd
**Date**: 2026-08-19 | **Platforms**: iPad, Android tablet, desktop web (Perps account/settings embeds)
**Symptom**: Shortcut tiles doubled in size inside native tablet sheets (~400–480px) and inside the Perps account/settings panels whenever campaigns were empty.
**Root Cause**: `gtMd` was used as a stand-in for "this is the 208px desktop floating panel". Native popovers always Adapt to a Sheet, and `ActivityHubContent` is also inlined into wider hosts that never set that width.
**Fix**: Compact layout is an explicit `isCompactPanel` host flag. Only `ActivityHubAction` / `useShowActivityHub` set it for the desktop floating surface with no campaigns; native `floatingPanelProps.width` is left unset.
**Catchable by**: Section 3: Cross-platform impact — platform-specific overlay (Popover Sheet vs floating panel) plus every inlined consumer of a shared layout

## Case: Popover's native-sheet rule was copied onto a Dialog host
**Date**: 2026-08-19 | **Platforms**: iPad, Android tablet (Swap settings → Activity Hub)
**Symptom**: On native tablets the Swap settings Activity Hub opened at the Dialog default 400px with two ~92px tiles and ~184px of dead space, instead of the 208px panel filled by two tiles.
**Root Cause**: `gtMd && !platformEnv.isNative` was reused for the Dialog host. That exclusion only holds for Popover, which always Adapts to a Sheet on native; Dialog degrades to a sheet solely below the md breakpoint and renders `TMDialog.Content` (honouring `floatingPanelProps`) on native tablets.
**Fix**: The Dialog host sizes its panel by `gtMd` alone, so width and tile basis stay paired on every platform above md.
**Catchable by**: Section 4: Logic moved between files carries its surrounding guard/condition — an overlay-specific guard is not transferable to a different overlay primitive

## Case: Swap and Perps reward overlays stayed above the onboarding screen
**Date**: 2026-08-19 | **Platforms**: web dapp mode (wide layout), Swap and Perps reward dialogs
**Symptom**: Tapping create/connect wallet in the reward dialog pushed the onboarding modal behind the still-open dialog.
**Root Cause**: The shared `InviteeRewardNoWallet` gained an optional `onBeforeNavigate` dismiss step, but only the Earn host supplied it. Where onboarding resets the navigation root the overlay unmounts anyway, which hid the gap everywhere except web dapp mode, where onboarding is pushed as a modal and the in-tab dialog portal survives.
**Fix**: Both dialog hosts pass a close callback through their content; the pushed modal-page hosts still pass nothing since they have no overlay to dismiss.
**Catchable by**: Section 4: Type definitions changed → all consumers updated (a new optional prop on a shared component needs every host audited)

## Case: Awaiting the overlay close cost the tap's user activation
**Date**: 2026-08-19 | **Platforms**: web (Perps Activity Hub campaign cards)
**Symptom**: Tapping a campaign card in the gift menu did nothing on web — no new tab, no error.
**Root Cause**: A shared `closeThenRun` helper was introduced so navigation would not land behind a dismissing native sheet, and every hub action was routed through it. The host resolves its close promise from a timer, so `window.open` ran in a later task than the tap and popup blockers dropped it as unsolicited. Only web is affected: the extension uses `chrome.tabs.create` and native uses Linking / an in-app browser.
**Fix**: Campaign links fire the close without awaiting it, keeping `openUrlExternal` in the tap's own task. Native still awaits, because iOS drops an in-app browser presented over a sheet that is still dismissing.
**Catchable by**: NEW — not covered. Section 5 asks about race conditions but not about capability-gated browser APIs (`window.open`, clipboard, fullscreen, autoplay) that silently require the caller to still hold user activation. Awaiting anything before them forfeits it.

## Case: Private Send dropped the Gas Account quote when the server preferred Megafuel
**Date**: 2026-08-19 | **Platforms**: mobile, desktop, web, extension
**Symptom**: On BNB-chain Private Send, when the fee service returned `payer='megafuel'` together with an eligible Gas Account quote, the confirm flow suppressed Megafuel for display but kept `selectedPayer='user'`, so the sponsored quote was silently dropped and the tx broadcast user-paid (OK-59993 follow-up, PR #12916).
**Root Cause**: The display payer (`effectiveFeePayer`) and the submit wiring (`selectedPayer`) were derived in separate places from different inputs — display from the post-filtered sponsor state, submit from the raw backend `payer` — so scenario suppression (Private Send disables Megafuel) could update one without the other. Review also caught that the extracted eligibility check (`gasAccountEligible && gasAccountQuote`) omitted the non-empty `quoteId` guard every downstream consumer requires, which would have shown a sponsored UI while broadcasting user-paid.
**Fix**: Extracted `resolveSponsorPayerState()` to derive `effectiveFeePayer` and `selectedPayer` together from the post-filtered sponsor state, with the megafuel-suppressed preference falling through to an eligible Gas Account quote; hardened eligibility via `isGasAccountQuoteEligible()` requiring a non-empty `quoteId`; locked both invariants with unit tests.
**Catchable by**: Section 4: Data flow end-to-end: API -> state -> UI (display state and submit wiring must derive from the same filtered source); Section 5: runtime-validate network-response fields even when typed as required

## Case: Swap account network stayed on the pre-switch FromToken after Pro remapped the pair
**Date**: 2026-08-21 | **Platforms**: iOS, Android (native main runtime; persisted account selection is a shared native resource)
**Symptom**: Leaving native Swap Pro after a cross-chain ordinary pair whose source matched the Pro target remapped the pair (BNB→UNI became UNI→BNB) but the account network was still written as the old source (BSC). Cold-start context validation could then block later corrections.
**Root Cause**: `swapTypeSwitchAction` remapped From/To when the Pro target equaled the restored FromToken, but `SwapHeaderContainer` synced the account from the pre-switch `fromToken.networkId` captured in the React closure.
**Fix**: Return the settled FromToken from `swapTypeSwitchAction` and sync the account network from that value after the type switch leaves the Pro owner.
**Catchable by**: Section 4: Logic moved between files carries its surrounding guard/condition and scope; Section 4: Data flow end-to-end after a state remapping
## Case: BLE pairing dialog shown while device already paired and communicating
**Date**: 2026-08-13 | **Platforms**: Desktop (macOS/Windows desktop BLE)
**Symptom**: Creating a wallet over Bluetooth showed the "Pairing with your device" dialog mid-flow (OK-60091) even though the device was OS-paired and actively communicating on a live Noble session; the dialog's repair then re-scanned and "discovered" the very connectId the caller passed in.
**Root Cause**: `getCompatibleConnectId` triggered the USB→BLE pairing repair purely from DB bookkeeping (device record missing `bleConnectId` — recreated that way by a USB wallet creation after wallet removal deleted the record), never recognizing the caller's incoming connectId as the live BLE endpoint. DB binding state is neither necessary nor sufficient evidence of OS pairing state.
**Fix**: Before the dialog fallback, silently verify and persist the caller-held connectId, gated by runtime evidence: id differs from the record's USB identifiers, carried real device traffic within 60s (stamped by DEVICE.STATE/DEVICE.CONNECT, invalidated on DEVICE.DISCONNECT), probed with silentMode (no global error dialog from error constructors), a bounded 10s timeout, and the session's remembered protocol pinned (forced re-detection sends a V2 Ping into an active V1 session, which the device may not answer — SDK error 713); the probed deviceId must match before persisting.
**Catchable by**: NEW — not covered (interactive dialog triggered from persistence bookkeeping instead of live transport evidence)

## Case: Daily backup advanced its throttle while agent-secret scrub failed
**Date**: 2026-08-25 | **Platforms**: desktop, web, extension (bg runtime; canBackup() targets only)
**Symptom**: Review finding on PR #12990 — stale (possibly plaintext |HLP|) HyperLiquid agent credential rows could stay in the backupAccount bucket forever: scrub failures were logged and swallowed, then the put-by-id daily snapshot completed and advanced lastDBBackupTime.
**Root Cause**: `removeBackupHyperLiquidAgentCredentials` reported nothing, so `_backupDatabaseDaily` could not distinguish a clean scrub from a failed one, and the snapshot itself never deletes stale rows (put-by-id).
**Fix**: Stale agent rows are deleted inside the same IndexedDB transaction as the daily snapshot, so a successful backup can never leave stale rows while a scrub problem can never block the backup (backup availability outranks agent-row hygiene: wallet credentials are unrecoverable, agent keys are re-approvable). The standalone scrub returns a boolean and remains best-effort cleanup on credential removal.
**Catchable by**: Section 4: Data flow end-to-end (a best-effort cleanup feeding a state-advancing step must report its outcome)

## Case: One undecryptable agent credential aborted the whole Perps status batch
**Date**: 2026-08-25 | **Platforms**: desktop, web, extension (bg runtime)
**Symptom**: Review finding on PR #12990 — after agent credentials moved to session-encrypted storage, a single unreadable credential (locked session or transient LSE layer outage) made the `checkAgentStatus` Promise.all reject, skipped remaining status checks, and popped one error toast per failing agent during Perps polling.
**Root Cause**: `getHyperLiquidAgentCredentialInfo` propagated new throw paths (session getKeyOrThrow, LocalSecretEnvelopeUnavailable, durable-upgrade write) that the legacy decrypt path had surfaced as `undefined`, while the caller and its `@toastIfError` decorator were built around the never-throw contract.
**Fix**: The info getter catches read errors, logs, and returns `undefined` (restoring the graceful re-approval flow); `@toastIfError` was removed from this polled getter. The signing path stays fail-closed.
**Catchable by**: Section 4: Shared hook/utility modified → checked all consumers (an error-contract change must be audited at every call site)

## Case: Proxy signer advertised one agent address while signing with another key
**Date**: 2026-08-25 | **Platforms**: desktop, web, extension (bg runtime; Perps agent signing)
**Symptom**: Review finding on PR #12990 — `WalletHyperliquidProxy.getAddress()` returned the setup-time agentAddress while `signTypedData()` signed with whatever private key the per-signature localDb fetch returned, so a re-approval race (record swapped to a new key while an exchange client held an old proxy) or an inconsistent record could silently sign under a different agent identity than advertised.
**Root Cause**: Moving from a captured-key wallet to per-signature key fetching removed the implicit key↔address binding that constructing `ethers.Wallet` at setup time used to provide; no explicit check replaced it.
**Fix**: `signTypedData` derives the address from the fetched key (already computed by ethers) and fails closed with a re-enable-trading error when it does not match the advertised agentAddress, case-insensitively.
**Catchable by**: Section 5: No stale closures capturing outdated state (identity captured at setup must be re-validated against data fetched later)

## Case: onekeyIdLogout analytics flood with user IDs embedded in server-bound reason text
**Date**: 2026-08-25 | **Platforms**: iOS, Android, desktop, web, extension (bg runtime emits; analytics is a shared server-side resource)
**Symptom**: PostHog showed 1.76M `onekeyIdLogout` events in 30 days across ~70k persons — the highest-volume Prime event — drowning genuine logout signals and inflating analytics cost. Several `reason` strings carried Privy DIDs (`did:privy:…` = onekeyUserId), leaking account identifiers into server-bound free text; single users emitted 1000+ events in loops.
**Root Cause**: `onekeyIdLogout` is decorated `@LogToServer`, but state-maintenance code paths (`setPrimePersistAtomNotLoggedIn` before/after clears on hot startup paths, `updatePrimeAtomByServerUserInfo` before/after every user-info refresh, discarded-response diagnostics) reused it as a general trace channel, interpolating atom values including `onekeyUserId` into `reason`.
**Fix**: Added local-only `onekeyIdStateTrace` (`@LogToLocal`) and demoted 11 state-maintenance call sites; removed user ids from reason templates; reserved server `onekeyIdLogout` for genuine logout actions; also scrubbed `onekeyIdInvalidToken` (url query/hash + message) and `fetchPackagesFailed` free text at the scene level so every call site inherits the sanitization.
**Catchable by**: Section 1: no sensitive/identifier interpolation into server-bound free text (scrub at the scene method, not call sites); NEW — @LogToServer methods called from hot/state-maintenance paths need a volume review (dedup or LogToLocal)

## Case: PrimeLoginInvalidToken still counted as onekeyIdLogout
**Date**: 2026-08-25 | **Platforms**: iOS, Android, desktop, web, extension
**Symptom**: After demoting hot-path `onekeyIdLogout` traces, invalid-token bus handling still emitted a server `onekeyIdLogout` before the stale-generation gate, so retries and superseded clears kept polluting the genuine logout event.
**Root Cause**: `PrimeGlobalEffectView` logged logout at handler entry, then separately local-traced stale events. Background already emits `onekeyIdInvalidToken` for the server signal.
**Fix**: Remove the server logout emit; log a local `onekeyIdStateTrace` only after the stale gate when the handler actually proceeds.
**Catchable by**: Section 4: Logic moved between files carries its surrounding guard/condition and scope (a reserved server event must stay behind the same skip gate as the handler body)

## Case: Prime profile/identity TTL written before analytics delivery
**Date**: 2026-08-26 | **Platforms**: iOS, Android, desktop, web, extension (bg runtime)
**Symptom**: Review on PR #13008 — a failed or out-of-order `updateUserProfile` POST left membership attributes missing for up to 7 days, and `onekeyIdIdentityLinked` could skip after a fire-and-forget emit.
**Root Cause**: `markPrimeProfileReported` / `markIdentityLinkReported` persisted the TTL before the network send, and `updateUserProfile` / `@LogToServer()` did not await delivery. `lastHandledPrimeProfileKey` was also set before persist, so the same session would not retry.
**Fix**: Peek due without writing; await `updateUserProfileAsync` / `@LogToServer({ waitForServer: true })`; record the TTL only after success; set `lastHandledPrimeProfileKey` after the cycle completes.
**Catchable by**: Section 4: Data flow end-to-end (a best-effort cleanup or send feeding a state-advancing step must report its outcome); Section 5: No race conditions in async operations

## Case: Native restore success rewritten as failed by user-info refresh
**Date**: 2026-08-26 | **Platforms**: iOS, Android (native main runtime)
**Symptom**: Review on PR #13008 — RevenueCat restore already had an active Prime entitlement, but a later `apiFetchPrimeUserInfo()` throw reported `primeRestorePurchaseResult({ result: 'failed' })` and skipped the success toast.
**Root Cause**: Success tracking sat after the user-info refresh inside one try/catch, so a transient server/network error rewrote a real store restore as failed.
**Fix**: Emit success and show the success toast after the local entitlement check; wrap the user-info refresh in its own try and keep the failure as a local state trace.
**Catchable by**: Section 4: Logic moved between files carries its surrounding guard/condition and scope (a success signal must stay behind the same store-outcome gate, not a later refresh)

## Case: Bind/restore login committed without identity or profile analytics
**Date**: 2026-08-26 | **Platforms**: iOS, Android, desktop, web, extension (bg runtime)
**Symptom**: Review on PR #13008 — `apiBindLegacyOneKeyIdOAuth` and auth-state restore wrote `isLoggedIn: true` through `updatePrimeAtomByOneKeyIdAccount` but never emitted `onekeyIdIdentityLinked` or membership profile attributes when the later user-info refresh failed or was skipped.
**Root Cause**: Identity/profile reporting was only attached to `updatePrimeAtomByServerUserInfo` / `updatePrimeAtomByOAuthLoginResponse`, not the shared OneKey-account commit path.
**Fix**: After `primePersistAtom.set`, the account commit path also tracks the identity link and enqueues the membership profile report.
**Catchable by**: Section 4: Shared hook/utility modified → checked all consumers (every login-commit writer needs the same analytics pair)

## Case: Identity-link races and unbounded analytics init wait
**Date**: 2026-08-26 | **Platforms**: iOS, Android, desktop, web, extension (bg runtime)
**Symptom**: Review on PR #13008 after the reporter extract — one login emitted `onekeyIdIdentityLinked` twice (atom commit + user-info refresh); cold-start `waitForServer` identity throws before `analytics.init`; a hung `whenInitialized()` blocked every later profile report.
**Root Cause**: Persist-after-send deleted the session Set without an in-flight replacement; identity used `trackEventAsync` (no `cacheEvents`) without waiting for init; `whenInitialized()` has no timeout and sat on the serial profile chain.
**Fix**: Module-level in-flight Map plus session Set (clear in-flight only); `waitForAnalyticsInitialized()` (30s) before identity and profile send; timeout logs, skips TTL, and lets the chain continue.
**Catchable by**: Section 5: No race conditions in async operations; Section 4: Logic moved between files carries its surrounding guard/condition and scope; NEW — `waitForServer` / `trackEventAsync` callers must wait for analytics init with a bounded timeout

## Case: Session Set written on not-due blocked 7-day identity re-assert
**Date**: 2026-08-26 | **Platforms**: desktop, web (single-runtime, long-lived); iOS/Android/extension less exposed because bg restarts
**Symptom**: Review on PR #13008 — a desktop session that started while `onekeyIdIdentityLinked` TTL was still valid never re-emitted after the 7-day mark, even though Dashboard / user-info refresh kept calling the reporter.
**Root Cause**: The not-due branch wrote `onekeyUserId` into `identityLinkReportedThisSession`, and the entry gate returned before reading simpleDb again. Profile `lastHandledPrimeProfileKey` had the same not-due write.
**Fix**: Write the session guard only after confirmed delivery. Not-due returns without touching the Set / lastHandled key so a later TTL expiry can report.
**Catchable by**: Section 4: Data flow end-to-end (a persisted TTL meant to re-assert must not be shadowed by a never-expiring in-memory guard)

## Case: Site-scan usage event only remembered the last OneKey account
**Date**: 2026-08-26 | **Platforms**: iOS, Android, desktop, web, extension (main runtime)
**Symptom**: Review on PR #13008 — `siteScanRiskWarned` used a single `reportedUserId`. A → B → A in one JS session re-emitted A and broke the once-per-account-per-session volume bound.
**Root Cause**: The session guard stored one ID instead of the set of accounts already reported.
**Fix**: Session-scoped Set of OneKey user IDs; add before emit. Account switch still reports the new account; switching back does not.
**Catchable by**: Section 4: Shared hook/utility modified → checked all consumers (a per-user session guard must keep every seen user, not only the last)

## Case: iOS Infini subscription management opened a OneKey invite page
**Date**: 2026-08-30 | **Platforms**: iOS, Android Google Play, desktop, web
**Symptom**: Tapping Prime 订阅管理 on iOS opened Safari to a OneKey Perps invite/marketing page instead of Infini or store subscription management (OK-61464).
**Root Cause**: Infini has no web portal. The router fell through to `subscriptions[].managementUrl`, which was a OneKey marketing page.
**Fix**: Infini channel always opens the in-app Infini cancel-renewal page and never uses that marketing URL. Redemption-only still shows 管理订阅 and toasts that the activation method cannot be managed.
**Catchable by**: Section 4: Edge cases — a channel without a real management portal must not fall through to another destination

## Case: Channel-less Prime managementUrl opened a marketing page
**Date**: 2026-08-30 | **Platforms**: iOS, Android, desktop, web, extension
**Symptom**: A Prime row with no `channel` but a leftover `managementUrl` (often the OneKey invite page) would open that URL and skip the legacy Infini probe.
**Root Cause**: Router treated any non-empty nested `managementUrl` as a real portal, including records that never declared a payment channel.
**Fix**: Only trust a nested management URL when the same row declares a non-Infini, non-redemption channel. Channel-less rows stay on the Infini probe / unsupported toast path.
**Catchable by**: Section 4: Edge cases — a URL without a declared channel is not a management portal

## Case: Hook barrel export casing broke Linux desktop/web
**Date**: 2026-08-31 | **Platforms**: Desktop (Linux), Web
**Symptom**: Rspack/TypeScript on case-sensitive filesystems could not resolve `./modifierHintRevealContext` because the file is `ModifierHintRevealContext.tsx`. Web `index.web-only.tsx` also omitted the new hook/provider exports while `DesktopLeftSideBar` still imported them.
**Root Cause**: macOS is case-insensitive so the mismatch was invisible locally; web-only barrels are a separate export surface from `index.tsx`.
**Fix**: Export `./ModifierHintRevealContext` from both barrels; stub `DesktopModifierHintRevealProvider` for non-desktop.
**Catchable by**: Section 3: Identified which platforms consume modified code; Section 7: `forceConsistentCasingInFileNames` / Linux compile

## Case: Sidebar shortcut hints skipped My OneKey and reserved overflow space
**Date**: 2026-08-31 | **Platforms**: Desktop
**Symptom**: Holding Ctrl/⌘ showed badges on visible tabs but not on the bottom My OneKey (Ctrl+8) item. Overflow “More” labels stayed indented because hidden `Shortcut` pills used `opacity: 0`.
**Root Cause**: DeviceManagement is extracted out of `visibleRoutes` into `SidebarBottomItem` without the badge. Hidden hints stayed mounted.
**Fix**: Overlay the badge on `SidebarBottomItem`. Unmount the badge when not visible.
**Catchable by**: Section 4: Shared component modified → checked all consumers of the same tab list; Section 8: overflow/empty layout
