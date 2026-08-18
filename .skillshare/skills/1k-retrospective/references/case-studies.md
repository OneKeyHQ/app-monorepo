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
