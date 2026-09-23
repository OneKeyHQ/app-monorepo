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

## Case: Settings dApp Connection opened a second Bottom Sheet
**Date**: 2026-08-31 | **Platforms**: iOS, Android
**Symptom**: Tapping dApp 连接 from Settings stacked a second Bottom Sheet on top of the settings sheet (OK-61439).
**Root Cause**: The settings entry used `pushModal(DAppConnectionModal)` instead of in-stack `push()` like sibling pages.
**Fix**: Added `SettingDAppConnectionList` to the SettingModal stack and changed the entry to `navigation.push`.
**Catchable by**: Section 4: Shared hook/utility modified → checked all consumers (settings entries that open a page should use the same stack as siblings)

## Case: Protection Prime badge misaligned on mobile
**Date**: 2026-08-31 | **Platforms**: iOS, Android
**Symptom**: The Prime badge on 收款风险监控 sat between subtitle and switch, aligned with neither (OK-61456).
**Root Cause**: Badge was a `ListItem` child next to the switch instead of inline in the title.
**Fix**: Render the badge in `ListItem.Text` primary via an `XStack` with the title.
**Catchable by**: Section 3: UI changes verified on mobile — trailing children of a two-line ListItem do not vertically align with the title

## Case: Union-build ownership promotion dropped runtime-divergent modules from every bundle
**Date**: 2026-08-26 | **Platforms**: iOS, Android (split-bundle union build)
**Symptom**: CI "Native startup graph budget" failed: 38 `react-native-mmkv/src/*` modules were reachable via sync edges in the background graph but landed in no eager bundle and no segment, which would crash the bg runtime with "Requiring unknown module".
**Root Cause**: `buildRuntimeOwnership` promoted every sync dep of a shared-startup module into the common-bundle set, but the common bundle is serialized from the MAIN graph only. A dep that resolves differently per runtime (react-native-mmkv → real package in bg, guard shim in main) exists only in the bg graph, so promotion removed it from bg-only ownership while the common bundle could never emit it.
**Fix**: The shared-startup expansion only promotes deps that are shared-equivalent (present in both graphs with identical signatures); runtime-divergent deps stay runtime-owned so each eager bundle ships its own variant under the same stable module id.
**Catchable by**: NEW — not covered (build allocator invariants need a cross-runtime completeness gate; the union build's assertBundleCompleteness caught it only in CI)

## Case: Jest suite mocking platformEnv as native crashed the whole shard via WebStorage
**Date**: 2026-08-26 | **Platforms**: CI unit tests (all shards at risk)
**Symptom**: Unit Tests shard crashed the Node process: `IndexedDBPromised.open` threw "Cannot read properties of undefined (reading 'open')" inside `new WebStorage()`'s async promise executor, killing jest before any suite result was reported.
**Root Cause**: A test mocked `platformEnv` with `isNative: true` but without `isJest: true`; after a base-branch merge extended ServiceApp's import graph to `webStorageInstance.ts`, the falsy `isJest` made the module construct real IndexedDB-backed WebStorage singletons in Node, and the unhandled rejection killed the worker process.
**Fix**: The test mock keeps `isJest: true`; platform-file seams (`nativeSyncStorageParts`, `jotaiStorageNativeMMKV`) are mapped to their `.native` implementations via jest `moduleNameMapper` so native-mocked suites construct jest-safe storage.
**Catchable by**: Section 6: Tests cover happy path AND edge cases (platformEnv mocks must preserve `isJest`); NEW — a platformEnv test mock omitting `isJest` is a systemic hazard worth a lint/setup guard

## Case: Shared stock balance atom loop and stale restore
**Date**: 2026-09-01 | **Platforms**: iOS, Android, desktop, web, extension
**Symptom**: Navigating from a stock Market detail page to a Trending/Top Coins token caused `Maximum update depth exceeded` (white screen, OK-61600). After breaking the loop, returning to the retained stock page left trading disabled until its balance changed.
**Root Cause**: Two retained Market detail screens share `marketSwap`. Each `useSwapStockSelectedBalanceSync` instance wrote the same atom and listed `storedBalance` as an effect dep, so write → rerender → write ping-ponged. Removing that dep stopped the loop, but the retained stock instance no longer republished on return, and an unfocused stock instance could still overwrite the current screen when its fetch completed.
**Fix**: Keep the functional atom update (skip unchanged values) and publish only while `useRouteIsFocused()` is true, so blur stops overwrites and focus restores the current screen's balance.
**Catchable by**: Section 4: Shared hook/utility modified → checked all consumers; Section 5: "Not loaded" vs later async updates on a retained screen; NEW — shared context atoms plus retained navigation screens need an active-owner or focus write lock, not only a skip-if-equal setter

## Case: Desktop More menu always scrolled
**Date**: 2026-09-01 | **Platforms**: desktop
**Symptom**: Default zh/en More popover needed vertical scroll even though content almost fit (OK-61457).
**Root Cause**: Popover used a fixed `height: 600`. Content was slightly over 600, so it always scrolled.
**Fix**: Use `maxHeight: 680` and hug content. Desktop skips the inner flex `ScrollView` (it collapsed height); outer `overflow: scroll` scrolls only when over the cap.
**Catchable by**: Section 1: a fixed height that almost matches content will always overflow; express as maxHeight so short locales hug.

## Case: Desktop More menu dark tiles used `$theme-dark` which never matched
**Date**: 2026-09-01 | **Platforms**: desktop, web
**Symptom**: Grid icon tiles and Prime badges looked like the popover background in dark mode. Pink debug color also did not show.
**Root Cause**: Tamagui 2.7 compiles `$theme-dark` to `:root.t_dark` (`<html>`), but `t_dark` is stamped on `<body>`. Pinning the class to html re-enabled overrides app-wide and washed out Home.
**Fix**: Set rest/hover/press colors from `useThemeVariant()` instead of `$theme-dark`. Do not change `addThemeClassName`.
**Catchable by**: NEW — web `$theme-*` CSS must match where Tamagui puts the theme class; a global class move is not a local widget fix.

## Case: Notifications row leaked into More → Preferences
**Date**: 2026-09-01 | **Platforms**: desktop
**Symptom**: Opening Preferences from the More menu showed a Notifications row even though Notifications is its own settings tab.
**Root Cause**: Promoted `desktopTab` items were hidden only when `insideTabNavigator` was true. `SettingListSubModal` has no sidebar, so the source item stayed visible.
**Fix**: Hide any item with `desktopTab` on every category host. Mobile home still shows it via `mobileHome`.
**Catchable by**: Section 4: a hide rule gated on "has sidebar" will re-show the item on standalone hosts.

## Case: Desktop More overflow scrolled Menu header and About
**Date**: 2026-09-01 | **Platforms**: desktop, wide web
**Symptom**: When the popover exceeded `maxHeight`, Menu title and About scrolled away with the body.
**Root Cause**: `overflow: scroll` was on the outer stack that also owns header and the pinned footer. Inner `ScrollView` + `flex={1}` had collapsed, so the whole panel became the scroller.
**Fix**: Clip the outer stack. Scroll only the body with `flexGrow` / `flexShrink` / `flexBasis: auto` so short menus still hug and chrome stays pinned when content overflows.
**Catchable by**: Section 3: header/footer that look pinned must live outside the scrollport, not just sit at the ends of an overflowing column

## Case: Hiding every desktopTab item removed extension Notifications
**Date**: 2026-09-01 | **Platforms**: extension, narrow web
**Symptom**: Preferences / Security category pages lost Notifications and Connections. Search could still open them; the list could not.
**Root Cause**: `desktopTab` means "also a sidebar tab", but the sidebar only exists when `useIsTabNavigator()` is true. Always hiding the source row deleted the only entry on extension popup and narrow web.
**Fix**: Hide `desktopTab` items only on tab-navigator hosts. Phone still hides them via `mobileHome`.
**Catchable by**: Section 4: a hide rule must keep the host that still needs the list entry; Section 6: layout-visibility helpers need a host-matrix test

## Case: More menu source growth failed web startup graph budget
**Date**: 2026-09-01 | **Platforms**: web (startup graph)
**Symptom**: CI `Web startup graph budget` failed: `sourceSizeBytes` 13173627 / 13172736 (+891 B).
**Root Cause**: `HeaderRight`, `MDHeader`, and `BottomMenu` statically imported `MoreActionButton/index.tsx` (~56 KiB). Layout and theme work in that file entered the first-visit graph.
**Fix**: Load the trigger through `LazyMoreActionButton` so the popover module is a separate chunk. Desktop body uses `overflow-y: auto`.
**Catchable by**: Section 3: header-mounted widgets that grow must stay behind a lazy import; NEW — do not add first-screen source to a file already in the web startup graph

## Case: New lazy native module missing module-id registry
**Date**: 2026-09-01 | **Platforms**: iOS/Android (native union build)
**Symptom**: Native startup graph CI failed: `LazyMoreActionButton.tsx` is not registered in `module-id-registry.json`.
**Root Cause**: Native three-bundle allocation requires every module path in the graph to have a stable ID. Adding a new file under `packages/kit` without `module-id:update` breaks unionBuild.
**Fix**: Run `yarn workspace @onekeyhq/mobile module-id:update --map` for the new path and commit the registry row (`7931`).
**Catchable by**: NEW — new files that enter the native graph must be added to `apps/mobile/bundle-registry/module-id-registry.json` before push

## Case: localTokens/localHistory IndexedDB blob self-heal
**Date**: 2026-09-03 | **Platforms**: desktop (Electron/Chromium storage; web/ext share the code path)
**Symptom**: Desktop users hit permanent SimpleDB read failures on `simple_db_v5:localTokens` / `localHistory` with `UnknownError: Failed to read large IndexedDB value` (OK-61648), blocking builder-based writes the same way as OK-59997 perp.
**Root Cause**: Large Chromium IndexedDB values are external blobs; corruption leaves the record forever unreadable. Self-heal was opt-in and only enabled for `perp`.
**Fix**: Default-on self-heal for the exact Chromium unreadable-blob signature (`UnknownError` + message `includes`); backoff retries (50/500/1000ms) + write-overlap veto before delete; `defaultLogger.app.storage.simpleDbUnreadableSelfHeal` local trail for export. The dead record is already unrecoverable — leaving it blocks builder writes and the app.
**Catchable by**: Section 4: Shared hook/utility modified → checked all consumers; NEW — durable unreadable storage errors need a default recovery path, not per-entity opt-in

## Case: Prime logout tombstone is not equivalent to a missing SimpleDB record
**Date**: 2026-09-03 | **Platforms**: desktop / web / extension (IndexedDB self-heal path)
**Symptom**: Default-on SimpleDB self-heal would delete an unreadable `simple_db_v5:prime` record; a leftover Supabase session then rebuilt `oneKeyIdAuthState: loggedIn` (silent re-login after logout).
**Root Cause**: `markOneKeyIdLoggedOutPreservingSessions` writes a tombstone in SimpleDB while keeping credentials in `supabaseStorageInstance`. After delete, `getRawData()` is `null`, so `persistMigratedLegacyAuthSessionSourceIfUnset` treats "empty" as "never logged out" and commits LegacyEmailSupabase + `loggedIn`. Unreadable ≠ empty.
**Fix**: `SimpleDbEntityPrime` opts out of unreadable-record self-heal so the Chromium blob error stays loud-fail; other SimpleDB entities remain default-on.
**Catchable by**: Section 4: Shared hook/utility modified → checked all consumers; NEW — tombstone / monotonic-epoch records must not treat self-heal `null` as "never written"

## Case: Prime web redeem URL rewritten off `/prime/redeem`
**Date**: 2026-09-06 | **Platforms**: Web
**Symptom**: Email link `https://app.onekey.so/prime/redeem?code=` would not stay in the address bar after navigation sync; refresh landed on Home (or Market in dapp mode).
**Root Cause**: `buildAllowList` `pagePath()` runs `removeExtraSlash` (`path.replace(/\/+/g, '')`) then prepends `/`. The rewrite `/prime/redeem` became allowlist key `/primeredeem`, which never matched `getPathFromState`'s real URL, so the path was rewritten to `/`.
**Fix**: Register the public path as literal `PRIME_REDEEM_LANDING_PATH` (`/prime/redeem`) instead of a `pagePath()` key. Regression test calls real `buildAllowList()` and asserts `/primeredeem` is absent.
**Catchable by**: NEW — web public URLs with an inner slash cannot use `pagePath()`; allowlist tests must call `buildAllowList()`, not a handwritten path

## Case: Browser search submits on Chinese IME Enter when typing English
**Date**: 2026-09-08 | **Platforms**: desktop, web, extension
**Symptom**: In Discovery search, using a Chinese IME to type English and pressing Enter once committed the letters and immediately started a Google search (e.g. query `fou r`).
**Root Cause**: `useSearchPopover` treated every Enter as submit. IME confirmation Enter was not ignored, and Chromium fires that keydown after `compositionend` with `isComposing` already false.
**Fix**: Shared IME composition lock ignores composing / keyCode 229 events and holds the lock until after the confirming Enter. Input forwards React composition props through the repository's existing RN-web ESM patch. Discovery inputs disable submit auto-blur; non-native SearchBar defaults to retaining focus while honoring an explicit blurOnSubmit setting.
**Catchable by**: NEW — web/desktop inputs that submit on Enter must ignore IME composition (including the post-compositionend confirming Enter), retain focus, and test the patched production ESM entry rather than the unpatched CJS entry

## Case: Cached banner quotes mask same-identity CMS logo updates
**Date**: 2026-09-15 | **Platforms**: desktop, web, iOS, Android, extension (Market Home banners)
**Symptom**: After keeping hydrated quote rows across 30s list polls (anti-flash), a CMS logo change on the same banner `_id` never appeared until remount or identity change.
**Root Cause**: `mergeBannerQuotes` replaced the fresh list `tokens` with cached quote rows, then that merged list was passed into `hydrateMarketBannerQuotes`, so `previewLogos` was built from stale cached logos.
**Fix**: Hydrate from the raw banner list; overlay latest preview logos onto cached quote rows for display and hydrate-failure fallback. Quote membership still only changes after a completed hydrate.
**Catchable by**: Section 4: Data flow end-to-end; NEW — an anti-flash cache must not become the source of truth for poll fields that are allowed to update

## Case: Stock list defaulted to 24h volume instead of market cap
**Date**: 2026-09-15 | **Platforms**: all Market stock lists
**Symptom**: Opening the Stocks tab sorted by 24h volume on first load (OK-63392).
**Root Cause**: `DEFAULT_MARKET_STOCK_SORT_BY` was `'volume24h'`.
**Fix**: Default sort is `'marketCap'` descending; list hook tests assert the first request and the cleared-column restore.
**Catchable by**: Section 4: Implementation matches original requirement; Section 6: default sort covered by tests

## Case: Favoriting AAPL listing starred chain aapl in search
**Date**: 2026-09-15 | **Platforms**: all (universal search)
**Symptom**: Starring the AAPL collection made other-network aapl tokens appear favorited (OK-63400).
**Root Cause**: Search rows used nested/inferred `stock.stockId` for `MarketStarV2`, so chain tokens shared the `stock:AAPL` watchlist key with the listing.
**Fix**: Only listings from `/utility/v1/stocks/search` (top-level `stockId`, no chain identity) pass `stockId` to star/nav; chain tokens keep chain identity even when nested stock metadata is present.
**Catchable by**: Section 4: Shared hook/utility modified → checked all consumers; NEW — listing identity and chain-token identity must not share watchlist keys

## Case: Tokens without API stock ID opened stock detail
**Date**: 2026-09-15 | **Platforms**: all Market/search navigation
**Symptom**: xStock / ticker-named tokens without a server stock ID opened MarketStockDetail (OK-63401).
**Root Cause**: `resolveMarketStockId` inferred IDs from `underlyingAssetTicker` and xStock naming.
**Fix**: Resolve stock routes only from explicit `stockId` / `stock.stockId`. Search navigation additionally requires a top-level listing `stockId`.
**Catchable by**: Section 4: identity heuristics; NEW — do not infer product identity from display names or related tickers

## Case: Global search omitted `/utility/v1/stocks/search`
**Date**: 2026-09-15 | **Platforms**: all (universal search)
**Symptom**: Searching a ticker in global search returned tokenized chain tokens only, not the stock listing.
**Root Cause**: `universalSearchOfV2MarketToken` only called `searchV2Token`.
**Fix**: Universal search also calls `searchMarketStocks` and prepends mapped listings. Swap Pro keeps token-only search via `includeStockListings`.
**Catchable by**: Section 4: Data flow end-to-end API → state → UI; NEW — new identity APIs must be wired into every search surface that presents that product

## Case: K-line last-value badge used mid-amount ellipsis
**Date**: 2026-09-15 | **Platforms**: desktop, mobile, web, extension
**Symptom**: Chart last-value labels showed `$77,250...K` instead of OKX-style `$77.25K`.
**Root Cause**: `formatChartPrice` truncated the numeric body at 8 characters and inserted `...` before the K/M/B unit, so compact units still dumped extra decimals.
**Fix**: Round compact and >=$1 amounts to 2 decimals; drop extra decimals instead of mid-amount ellipsis; keep trailing `...` only when integer+unit still cannot fit.
**Catchable by**: Section 6: visual/format bugs need a regression test of the exact display string; NEW — compact-unit labels must not insert ellipsis before the unit

## Case: Wallet-home Stocks tab reused tokenized stock list
**Date**: 2026-09-15 | **Platforms**: desktop, mobile, web, extension
**Symptom**: Wallet Home PopularTrading Stocks showed tokenized tickers like `AAPLon` instead of public stocks (TCENT, IWM).
**Root Cause**: Stocks category reused `fetchMarketTokenList` (`/utility/v2/market/tokens?type=stocks`) instead of the public stocks API used by Market Stocks.
**Fix**: Detect the stocks category and load `fetchMarketStockList`; map `stockId` / `stockListingName` for display and hide network icons.
**Catchable by**: Section 4: shared hook/utility modified → check all category consumers; NEW — a Market category named like another product surface must use that surface's list API, not the generic token list

## Case: Universal search mixed stock listings into the Market tab
**Date**: 2026-09-16 | **Platforms**: Desktop, Web, Extension, iOS, Android
**Symptom**: Searching AAPL put the real stock next to AAPLon / xStock under Market, and the Liquidity column showed `--` because listings have no liquidity.
**Root Cause**: `V2MarketToken` search prepended stock listings into the same result bucket and reused the token table columns.
**Fix**: Split stock listings into `MarketStock` with their own tab/section and show Name / Price / Market cap / Volume.
**Catchable by**: Section 4: shared hook/utility modified → checked all consumers; NEW — mixed asset types in one search tab need their own columns and empty-tab hiding

## Case: Native union build failed on unregistered search helpers
**Date**: 2026-09-16 | **Platforms**: iOS, Android (native union build)
**Symptom**: CI Native startup graph budget failed; Codex/Devin flagged `universalSearchTabs.ts` and `marketSearchMetric.ts`.
**Root Cause**: New files entered the native Metro graph via sync imports but were missing from `module-id-registry.json`.
**Fix**: Register both paths with `updateRegistryFromModulePaths` and commit IDs `13357` / `23019`.
**Catchable by**: NEW — new `packages/kit` files on the native startup graph must be registered before push

## Case: Market search preset hid the new Stocks section
**Date**: 2026-09-16 | **Platforms**: iOS, Android, extension (Discovery market header)
**Symptom**: Searching AAPL from Discovery Market showed only AAPLon / AAPLx under Market; the real listing appeared only after tapping Stocks.
**Root Cause**: `initialTab="market"` landed on the Market tab, which filters sections by title. Stocks is a different title, and native Discovery does not focus `ETabRoutes.Market`, so All-tab prioritization never ran.
**Fix**: Open the All tab for the market preset and treat `initialTab="market"` as market-focused so Stocks / Market / Perp stay first.
**Catchable by**: Section 3: Cross-platform Impact — a tab-route focus gate must also cover hosts that pass `initialTab`; Section 4: shared filter after splitting a section title

## Case: Market detail back walked leftover token pages
**Date**: 2026-09-16 | **Platforms**: iOS, Android, Desktop, Web
**Symptom**: Switching tokens in a Market detail, or opening multiple details from Wallet Home, made the top-left back button pass through previous detail pages instead of returning to the Market list.
**Root Cause**: Home and the token selector used nested `navigate`, which stacked `MarketDetailV2` / `MarketStockDetail`. The custom back handler only `pop()`ped one screen, and native empty history reset to `TabMarket` which does not exist on Discovery.
**Fix**: Collapse the Market/Discovery stack to `[list, one detail]` when opening or switching a detail, and `popToTop` when the previous route is still a leftover detail.
**Catchable by**: Section 4: Logic moved between files carries its surrounding guard/condition; NEW — custom back handlers must collapse stacked same-feature screens, not assume one-to-one push/pop

## Case: Market detail collapse treated banner and SwapPro as leftover token pages
**Date**: 2026-09-17 | **Platforms**: iOS, Android, Desktop, Web
**Symptom**: Home banner → banner list → token detail back skipped the banner list; switching tokens from that path reset away the banner page. SwapPro modal token changes rewrote the background Market stack. Native empty-history back could land on Browser instead of Market.
**Root Cause**: `MarketBannerDetail` was counted as a leftover detail, so back used `popToTop` and switch used `reset` to `[list, detail]`. `openOrReplaceMarketDetailRoute` rewrote any unfocused Main Market stack, including when SwapPro owned the focused detail. Native `CommonActions.reset` to `TabDiscovery` omitted `defaultTab`.
**Fix**: Treat only token/stock/native pages as leftover details and keep banner hosts when collapsing. Skip rewriting Main only when the focused route is a market detail the found stack does not own. Pass `defaultTab: global_market` on native list reset.
**Catchable by**: Section 4: shared hook/utility modified → checked all consumers; NEW — a collapse/reset of stacked feature screens must preserve legitimate intermediate hosts and must not rewrite an unfocused background stack

## Case: SwapPro setParams cleared disableTrade and from
**Date**: 2026-09-17 | **Platforms**: iOS, Android, Desktop, Web
**Symptom**: Switching tokens inside SwapPro market detail could re-enable Buy/Sell and break Back, resetting a TabDiscovery route onto SwapModal.
**Root Cause**: `replaceFocusedMarketDetailRoute` wrote every identity key including `undefined` for `from` / `disableTrade` / `showFavoriteButton`. SET_PARAMS merges those undefineds over the SwapPro-owned route params.
**Fix**: Omit SwapPro-owned keys when updating `SwapProMarketDetail` in place so the modal keeps disableTrade and from.
**Catchable by**: Section 4: shared hook/utility modified → checked all consumers; NEW — SET_PARAMS that writes explicit undefined must not clobber host-owned route flags the caller does not re-supply

## Case: Market Simple chart last price lagged the title quote
**Date**: 2026-09-17 | **Platforms**: Desktop, Web (Market detail Simple chart; same component on stock/token desktop layouts)
**Symptom**: AAPL Simple 1H showed title `$332.41` while the chart's last price label stayed at `$334.76`.
**Root Cause**: Simple fetched 5m historical buckets once and never merged the live title quote. The last point was a 5m cutoff (often the still-open bucket's stale close). Pro already pushed websocket last-close into the title; Simple did the opposite and froze the line.
**Fix**: Drop a still-open bucket, keep closed 5m cutoffs, and append a single `[now, titlePrice]` point so the line tail tracks the title without rewriting a closed cutoff.
**Catchable by**: Section 4: Data flow end-to-end; NEW — a Simple/line chart that uses coarse buckets must overlay the same live quote the header reads, not wait for the next bucket close

## Case: Market Simple chart live merge skipped stale/future bars and compact labels
**Date**: 2026-09-17 | **Platforms**: Desktop, Web (Market detail Simple chart)
**Symptom**: 1H title `$0.0000653` while hover and the last-value tag showed `$0.0006459` / `$0.000645`; pre-market share 1H stayed on the last session close.
**Root Cause**: Merge skipped when the last closed bar was outside `rangeSeconds` or `t > now`, so the line never received the title quote. Hover used `numberFormat` string flattening and the axis used an 8-character `$0.0₄…` compact form, so even a matching value looked like a different price.
**Fix**: Always append `[now, titlePrice]` after dropping open/future tail bars; render hover with `NumberSizeableText` `price` (same as the title) and give the axis a 10-character budget so `$0.0000653` stays in full.
**Catchable by**: Section 4: Data flow end-to-end; Section 6: hover vs last-value vs title must share one formatter; NEW — do not skip a live overlay because the last historical bar sits outside the visible window

## Case: Chart axis and header rounded the same quote with two different algorithms
**Date**: 2026-09-17 | **Platforms**: Desktop, Web, iOS, Android (Market Simple chart, Swap stock chart)
**Symptom**: Header showed `$0.001235` while the axis last-value tag showed `$0.0012345`; at five leading zeros the header used `$0.0₅653` and the axis used `$0.00000653`. Widening the axis character budget to 10 only moved the mismatch to a different price band.
**Root Cause**: Two independent formatters. `formatPrice` rounds the decimal string half-up to `4 + leadingZeros` places via BigNumber and switches to subscript above 4 zeros. `formatChartPrice` truncated a double's full decimal expansion to a character budget and switched to subscript above 5 zeros. Matching them by tuning the budget only widens the band where they happen to agree.
**Fix**: Give `formatChartPrice` the same sub-$1 rule — 4 significant digits, subscript above 4 leading zeros. Round the `toExponential()` digit string rather than calling `toFixed` on the double, because the double behind `0.0012345` is `0.00123449…` and would round down. Locked in with a test that compares both formatters over a price sweep, plus one that pins the deliberate divergences (axis drops trailing zeros and compacts K/M/B).
**Catchable by**: NEW — when two components must display the same number, assert equality against the other formatter; matching the rendered width or digit budget is not the same as sharing the rounding rule

## Case: Pro K-line chart rounded sub-$1 prices away from the header
**Date**: 2026-09-17 | **Platforms**: iOS, Android (Market detail Pro chart — mobile has no Simple chart)
**Symptom**: The header and the chart could print different digits for one quote, e.g. `$0.001235` above `0.001234`. Reported from a mobile screenshot where the axis also mixed `0.0₄9463` with `0.0002756`.
**Root Cause**: `formatTradingViewNativePriceTick` in `chartLayout.ts` is a third price formatter, independent of `formatPrice` and `formatChartPrice`. It called `toFixed` on the binary double, so `0.0012345` (stored as `0.00123449…`) rounded down while the header's BigNumber `ROUND_HALF_UP` on the decimal string rounded up.
**Fix**: Round the `toExponential()` digit string half-up inside the worklet. Left `PRICE_LEADING_ZERO_SUBSCRIPT_THRESHOLD = 3` untouched: subscript versus plain is notation, and the chart legitimately compacts harder than the header. Test compares both formatters after expanding subscripts and normalizing trailing zeros, so it asserts the value and ignores the notation.
**Catchable by**: NEW — when two components show the same number, the parity test must compare the value after normalizing notation; and a repo can hold more than two formatters for one concept, so grep for every implementation before declaring a display bug fixed

## Case: Watchlist stock rows rendered NaN prices while their quote batch was still in flight
**Date**: 2026-09-17 | **Platforms**: Desktop, Web (Market detail token selector; Market Home watchlist shared the same hook)
**Symptom**: OK-63638. Switching the detail-page selector from Favorites to another tab and back flashed four stock rows with placeholder logos, a literal `NaN` price and `--` for every other metric, while the crypto rows in the same list vanished entirely for ~1s.
**Root Cause**: Tab switching swaps `WatchlistTokenSelectorList` for `CategoryTokenSelectorList`, so `useMarketWatchlistTokenList` remounts with every request reset. Its merge step builds listing (stock/asset) rows straight from the local watchlist record — `stockId` alone is enough for a name — and filled the missing quote fields with `NaN`, whereas spot rows require a server match and were dropped. Those synthesized rows made `data.length > 0`, which defeated the list's `isLoading && data.length === 0` spinner guard, and the price cell was the only metric with no empty-value branch.
**Fix**: Hold listing rows back until the quote batch resolves (distinguish "batch unresolved" from "batch returned no entry", so delisted favorites stay removable); cache the resolved batch on `IMarketWatchlistDataCache.listing` and park the ref on the selector shell that outlives the tabs, invalidating it when the watchlist gains an uncovered entry; give the price cell the same `--` fallback the other metrics already had.
**Catchable by**: Section 5: "not loaded" vs "empty" properly distinguished — a row synthesized from local state is not loaded data; NEW — when one list builds rows from two sources with different readiness, the loading guard must key on the slowest source, not on row count

## Case: Same-route detail entry still pushed another page
**Date**: 2026-09-17 | **Platforms**: iOS, Android, Desktop, Web
**Symptom**: Opening a token from a list while already on a detail page of the same route added another detail page, so Back walked through the previous token.
**Root Cause**: `useToDetailPage` derived `shouldReplaceCurrentDetail` from `currentRouteName !== detailRouteName`, so the same-route case fell through to `navigation.push`. The stack collapse added for the token selector never ran on this entry.
**Fix**: Add a `shouldUpdateCurrentDetail` branch that calls `setParams` with `buildReplacedMarketDetailParams`, sharing the identity-clearing list with the selector path.
**Catchable by**: Section 4: shared hook/utility modified → checked all consumers; NEW — a "replace instead of push" option must also cover the same-route case, not only route changes

## Case: Extension preview handle survived a token switch
**Date**: 2026-09-17 | **Platforms**: Browser extension (expand tab)
**Symptom**: Switching assets on an extension market detail could show a retry error instead of the new asset.
**Root Cause**: `bg` writes the preview into `chrome.storage.session` and the expand-tab `main` runtime reads `marketTokenPreviewId` back from the URL hash. `DETAIL_ROUTE_PARAM_KEYS` omitted that key, and SET_PARAMS merges, so the stale handle stayed attached to the new identity.
**Fix**: Add `marketTokenPreviewId` to the cleared identity keys so a switch without a new handle writes `undefined`.
**Catchable by**: Section 4: state atoms modified → verified all readers/writers; NEW — an identity-clearing allowlist must enumerate every route param that carries cross-runtime handles

## Case: Selector keyboard stayed up after picking a searched token
**Date**: 2026-09-17 | **Platforms**: Android
**Symptom**: Searching in the market token selector and tapping a result left the IME on top of the detail page unless the list had been dragged first.
**Root Cause**: The selector list uses persist-taps, so a row tap never blurs the SearchBar. Closing the modal alone does not blur the RN input.
**Fix**: Blur the focused RN input (`blurFocusedInput`) on select. Do not use `dismissKeyboard` here — its Android `hideSoftInputFromWindow` blocks the next programmatic `autoFocus` from showing the IME.
**Catchable by**: Section 5: stale IME / focus state after dismiss; NEW — closing an autoFocused overlay must blur its input, and window-level IME hiding must not be used on a path that later autoFocuses

## Case: Empty stock 24h change rendered as zero in watchlist
**Date**: 2026-09-17 | **Platforms**: iOS, Android, Desktop, Web, Browser extension
**Symptom**: OK-63645. Some stock favorites such as ICBC showed `0.0%` for the 24-hour change when the quote had no change value.
**Root Cause**: The stock batch API represented a missing `priceChange24hPercent` as an empty string, and the shared watchlist hook converted it with `Number('')`, producing a valid zero.
**Fix**: Normalize the raw change before conversion, map missing or invalid values to the existing `-`/`NaN` sentinel, and preserve the valid string `'0'` as zero.
**Catchable by**: Section 4: edge cases covered; Section 6: bug fix includes a regression test — numeric API tests must distinguish an empty string from a real zero

## Case: Metro stale-lock concurrency test reclaimed fresh locks
**Date**: 2026-09-18 | **Platforms**: CI, local development tooling
**Symptom**: PR unit-test shard intermittently failed with `ENOTEMPTY` while two cleaners reclaimed a stale Metro cache lock.
**Root Cause**: The test used `staleMs: 0` to make its fixture stale, which also made a newly created ownerless lock immediately reclaimable before its owner file was written.
**Fix**: Backdate only the initial stale fixture and use a nonzero stale threshold so replacement locks remain fresh during acquisition.
**Catchable by**: Section 6: tests cover race conditions; NEW — concurrency tests must make the intended stale fixture old without making newly created resources instantly stale

## Case: Home Market watchlist View more used a smaller font than other tabs
**Date**: 2026-09-18 | **Platforms**: Desktop, Mobile, Web, Extension
**Symptom**: OK-63673. Wallet Home Market watchlist "View more" rendered at 14px while Trending/Stocks/other category tabs used 16px, so switching tabs jumped the Market block height.
**Root Cause**: Watchlist built a custom Button child (`$bodyMdMedium` + `$5.5` icon) copied from a Perps polish; category tabs kept the standard medium Button (`iconAfter` + `$bodyLgMedium`).
**Fix**: Restore the watchlist footer to the same standard Button API as `MarketCategoryTokenList`. Leave Perps Home View more unchanged.
**Catchable by**: Section 4: shared hook/utility modified → checked all consumers; NEW — duplicated UI across sibling tabs must share one control, not a later one-off restyle

## Case: Home Market stock/top-coin rows were 60px while token rows were 68px
**Date**: 2026-09-18 | **Platforms**: Desktop, Web, Extension
**Symptom**: OK-63673 follow-up. Wallet Home Market rows measured 716×60 for stocks/top coins and 716×68 for trending tokens with an address, so switching tabs still jumped height after the View more font was unified.
**Root Cause**: `Table` defaults `minHeight` to 60. One-line stock/native identity cells stay at that floor; address + copy-button cells grow to 68.
**Fix**: Set home Market table `minHeight` / `estimatedItemSize` to 68 so every tab's rows match the taller token row.
**Catchable by**: Section 3: UI changes verified on desktop; NEW — when a list mixes one-line and two-line cells, lock the row minHeight to the taller variant before declaring tab-switch height stable

## Case: Market detail search stock list loaded from scratch every open
**Date**: 2026-09-18 | **Platforms**: Desktop, Mobile, Web, Extension
**Symptom**: OK-63683. Opening Market detail search showed a 1–2s spinner on Stocks, while Favorites / Trending / Top Coins returned immediately. Re-entering search loaded Stocks again.
**Root Cause**: `useMarketStockSelectorList` cold-fetched `/utility/v1/stocks` on every mount (`undefinedResultIfReRun` + empty init, no SWR). Rows were published only from `listState` after an effect, so even a cached first page still rendered as empty + spinner. Home stocks already persisted under `swrKeys.marketHomeStocks`.
**Fix**: Hydrate the default selector list from the selector SWR slot, falling back to the Home stocks cache; keep cached rows on screen while revalidating; only show the full-page spinner when there are no rows.
**Catchable by**: Section 5: "not loaded" vs "empty"; NEW — a remounted picker that already has a sibling list cache must render that cache instead of treating the next fetch as a first load

## Case: Market selector showed end-of-list while the cached first page was still revalidating
**Date**: 2026-09-18 | **Platforms**: Desktop, Mobile, Web, Extension
**Symptom**: After cache-first hydration, Market detail search Stocks showed `ListEndIndicator` during the silent first-page refresh, so a short cached page looked complete even though `nextCursor` still existed.
**Root Cause**: `canLoadMore` used `!isLoading`. Cached rows made the returned `isLoading` false for the spinner, but `usePromiseResult`'s loading flag still flipped `canLoadMore` off; the footer treated "cannot load more" as end of list. `onEndReached` during that window was dropped.
**Fix**: Track `isRevalidatingFirstPage` until the remote first page for this query settles; hide `ListEndIndicator` in that window; queue `loadMore` and flush it after the first page lands.
**Catchable by**: Section 4: edge cases loading vs empty; NEW — a cache-first list must not render an end sentinel while the first remote page is still in flight

## Case: Desktop Home stocks SWR was skipped so Market search could not hydrate
**Date**: 2026-09-18 | **Platforms**: Desktop, Web, Extension
**Symptom**: OK-63683 remaining P2. Opening Market detail search on desktop still waited on `/utility/v1/stocks` because Home never wrote `swrKeys.marketHomeStocks`.
**Root Cause**: `useMarketStockList` only set `swrKey` when `platformEnv.isNative`, so desktop/web Home visits left the selector with no sibling cache.
**Fix**: Persist Home stocks under `swrKeys.marketHomeStocks` on every platform so the selector can hydrate from the same slot.
**Catchable by**: Section 3: identified which platforms consume modified code; NEW — a native-only SWR write cannot be the cache source for a cross-platform picker

## Case: Queued stock selector load-more used the cached cursor
**Date**: 2026-09-18 | **Platforms**: Desktop, Mobile, Web, Extension
**Symptom**: After cache-first search hydration, scrolling to the bottom during the 1–2s first-page refetch could request page two with the cached `nextCursor` and append it onto a newer first page.
**Root Cause**: `remoteQueryKeyRef` was written in the fetch callback before `listState` applied the remote first page. The queue effect then called `loadMore()` with the cached cursor still in the closure.
**Fix**: Publish the remote first page as `currentListState` on the same render (Home’s pattern) so a flushed `loadMore` uses the remote cursor and items.
**Catchable by**: Section 5: race conditions in async operations; NEW — a queued pagination flush must use the remote first page, not the cache snapshot that is still in React state

## Case: Home Market 68px row minHeight stretched the table header
**Date**: 2026-09-18 | **Platforms**: Desktop, Web, Extension
**Symptom**: OK-63673 follow-up. Desktop Home Market data rows were locked to 68px, but `TableHeaderRow` spreads `rowProps` before `headerRowProps`, so the header also became 68px.
**Root Cause**: `headerRowProps` only set padding/margin and did not override `minHeight`.
**Fix**: Set desktop `headerRowProps.minHeight` to 0 so the header stays content-sized while data rows keep the 68px floor.
**Catchable by**: Section 4: UI changes verified on desktop; NEW — when rowProps set minHeight, headerRowProps must override it or the header grows with the rows

## Case: Weak-network Market home hid Stocks and Robinhood tabs
**Date**: 2026-09-18 | **Platforms**: Desktop, Web, Extension; Native when config cache is cold
**Symptom**: OK-63704. On a weak or offline network, Market home only showed Favorites / Trending / Top coins / Perps. Stocks and Robinhood tabs disappeared.
**Root Cause**: Those two tabs come only from `basic-config` `spotCategories`. The pre-config fallback listed `trending` alone. Desktop/web also skipped SWR for that config, and `memoizee({ promise: true })` reused the rejected fetch.
**Fix**: Persist `basic-config` on every platform, drop failed memoizee entries, keep Stocks / Robinhood tab identities in the cold fallback, and show Retry on token-list empty errors.
**Catchable by**: Section 4: edge cases loading vs empty; NEW — a remote-driven tab strip must not drop tab identities while its config request is pending or failed

## Case: Pinned TradingView release reused pre-pin CacheStorage
**Date**: 2026-09-18 | **Platforms**: Web
**Symptom**: WEB-01 pinned the chart embed trust root in the app build, but a client that had already cached a malicious asset under `onekey-tradingview-embed:${version}` could still execute those bytes after upgrade.
**Root Cause**: The new worker kept the same CacheStorage namespace. `openTradingViewBootstrapCache()` looked for markers at the versioned `embed-manifest.json` URL, missed the old `/embed/latest.json` marker, and did not reset. `cacheTradingViewAssets()` then skipped integrity checks on cache hits.
**Fix**: Move pinned/current caches to `onekey-tradingview-embed-pin-v1:`, delete the legacy `onekey-tradingview-embed:` namespace when adopting a release, and regression-test that a poisoned legacy entry is not served.
**Catchable by**: Section 4: implementation matches original requirement — a trust-root change must also rotate or re-verify the persistent cache that will execute those bytes

## Case: Stale HideTabBar cleanup covered the market trade buttons
**Date**: 2026-09-20 | **Platforms**: iOS, Android
**Symptom**: OK-63513. After switching tokens a couple of times on the market detail page, the bottom tab bar reappeared over the trade buttons, so the buttons looked cut off or missing.
**Root Cause**: `EAppEventBusNames.HideTabBar` carries a bare boolean, so the last writer wins. A leaving market detail instance ran its focus cleanup after the surviving instance had already asked for a hidden tab bar, and its `false` resurrected it. The focus effect does not depend on route params, so an in-place `setParams` switch never re-asserted `true`. The trade footer is a plain flex sibling padded only by `useSafeAreaInsets().bottom`, so a visible tab bar drew straight over it.
**Fix**: Route every writer through a `hideTabBarRequests` registry that resolves the union of live per-instance requests, and pad the trade footer with `usePageFooterSafeAreaBottom() + usePageFooterTabBarHeight()` so a visible tab bar cannot overlap it.
**Catchable by**: Section 4: state atoms modified → verified all readers/writers; NEW — a global boolean owned by several screens needs per-instance request ownership, and a footer outside Page.Footer must claim the tab bar inset itself instead of trusting the hide path

## Case: Market detail footer used a stricter identity than the chart
**Date**: 2026-09-20 | **Platforms**: iOS, Android, Desktop, Web, Extension
**Symptom**: OK-63513 follow-up. After switching tokens on market detail, some tokens (BTC, Solana, ERC-20) lost the bottom trade buttons even when the chart rendered.
**Root Cause**: Footer visibility compared raw `address.toLowerCase()` + `networkId` + `decimalsResolved`. Route/store identity can be a short code (`sol`), a CoinGecko id (`bitcoin`), or an empty native address, while `tokenDetail` uses `btc--0` / `sol--101` and may omit or case-fold the address. Switching also clears `tokenDetail` before the next fetch, so the mobile footer waited on full detail while the chart already accepted a matching preview.
**Fix**: One `isMatchingMarketTokenIdentity` for chart, footer, and preview merge. Footer show/hide is identity-only; decimals stay on quote/stock skeleton. Mobile footer reads the same display token (preview or detail) as the chart.
**Catchable by**: Section 4: shared hook/utility modified → checked all consumers; NEW — two surfaces that represent the same market token must share one identity compare, and decimal readiness must not unmount the trade footer

## Case: Market display preferred stale detail over the new preview
**Date**: 2026-09-20 | **Platforms**: iOS, Android, Desktop, Web, Extension
**Symptom**: OK-63513 follow-up review. Switching tokens could still hide the footer, pass `bitcoin` into Swap, or treat a previous native coin as the current mint.
**Root Cause**: `displayTokenDetail` kept the old full detail whenever it existed, even if a new preview belonged to another token. Native identity treated any contract vs empty address as the same asset. Placeholder networks matched every chain. Discovery hide-tab-bar had no unmount release.
**Fix**: Prefer the new preview when identities differ; native shortcut only for empty/zero/ticker; placeholder nets only match a concrete chain or the same placeholder string; Swap execution blanks non-contract ids; Discovery releases its owner on unmount.
**Catchable by**: Section 4: shared hook/utility modified → checked all consumers; NEW — a display fallback must not keep previous full detail over a newer matching preview

## Case: Swap invitee reward blocked watch-only EVM as unsupported
**Date**: 2026-09-20 | **Platforms**: Desktop, Mobile, Web, Extension
**Symptom**: Opening Swap 奖励 from a watch-only account showed “当前账户不支持。请连接一个 EVM 账户后重试” with no action, while Perps/Earn still allowed viewing.
**Root Cause**: Viewing reused HD/HW invite-code identity (`getReferralCodeWalletInfo`) and `getCurrentEvmAccountAddress` only resolved an ETH sibling via `indexedAccountId`, which Others accounts do not have.
**Fix**: Resolve Others EVM addresses from the stored account; fetch rebate by that address; map no-wallet / no-EVM empty state to Perps `InviteeRewardNoWallet`. Binding stays HD/HW-only.
**Catchable by**: Section 4: shared hook/utility modified → checked all consumers; NEW — a viewing surface must not reuse a bind-only wallet-identity gate

## Case: Market detail search omitted stock listings
**Date**: 2026-09-20 | **Platforms**: Desktop, Mobile, Web, Extension
**Symptom**: Searching AAPL from Market detail returned tokenized chain assets such as AAPLx, but not the aggregated AAPL stock listing shown by universal search.
**Root Cause**: Both detail token selectors only called the V2 market-token search path; the stock selector hook already supported `/utility/v1/stocks/search` but was unmounted whenever a search query was present.
**Fix**: Run stock and market-token search independently, render separate Stocks and Market sections, and preserve `stockId` navigation separately from chain `network + address` navigation.
**Catchable by**: Section 4: Data flow end-to-end API → state → UI; NEW — every product search entry must wire all product identity APIs that its result UI promises

## Case: Reselecting the current stock cleared its chart
**Date**: 2026-09-20 | **Platforms**: Desktop, Web
**Symptom**: OK-63786. Selecting the stock already open in Market detail left the page on the same symbol but removed its K-line.
**Root Cause**: Stock rows do not carry a resolved token variant, so same-stock navigation called `prepareStockTokenDetail` with an empty identity. That cleared the loaded token state, while the unchanged route identity did not restart the detail request.
**Fix**: Preserve the loaded token state when a retained desktop/web stock route reselects the same `stockId` without an explicit variant, while still applying the route parameter update.
**Catchable by**: Section 4: state data flow end-to-end; NEW — idempotent same-identity navigation must not clear state whose refetch key remains unchanged

## Case: Mobile stock selector could not identify the detail behind its modal
**Date**: 2026-09-20 | **Platforms**: Mobile
**Symptom**: OK-63786 follow-up. Reselecting the currently displayed stock from the mobile selector still cleared the K-line.
**Root Cause**: The same-stock guard read `useRoute()` from the selector modal, so it never saw the `MarketStockDetail` route and `stockId` underneath the overlay.
**Fix**: Resolve the active stock identity from the nested Market/Discovery stack in the root navigation state before deciding whether to preserve loaded token detail.
**Catchable by**: Section 4: logic moved between scopes carries its surrounding context; NEW — modal actions that mutate background-page state must derive identity from the owning stack, not the modal route

## Case: Grouped Market stock search stopped after its first page
**Date**: 2026-09-20 | **Platforms**: Desktop, Mobile, Web, Extension
**Symptom**: Market detail search exposed only the first 20 matching stock listings even when the API returned another cursor.
**Root Cause**: The grouped search result components consumed the stock hook's first-page items but ignored `canLoadMore`, `loadMore`, and load-more error state.
**Fix**: Add progressive Show more pagination to expanded Stocks results on desktop and mobile, including loading feedback and retry after a failed page.
**Catchable by**: Section 4: data flow end-to-end API → state → UI; NEW — every paginated hook consumer must wire the cursor, loading, and retry outputs or explicitly document a result cap

## Case: Whitespace Market search showed the default stock list
**Date**: 2026-09-20 | **Platforms**: Desktop, Mobile, Web, Extension
**Symptom**: Typing only spaces in Market detail search hid the category tabs and rendered the unfiltered stock list as search results.
**Root Cause**: Search mode used a truthy debounce string, so `"   "` entered grouped search. The stock hook then trimmed the query to empty and called the default list endpoint.
**Fix**: Gate search mode on the trimmed query, and pass `searchOnly` so grouped search never hydrates the default stock list.
**Catchable by**: Section 4: empty vs loaded data; NEW — a search surface that reuses a list hook must distinguish "no query" from "unfiltered browse"

## Case: Simple mode chart froze because it had no live price source at all
**Date**: 2026-09-20 | **Platforms**: Desktop, Web, Extension (wide layout only; Simple mode never mounts on native)
**Symptom**: OK-63597 reopened. On the market detail page the price and the K-line looked stuck and drifted ~0.6-1% from third-party quotes, minutes at a time. Pro mode on the same token stayed live. The earlier fix had aligned chart and header, so they now looked stale together instead of disagreeing.
**Root Cause**: Simple mode had two dead inputs. `tokenDetail.price`, which the chart pins its last point to, comes from a 6s poll of `/utility/v2/market/token/detail`, and that endpoint answers from a snapshot holding one price for minutes. The `StockSimpleChart` series itself was fetched once with no `pollingInterval`, so the drawn history stopped at mount time. Pro mode looked live for an unrelated reason: TradingView runs its own K-line feed inside the embed and reports the price back through `TRADINGVIEW_PRICE_UPDATE`, a path Simple mode never mounts.
**Fix**: Added `useMarketKlineLivePrice`, which polls the token K-line endpoint (proven live for the same token whose snapshot was frozen) every 6s and writes the newest bucket close back through `applyChartPriceUpdate`, plus range-aware polling for the drawn series. The 6s cadence stays inside `CHART_PRICE_FRESHNESS_MS` so the snapshot poll cannot overwrite the fresh price, and the write timestamp is forced strictly newer because `MarketTokenPrice` silently drops a non-newer `lastUpdated`.
**Catchable by**: NEW — a `usePromiseResult` `pollingInterval` must not vary with UI state: the first attempt derived it from the selected range, and because a changed interval is treated as a timer retune that withholds the dependency-triggered run for the full new duration, every range switch sat on the previous range's line for minutes. Pace per-variant work inside the request instead, keeping one constant interval. NEW — an event stream is not a refresh mechanism: the ohlcv websocket only emits on a trade, so a first attempt that subscribed Simple mode to it was inert on exactly the thin markets whose snapshot sits still. Verify a "live" source actually delivers for the failing asset (not just that the subscription registered), and treat `dataCount` as no evidence at all since consumers clear it on every frame. A new `usePromiseResult` poll on this route also needs `checkIsFocused: false`, or a modal still on the stack gates every tick into a no-op; and when checking any poll by hand, confirm the window is visible first, because a hidden document parks the whole chain.

