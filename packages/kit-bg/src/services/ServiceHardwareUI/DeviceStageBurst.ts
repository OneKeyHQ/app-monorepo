import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import type {
  IDeviceStageConfirmContent,
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
  /** Confirm-card payload for this burst, if the caller knows it upfront. */
  confirmContent?: IDeviceStageConfirmContent;
};

export class DeviceStageBurstScope {
  private depth = 0;

  private burstSeq = 0;

  private offTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * The registered confirm content (OK-59934 confirm channel): business
   * code registers what the confirm card must show — before the wrapper
   * starts (UI side) or through the wrapper options — and REQUEST_BUTTON
   * consumes it. Lives until the burst ends; re-registering mid-burst
   * redirects the next confirm (multi-call bursts).
   */
  private confirmContent: IDeviceStageConfirmContent | undefined;

  async registerConfirmContent(
    content: IDeviceStageConfirmContent | undefined,
  ) {
    this.confirmContent = content;
  }

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
    if (params.confirmContent) {
      this.confirmContent = params.confirmContent;
    }
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
    this.confirmContent = undefined;
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
      confirmDescriptionDanger?: boolean;
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
    this.confirmContent = undefined;
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
      confirmDescriptionDanger?: boolean;
      inputError?: string;
      resetOutcome?: boolean;
    },
  ) {
    // Confirm payload priority: explicit extras (demo / special flows) >
    // the burst's registered content (the confirm channel) > what the
    // step already showed (repeat confirms of the same call).
    const registered = step === 'confirm' ? this.confirmContent : undefined;
    const hasExplicitConfirm = Boolean(
      extras.confirmDetails ||
      extras.confirmMessage ||
      extras.confirmDescription,
    );
    await deviceStageAtom.set((prev): IDeviceStageState => {
      const base = extras.resetOutcome ? undefined : prev;
      const pickConfirm = <T>(
        explicit: T | undefined,
        fromRegistration: T | undefined,
        carried: T | undefined,
      ): T | undefined => {
        if (step !== 'confirm') {
          return undefined;
        }
        if (hasExplicitConfirm) {
          return explicit;
        }
        // A registration replaces the card wholesale — never mixed with
        // the previous confirm's leftovers (multi-call bursts re-register
        // between calls).
        if (registered) {
          return fromRegistration;
        }
        return carried;
      };
      return {
        burstId: this.burstSeq || (prev?.burstId ?? 1),
        step,
        connectId: extras.connectId ?? base?.connectId ?? prev?.connectId,
        deviceType: extras.deviceType ?? prev?.deviceType,
        deviceName: extras.deviceName ?? prev?.deviceName,
        errorReason: step === 'error' ? extras.errorReason : undefined,
        inputError: extras.inputError,
        passphraseMode: base?.passphraseMode,
        confirmDetails: pickConfirm(
          extras.confirmDetails,
          registered?.details,
          base?.confirmDetails,
        ),
        confirmMessage: pickConfirm(
          extras.confirmMessage,
          registered?.message,
          base?.confirmMessage,
        ),
        confirmDescription: pickConfirm(
          extras.confirmDescription,
          registered?.description,
          base?.confirmDescription,
        ),
        confirmDescriptionDanger: pickConfirm(
          extras.confirmDescriptionDanger,
          registered?.descriptionDanger,
          base?.confirmDescriptionDanger,
        ),
        confirmCount:
          // eslint-disable-next-line no-nested-ternary
          step !== 'confirm'
            ? undefined
            : registered
              ? registered.count
              : base?.confirmCount,
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
