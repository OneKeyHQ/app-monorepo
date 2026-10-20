import { useEffect, useRef } from 'react';

import { useHardwareUiStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/hardware';
import type { IHardwareUiState } from '@onekeyhq/kit-bg/src/states/jotai/atoms/hardware';
import { usePasswordPromptPromiseTriggerAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

import { useIsTxFeeOverflowConfirmOpen } from '../../SignatureConfirm/hooks/txFeeOverflowConfirmPresence';

/**
 * Hardware UI states that render NOTHING the user must see or answer. Mirrors
 * the exclusion lists of `hasDialogAction` / `hasToastAction` in
 * HardwareUiStateContainer.tsx (private callbacks there): every other action
 * either opens the hardware dialog (PIN / passphrase / checking / loading /
 * permission prompts) or the "confirm on device" toast (REQUEST_BUTTON), both
 * surfaces the pay sheet steps aside for. Firmware actions cannot occur
 * mid-payment; they are listed so the two lists stay recognizably equal.
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
 * NATIVE ONLY. On a phone both the pay sheet and the prompt are bottom
 * sheets: the pay sheet steps aside so the payer answers one sheet at a time,
 * and so the prompt's keyboard does not lift the pay sheet behind it. On
 * desktop the dialog simply stays behind the prompt — its fixed z-index
 * (WC_PAY_DIALOG_Z_INDEX) sits below every prompt — so parking there would
 * only cost something: hiding the dialog runs it through its exit/entry
 * animation and races the focus restore against the password input the user
 * is typing into.
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
 * While the password prompt or a hardware dialog is on screen the pay sheet
 * parks (hides) so the user answers the prompt on its own, and comes back
 * once it is gone. Cached-password and biometric paths never set these atoms,
 * so they keep the sheet up. Native only — see isWcPayPromptParkingEnabled
 * for why the hook is left disabled on desktop.
 *
 * The fee-overflow double confirm is the third prompt in this lifecycle. The
 * background's verifyTransactionFeeInfo (doubleConfirm) raises it — through
 * the one-shot doubleConfirmTxFeeInfo event, answered by VerifyTxContainer's
 * plain Dialog.show() — when the fee overflows OR the fee precheck itself
 * fails, and then blocks on the answer. The inline send runs that check
 * BEFORE signing (wcPayInlineSendTx), so neither the password nor the
 * hardware atom has parked the sheet yet; without its own signal the sheet
 * would stay up under the dialog. The dialog publishes its presence
 * (txFeeOverflowConfirmPresence) and parks the sheet like the other two.
 *
 * The parking is REACTIVE: the pipelines emit `onPhase('signingMessage')`
 * fire-and-forget and there is no awaited hook at the prompt boundary, so the
 * prompt mounts while the sheet is still up and the sheet steps aside a
 * moment later. The prompt is reachable throughout — the sheet's fixed
 * z-index (WC_PAY_DIALOG_Z_INDEX) keeps it below every prompt.
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
  const isFeeOverflowConfirmOpen = useIsTxFeeOverflowConfirmOpen();
  const isPromptActive =
    Boolean(passwordPromptPromiseTriggerData) ||
    isWcPayHardwarePromptActive(hardwareUiState) ||
    isFeeOverflowConfirmOpen;
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
