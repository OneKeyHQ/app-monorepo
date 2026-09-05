import { useEffect, useRef } from 'react';

import { useHardwareUiStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/hardware';
import type { IHardwareUiState } from '@onekeyhq/kit-bg/src/states/jotai/atoms/hardware';
import { usePasswordPromptPromiseTriggerAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

/**
 * Hardware UI states that render NOTHING the user must see or answer. Mirrors
 * the exclusion lists of `hasDialogAction` / `hasToastAction` in
 * HardwareUiStateContainer.tsx (private callbacks there): every other action
 * either opens the hardware dialog (PIN / passphrase / checking / loading /
 * permission prompts) or the "confirm on device" toast (REQUEST_BUTTON), both
 * RN-layer surfaces the system sheet would cover. Firmware actions cannot
 * occur mid-payment; they are listed so the two lists stay recognizably equal.
 *
 * Deliberate divergences from `hasDialogAction` / `hasToastAction`:
 * - CLOSE_UI_PIN_WINDOW is a close, not a surface. The container does not
 *   exclude it, but ServiceHardware never writes it to the atom (SKIPPED_EVENTS
 *   there; the state machine renders it as ProcessLoading instead), so listing
 *   it only makes the intent explicit.
 * - FIRMWARE_TIP is listed even though `hasToastAction` DOES toast it for the
 *   ConfirmOnDevice / InstallingFirmware messages: a firmware flow cannot run
 *   mid-payment, so no such toast can appear under the pay sheet.
 * - DEVICE_PROGRESS is NOT listed: the container hides its dialog only while
 *   `globalShowDeviceProgressDialogEnabled` is false, and the only producer of
 *   that flag is the batch-create-account dialog. During a payment the flag is
 *   its default `true`, so DEVICE_PROGRESS does open a dialog and must park.
 * - BLUETOOTH_UNSUPPORTED / BLUETOOTH_POWERED_OFF are NOT listed, so they
 *   classify as parking; like the closes above they are in SKIPPED_EVENTS and
 *   never reach the atom. Parking is the fail-safe direction for anything that
 *   does render, so they stay out of the set.
 */
const HARDWARE_ACTIONS_WITHOUT_UI = new Set<EHardwareUiStateAction>([
  EHardwareUiStateAction.CLOSE_UI_WINDOW,
  EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
  EHardwareUiStateAction.FIRMWARE_TIP,
  EHardwareUiStateAction.FIRMWARE_PROGRESS,
  EHardwareUiStateAction.PREVIOUS_ADDRESS,
  EHardwareUiStateAction.REQUEST_DEVICE_IN_BOOTLOADER_FOR_WEB_DEVICE,
  EHardwareUiStateAction.REQUEST_DEVICE_FOR_SWITCH_FIRMWARE_WEB_DEVICE,
]);

export function isWcPayHardwarePromptActive(
  state: IHardwareUiState | undefined,
): boolean {
  const action = state?.action;
  if (!action) {
    return false;
  }
  return !HARDWARE_ACTIONS_WITHOUT_UI.has(action);
}

/**
 * Phase names the parking rule distinguishes. Not imported from the flow (that
 * would be a cycle): the flow passes `pagePhase.name`, so a phase added there
 * and missing here is a compile error at the call site — the sync guard.
 */
export type IWcPayPromptParkingPhaseName = 'idle' | 'paying' | 'result';

/**
 * When the prompt parking applies at all. Split out from the flow so the rule
 * is testable on its own — every term below is load-bearing.
 *
 * NATIVE ONLY. The problem it solves is native-specific: there the sheet is a
 * system presentation (@expo/ui BottomSheet / Android M3 ModalBottomSheet)
 * that covers every RN-layer surface. On web/desktop the ordering is already
 * correct — the password prompt renders at z-index 160000
 * (PASSWORD_VERIFY_CONTAINER_Z_INDEX) and the hardware dialogs above the
 * DialogV2 web popup at z-index 50 (dialog.css) — so parking there would fix
 * nothing and cost something: hiding the dialog unmounts and remounts it
 * through its exit/entry animation and races base-ui's focus restore against
 * the password input the user is typing into.
 */
export function isWcPayPromptParkingEnabled({
  isNative,
  pagePhaseName,
  isSubFlowOwningScreen,
}: {
  isNative: boolean;
  pagePhaseName: IWcPayPromptParkingPhaseName;
  isSubFlowOwningScreen: boolean;
}): boolean {
  return isNative && pagePhaseName === 'paying' && !isSubFlowOwningScreen;
}

/**
 * The pay sheet is a system-level presentation that covers the RN-layer
 * password and hardware dialogs. While a prompt is on screen the sheet must
 * park (hide) so the user can answer it, and come back once it is gone.
 * Cached-password and biometric paths never set these atoms, so they keep the
 * sheet up. Native only — see isWcPayPromptParkingEnabled for why the hook is
 * left disabled on web/desktop rather than made harmless there.
 *
 * The parking is REACTIVE, and that is a known timing caveat: the pipelines
 * emit `onPhase('signingMessage')` fire-and-forget and there is no awaited
 * hook at the prompt boundary, so the prompt mounts UNDER the sheet first and
 * becomes reachable only once this park has dismissed it. Device QA on iOS and
 * Android must confirm the prompt does become reachable; if it gets stuck, the
 * fallback design is an awaited `onBeforePrompt` hook on the controller (park
 * plus a WC_PAY_SHEET_DISMISS_MS wait, exactly like
 * `onBeforePushConfirmModal`), which this hook cannot substitute for.
 *
 * Reveal ownership: this hook only ever reveals what it parked, and only while
 * `enabled`. The terminal reveal on every exit path stays with the flow
 * (handlePay's finally), and the reveal after a pushed confirm page stays with
 * `onAfterConfirmModalSettled` — hence the ref reset instead of a reveal when
 * `enabled` goes false.
 */
export function useWcPayPromptParking({
  enabled,
  park,
  reveal,
}: {
  enabled: boolean;
  park: () => void;
  reveal: () => void;
}) {
  const [{ passwordPromptPromiseTriggerData }] =
    usePasswordPromptPromiseTriggerAtom();
  const [hardwareUiState] = useHardwareUiStateAtom();
  const isPromptActive =
    Boolean(passwordPromptPromiseTriggerData) ||
    isWcPayHardwarePromptActive(hardwareUiState);
  const parkedRef = useRef(false);
  useEffect(() => {
    if (!enabled) {
      // Not a reveal: the flow owns the terminal one. Resetting keeps a later
      // enable (a second attempt, or a confirm page settling) parking again.
      parkedRef.current = false;
      return;
    }
    if (isPromptActive && !parkedRef.current) {
      parkedRef.current = true;
      park();
    } else if (!isPromptActive && parkedRef.current) {
      parkedRef.current = false;
      reveal();
    }
  }, [enabled, isPromptActive, park, reveal]);
}
