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
 * Two deliberate divergences from `hasDialogAction`:
 * - CLOSE_UI_PIN_WINDOW is a close, not a surface. The container does not
 *   exclude it, but ServiceHardware never writes it to the atom (SKIPPED_EVENTS
 *   there; the state machine renders it as ProcessLoading instead), so listing
 *   it only makes the intent explicit.
 * - DEVICE_PROGRESS is NOT listed: the container hides its dialog only while
 *   `globalShowDeviceProgressDialogEnabled` is false, and the only producer of
 *   that flag is the batch-create-account dialog. During a payment the flag is
 *   its default `true`, so DEVICE_PROGRESS does open a dialog and must park.
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
 * The pay sheet is a system-level presentation that covers the RN-layer
 * password and hardware dialogs. While a prompt is on screen the sheet must
 * park (hide) so the user can answer it, and come back once it is gone.
 * Cached-password and biometric paths never set these atoms, so they keep the
 * sheet up.
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
