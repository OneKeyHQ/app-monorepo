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

## Case: BLE pairing dialog shown while device already paired and communicating
**Date**: 2026-08-13 | **Platforms**: Desktop (macOS/Windows desktop BLE)
**Symptom**: Creating a wallet over Bluetooth showed the "Pairing with your device" dialog mid-flow (OK-60091) even though the device was OS-paired and actively communicating on a live Noble session; the dialog's repair then re-scanned and "discovered" the very connectId the caller passed in.
**Root Cause**: `getCompatibleConnectId` triggered the USB→BLE pairing repair purely from DB bookkeeping (device record missing `bleConnectId` — recreated that way by a USB wallet creation after wallet removal deleted the record), never recognizing the caller's incoming connectId as the live BLE endpoint. DB binding state is neither necessary nor sufficient evidence of OS pairing state.
**Fix**: Before the dialog fallback, silently verify and persist the caller-held connectId, gated by runtime evidence: id differs from the record's USB identifiers, carried real device traffic within 60s (stamped by DEVICE.STATE/DEVICE.CONNECT, invalidated on DEVICE.DISCONNECT), probed with silentMode (no global error dialog from error constructors), a bounded 10s timeout, and the session's remembered protocol pinned (forced re-detection sends a V2 Ping into an active V1 session, which the device may not answer — SDK error 713); the probed deviceId must match before persisting.
**Catchable by**: NEW — not covered (interactive dialog triggered from persistence bookkeeping instead of live transport evidence)

## Case: Perps stuck on "Loading tokens..." after IndexedDB blob corruption
**Date**: 2026-08-11 | **Platforms**: desktop (Electron/Chromium storage; web/ext share the code path)
**Symptom**: Desktop 6.5.0 user's Perps chart and token selector permanently stuck on "Loading tokens..." across restarts; realtime prices kept updating; mobile unaffected (OK-59997).
**Root Cause**: All Perps caches live in one `simple_db_v5:perp` record. Chromium stores large IndexedDB values as external blob files; a crash corrupted the blob so every read rejected with `UnknownError: Failed to read large IndexedDB value`. `setRawData(builder)` reads the old record before writing, so all writes failed too — the record could never be repaired by normal usage.
**Fix**: Opt-in self-heal in `SimpleDbEntityBase` (perp only): on the exact corruption signature, retry once, then remove the record with write-overlap vetoes (writeSeq + pendingWrites snapshot); read generation prevents in-flight reads from resurrecting cleared/overwritten cache; Settings → Clear cache gained a "Perps" item backed by a runtime clear epoch in ServiceWebviewPerp.
**Catchable by**: NEW — storage-layer read errors need a recovery path for caches that can be rebuilt; read-before-write persistence cannot self-repair a corrupted record
