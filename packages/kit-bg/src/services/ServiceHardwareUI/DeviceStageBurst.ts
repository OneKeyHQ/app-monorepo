import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import type {
  IDeviceStageErrorReasonValue,
  IDeviceStageStepValue,
} from '@onekeyhq/shared/types/deviceStage';

import {
  EHardwareUiStateAction,
  deviceStageAtom,
  deviceStageEnabledAtom,
} from '../../states/jotai/atoms';

import type {
  IDeviceStageState,
  IHardwareUiPayload,
} from '../../states/jotai/atoms';

/**
 * The burst scope (OK-59934 hard rule #1): one burst = one stage
 * entrance/exit. A burst is one logical user operation, which may span
 * several sequential SDK calls; the SDK emits a CLOSE_UI_WINDOW after every
 * call, so the scope — not the events — decides when the stage leaves.
 *
 * Ownership: every deviceStageAtom write goes through this class.
 * - `begin`/`end` bracket the burst — wired into withHardwareProcessing's
 *   outer start/finally (nested calls join the active burst).
 * - `onHardwareUiEvent` translates the applied hardware UI action into a
 *   step; call-end closes inside a burst become `processing`, never `off`.
 * - `off` has exactly three sources: burst end (after a grace window that a
 *   follow-up burst can cancel), user close (cancel semantics), and an
 *   error outcome being dismissed.
 */

/** How long the stage stays after the last burst layer ends, so an
 * immediately following wrapper (cross-wrapper bursts like hidden-wallet
 * creation) morphs in place instead of exiting and re-entering. */
const OFF_GRACE_MS = 600;

/** Error codes that mean the user themselves ended the flow — the stage
 * simply leaves, no error outcome card. */
const SILENT_CANCEL_CODES = [
  HardwareErrorCode.PinCancelled,
  HardwareErrorCode.CallQueueActionCancelled,
  HardwareErrorCode.DeviceInterruptedFromUser,
  HardwareErrorCode.DeviceInterruptedFromOutside,
];

const DISCONNECTED_CODES = [
  HardwareErrorCode.DeviceNotFound,
  HardwareErrorCode.PollingTimeout,
  HardwareErrorCode.BridgeDeviceDisconnected,
  HardwareErrorCode.BleDeviceDisconnected,
  HardwareErrorCode.BleScanError,
  HardwareErrorCode.BleTimeoutError,
];

const ACTION_TO_STEP: Partial<Record<string, IDeviceStageStepValue>> = {
  [EHardwareUiStateAction.DeviceChecking]: 'connecting',
  [EHardwareUiStateAction.ProcessLoading]: 'processing',
  [EHardwareUiStateAction.DEVICE_PROGRESS]: 'processing',
  [EHardwareUiStateAction.EnterPinOnDevice]: 'enterPin',
  [EHardwareUiStateAction.REQUEST_PIN]: 'pinOnApp',
  [EHardwareUiStateAction.REQUEST_BUTTON]: 'confirm',
  [EHardwareUiStateAction.REQUEST_PASSPHRASE]: 'passphraseOnApp',
  [EHardwareUiStateAction.REQUEST_PASSPHRASE_ON_DEVICE]: 'enterPassphrase',
};

export type IDeviceStageBurstBeginParams = {
  connectId?: string;
  deviceType?: IDeviceStageState['deviceType'];
  deviceName?: string;
};

export class DeviceStageBurstScope {
  private depth = 0;

  private burstSeq = 0;

  private offTimer: ReturnType<typeof setTimeout> | undefined;

  async isEnabled() {
    return deviceStageEnabledAtom.get();
  }

  private clearOffTimer() {
    clearTimeout(this.offTimer);
    this.offTimer = undefined;
  }

  async begin(params: IDeviceStageBurstBeginParams = {}) {
    if (!(await this.isEnabled())) {
      return;
    }
    this.clearOffTimer();
    this.depth += 1;
    if (this.depth === 1) {
      const prev = await deviceStageAtom.get();
      const stageStillOn = prev && prev.step !== 'off';
      // A follow-up wrapper inside the grace window rejoins the visible
      // stage: keep the burstId so the container's close grant stays armed.
      this.burstSeq = stageStillOn ? prev.burstId : this.burstSeq + 1;
      await this.setStep('connecting', {
        connectId: params.connectId,
        deviceType: params.deviceType,
        deviceName: params.deviceName,
        resetOutcome: true,
      });
    }
  }

  async end(params: { error?: unknown } = {}) {
    if (!(await this.isEnabled())) {
      return;
    }
    this.depth = Math.max(this.depth - 1, 0);
    if (this.depth > 0) {
      return;
    }
    const reason = params.error
      ? this.mapErrorToReason(params.error)
      : undefined;
    if (params.error && reason !== 'silent') {
      await this.setStep('error', {
        errorReason: reason === 'generic' ? undefined : reason,
      });
      return;
    }
    this.scheduleOff();
  }

  /**
   * Applied hardware UI events from ServiceHardware's event pipeline.
   * Call-end closes (V2 metadata closes and legacy bare closes alike) keep
   * the stage on `processing` while a burst is active; with no burst they
   * schedule the graceful exit.
   */
  async onHardwareUiEvent({
    action,
    connectId,
    payload,
    shouldClearUiState,
  }: {
    action: string;
    connectId?: string;
    payload?: IHardwareUiPayload;
    shouldClearUiState?: boolean;
  }) {
    if (!(await this.isEnabled())) {
      return;
    }
    const isCloseEvent =
      shouldClearUiState ||
      action === EHardwareUiStateAction.CLOSE_UI_WINDOW ||
      action === EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW;
    if (isCloseEvent) {
      if (this.depth > 0) {
        await this.setStep('processing', { connectId });
      } else {
        this.scheduleOff();
      }
      return;
    }
    const step = ACTION_TO_STEP[action];
    if (!step) {
      return;
    }
    this.clearOffTimer();
    await this.setStep(step, {
      connectId,
      deviceType: payload?.deviceType,
      payload,
    });
  }

  /** Direct step feeds from ServiceHardwareUI's own show* methods. */
  async noteStep(
    step: IDeviceStageStepValue,
    extras: {
      connectId?: string;
      payload?: IHardwareUiPayload;
      confirmDetails?: IDeviceStageState['confirmDetails'];
      confirmMessage?: string;
      confirmDescription?: string;
      inputError?: string;
    } = {},
  ) {
    if (!(await this.isEnabled())) {
      return;
    }
    this.clearOffTimer();
    await this.setStep(step, extras);
  }

  /** PIN / passphrase handed to the device: hold the stage as processing
   * instead of the legacy close-then-reopen. */
  async noteInputSubmitted() {
    if (!(await this.isEnabled())) {
      return;
    }
    const prev = await deviceStageAtom.get();
    if (!prev || prev.step === 'off') {
      return;
    }
    await this.setStep('processing', {});
  }

  /** User dismissed the stage: the exit is already under way — drop burst
   * bookkeeping and settle at off. Cancel semantics live in the caller. */
  async userClose() {
    this.clearOffTimer();
    this.depth = 0;
    await this.forceOff();
  }

  private scheduleOff() {
    this.clearOffTimer();
    this.offTimer = setTimeout(() => {
      void this.forceOff();
    }, OFF_GRACE_MS);
  }

  private async forceOff() {
    const prev = await deviceStageAtom.get();
    if (!prev || prev.step === 'off') {
      return;
    }
    await deviceStageAtom.set({
      burstId: prev.burstId,
      step: 'off',
      connectId: prev.connectId,
      deviceType: prev.deviceType,
      deviceName: prev.deviceName,
    });
  }

  private async setStep(
    step: IDeviceStageStepValue,
    extras: {
      connectId?: string;
      deviceType?: IDeviceStageState['deviceType'];
      deviceName?: string;
      payload?: IHardwareUiPayload;
      errorReason?: IDeviceStageErrorReasonValue;
      confirmDetails?: IDeviceStageState['confirmDetails'];
      confirmMessage?: string;
      confirmDescription?: string;
      inputError?: string;
      resetOutcome?: boolean;
    },
  ) {
    await deviceStageAtom.set((prev): IDeviceStageState => {
      const base = extras.resetOutcome ? undefined : prev;
      return {
        burstId: this.burstSeq || (prev?.burstId ?? 1),
        step,
        connectId: extras.connectId ?? base?.connectId ?? prev?.connectId,
        deviceType: extras.deviceType ?? prev?.deviceType,
        deviceName: extras.deviceName ?? prev?.deviceName,
        errorReason: step === 'error' ? extras.errorReason : undefined,
        inputError: extras.inputError,
        passphraseMode: base?.passphraseMode,
        confirmDetails:
          extras.confirmDetails ??
          (step === 'confirm' ? base?.confirmDetails : undefined),
        confirmMessage:
          extras.confirmMessage ??
          (step === 'confirm' ? base?.confirmMessage : undefined),
        confirmDescription:
          extras.confirmDescription ??
          (step === 'confirm' ? base?.confirmDescription : undefined),
        payload: extras.payload ?? base?.payload,
      };
    });
  }

  private mapErrorToReason(
    error: unknown,
  ): IDeviceStageErrorReasonValue | 'silent' | 'generic' {
    if (
      isHardwareErrorByCode({ error: error as any, code: SILENT_CANCEL_CODES })
    ) {
      return 'silent';
    }
    if (
      isHardwareErrorByCode({
        error: error as any,
        code: HardwareErrorCode.ActionCancelled,
      })
    ) {
      // Device-side reject reaches here as ActionCancelled; app-side user
      // cancels reject with the codes in SILENT_CANCEL_CODES instead.
      return 'rejected';
    }
    if (
      isHardwareErrorByCode({
        error: error as any,
        code: HardwareErrorCode.PinInvalid,
      })
    ) {
      return 'pinInvalid';
    }
    if (
      isHardwareErrorByCode({ error: error as any, code: DISCONNECTED_CODES })
    ) {
      return 'disconnected';
    }
    if (
      isHardwareErrorByCode({
        error: error as any,
        code: HardwareErrorCode.DeviceBusy,
      })
    ) {
      return 'busy';
    }
    return 'generic';
  }
}
