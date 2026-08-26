import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { isDeviceStageOwnedHardwareUiAction } from '@onekeyhq/shared/src/hardware/deviceStageOwnership';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type {
  IDeviceStageConfirmContent,
  IDeviceStageErrorReasonValue,
  IDeviceStageStepValue,
} from '@onekeyhq/shared/types/deviceStage';

import {
  EHardwareUiStateAction,
  EThirdPartyHardwareUiAction,
  deviceStageAtom,
  firmwareUpdateWorkflowRunningAtom,
} from '../../states/jotai/atoms';

import type {
  IDeviceStageState,
  IHardwareUiPayload,
  IThirdPartyAppInstallState,
  IThirdPartyBatchInstallState,
  IThirdPartyHardwareUiState,
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

/** Doc §05 mapping table B — third-party actions → steps. BLE binding is
 * deliberately absent: it stays on its legacy dialog (保留现状). */
const THIRD_PARTY_ACTION_TO_STEP: Partial<
  Record<string, IDeviceStageStepValue>
> = {
  [EThirdPartyHardwareUiAction.searching]: 'searching',
  [EThirdPartyHardwareUiAction.connecting]: 'connecting',
  [EThirdPartyHardwareUiAction.processing]: 'processing',
  [EThirdPartyHardwareUiAction.done]: 'done',
  [EThirdPartyHardwareUiAction.confirmOnDevice]: 'confirmOnDevice',
  [EThirdPartyHardwareUiAction.openApp]: 'openApp',
  [EThirdPartyHardwareUiAction.unlockDevice]: 'unlockDevice',
  [EThirdPartyHardwareUiAction.requestTrezorPin]: 'pinOnApp',
  [EThirdPartyHardwareUiAction.requestTrezorPassphrase]: 'passphraseOnApp',
  [EThirdPartyHardwareUiAction.requestTrezorThpPairing]: 'pairingCode',
  [EThirdPartyHardwareUiAction.requestDeviceNotFound]: 'deviceNotFound',
  [EThirdPartyHardwareUiAction.requestBtcHighIndexConfirm]: 'btcHighIndex',
};

/** How long the third-party ✓ `done` beat rests before the exit. */
const DONE_HOLD_MS = 1600;

/** The authenticity flow's steps — they share one checklist. */
const AUTH_STEPS: ReadonlySet<IDeviceStageStepValue> = new Set([
  'genuineCheck',
  'authVerifying',
  'authSuccess',
  'authFailure',
]);

export type IDeviceStageBurstBeginParams = {
  connectId?: string;
  deviceType?: IDeviceStageState['deviceType'];
  deviceName?: string;
  /** Third-party track: vendor + real model for the capsule product shot. */
  vendor?: EHardwareVendor;
  vendorModel?: string;
  vendorModelName?: string;
  /** Confirm-card payload for this burst, if the caller knows it upfront. */
  confirmContent?: IDeviceStageConfirmContent;
};

export class DeviceStageBurstScope {
  private depth = 0;

  private burstSeq = 0;

  private offTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * The active UI-held burst (OK-59934 Stage 1). Long flows — onboarding
   * above all — span several wrappers with network calls and user
   * decisions in between, so no single wrapper can bracket them: the
   * legacy UI flickered at exactly those seams. The UI opens one hold for
   * the whole flow and the wrappers inside join it by depth.
   *
   * Tokenized so a stale holder (an unmounted page, a superseded run) can
   * never close a newer flow's burst.
   */
  private explicitToken: number | undefined;

  private explicitSeq = 0;

  /**
   * The registered confirm content (OK-59934 confirm channel): business
   * code registers what the confirm card must show — before the wrapper
   * starts (UI side) or through the wrapper options — and REQUEST_BUTTON
   * consumes it. Lives until the burst ends; re-registering mid-burst
   * redirects the next confirm (multi-call bursts).
   */
  private confirmContent: IDeviceStageConfirmContent | undefined;

  /** The active burst's third-party vendor — drives the ✓ done beat. */
  private activeVendor: EHardwareVendor | undefined;

  async registerConfirmContent(
    content: IDeviceStageConfirmContent | undefined,
  ) {
    this.confirmContent = content;
  }

  /**
   * The stage plays every hardware interaction it owns — except while the
   * firmware update workflow runs, which drives its own full page and
   * stays outside the stage's scope.
   */
  async isEnabled() {
    return !(await firmwareUpdateWorkflowRunningAtom.get());
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
      this.activeVendor = params.vendor;
      const prev = await deviceStageAtom.get();
      const stageStillOn = prev && prev.step !== 'off';
      // A follow-up wrapper inside the grace window rejoins the visible
      // stage: keep the burstId so the container's close grant stays armed.
      this.burstSeq = stageStillOn ? prev.burstId : this.burstSeq + 1;
      await this.setStep('connecting', {
        connectId: params.connectId,
        deviceType: params.deviceType,
        deviceName: params.deviceName,
        vendor: params.vendor,
        vendorModel: params.vendorModel,
        vendorModelName: params.vendorModelName,
        resetOutcome: true,
      });
      return;
    }
    // Joined a burst already on stage (typically a UI-held one): the flow
    // is mid-step, so only the device identity refreshes — the caller
    // often knows the device the holder could not name yet.
    if (params.vendor && !this.activeVendor) {
      this.activeVendor = params.vendor;
    }
    await this.mergeDeviceIdentity(params);
  }

  /**
   * Opens a UI-held burst spanning a whole flow. Returns the token the
   * holder must present to close it.
   */
  async beginExplicit(params: IDeviceStageBurstBeginParams = {}) {
    this.explicitSeq += 1;
    const token = this.explicitSeq;
    this.explicitToken = token;
    await this.begin(params);
    return token;
  }

  /** Closes a UI-held burst. A stale token is ignored. */
  async endExplicit(params: { token: number; error?: unknown }) {
    if (this.explicitToken !== params.token) {
      return;
    }
    this.explicitToken = undefined;
    await this.end({ error: params.error });
  }

  async end(params: { error?: unknown } = {}) {
    if (!(await this.isEnabled())) {
      return;
    }
    // No burst to end: the flag flipped mid-flow, or the person already
    // closed the stage (userClose drops the depth). Either way there is
    // nothing to land — never resurrect a dismissed stage with an outcome.
    if (this.depth <= 0) {
      return;
    }
    this.depth = Math.max(this.depth - 1, 0);
    if (this.depth > 0) {
      return;
    }
    this.confirmContent = undefined;
    const wasVendorBurst = Boolean(this.activeVendor);
    this.activeVendor = undefined;
    const reason = params.error
      ? this.mapErrorToReason(params.error)
      : undefined;
    if (params.error && reason !== 'silent') {
      await this.setStep('error', {
        errorReason: reason === 'generic' ? undefined : reason,
      });
      return;
    }
    // The third-party track closes a successful burst with the ✓ done
    // beat (doc §4.7) before leaving; OneKey bursts leave directly.
    if (wasVendorBurst) {
      const prev = await deviceStageAtom.get();
      if (prev && prev.step !== 'off') {
        await this.setStep('done', {});
        this.scheduleOff(DONE_HOLD_MS);
        return;
      }
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
    if (
      !isDeviceStageOwnedHardwareUiAction({
        action,
        eventType: payload?.eventType,
      })
    ) {
      return;
    }
    const step = ACTION_TO_STEP[action];
    if (!step) {
      return;
    }
    this.clearOffTimer();
    if (step === 'passphraseOnApp') {
      // Which passphrase this is decides the whole shape of the ask. The
      // SDK names the wallet it wants recovered (V1 `passphraseState`, V2
      // `expectedPassphraseState`) — that is an unlock. Neither means the
      // device is opening a wallet that does not exist yet: a creation,
      // which the design teaches first (doc §4.4) before the entry.
      const isCreate =
        !payload?.passphraseState && !payload?.expectedPassphraseState;
      await this.setStep(isCreate ? 'passphraseIntro' : 'passphraseOnApp', {
        connectId,
        deviceType: payload?.deviceType,
        payload,
        passphraseMode: isCreate ? 'create' : 'verify',
      });
      return;
    }
    await this.setStep(step, {
      connectId,
      deviceType: payload?.deviceType,
      payload,
    });
  }

  /** The teach card was read: on to the entry it introduced. */
  async notePassphraseIntroDone() {
    if (!(await this.isEnabled())) {
      return;
    }
    const prev = await deviceStageAtom.get();
    if (prev?.step !== 'passphraseIntro') {
      return;
    }
    this.clearOffTimer();
    await this.setStep('passphraseOnApp', { passphraseMode: 'create' });
  }

  /**
   * The third-party rail (doc §05 table B): fed from a single atom
   * subscription in ServiceHardwareUI — the adapters' many write sites
   * stay untouched. Install state outranks the ui-state action (the
   * install dialog coexisted with prompt toasts in the legacy UI);
   * BLE binding is ignored — its legacy dialog stays.
   */
  async onThirdPartyState({
    ui,
    install,
    batch,
  }: {
    ui: IThirdPartyHardwareUiState | undefined;
    install: IThirdPartyAppInstallState | undefined;
    batch: IThirdPartyBatchInstallState | undefined;
  }) {
    if (!(await this.isEnabled())) {
      return;
    }
    if (install) {
      this.clearOffTimer();
      const progress =
        typeof install.progress === 'number'
          ? Math.round(install.progress * 100)
          : undefined;
      if (batch) {
        await this.setStep('installBatch', {
          vendor: install.vendor,
          appName: install.appName,
          installProgress: progress,
          installQueue: batch.queue,
          installActiveIndex: batch.currentIndex,
        });
        return;
      }
      await this.setStep(
        progress === undefined ? 'installConfirm' : 'installing',
        {
          vendor: install.vendor,
          appName: install.appName,
          installProgress: progress,
        },
      );
      return;
    }
    if (ui) {
      if (ui.action === EThirdPartyHardwareUiAction.requestTrezorBleBinding) {
        return;
      }
      if (ui.action === EThirdPartyHardwareUiAction.error) {
        await this.setStep('error', { vendor: ui.vendor });
        return;
      }
      const step = THIRD_PARTY_ACTION_TO_STEP[ui.action];
      if (!step) {
        return;
      }
      this.clearOffTimer();
      await this.setStep(step, {
        vendor: ui.vendor,
        thirdPartyAction: ui.action,
        btcHighIndexPath: ui.payload?.path,
        btcHighIndexAccountIndex: ui.payload?.accountIndex,
      });
      return;
    }
    // Everything cleared: a call boundary on the third-party rail. Only a
    // showing third-party stage reacts — never an active OneKey burst, and
    // never an outcome already landed by the wrapper's end() (the wrapper
    // clears these atoms right before it ends the burst, so this callback
    // can race the done/error beat).
    const prev = await deviceStageAtom.get();
    if (
      !prev ||
      prev.step === 'off' ||
      prev.step === 'done' ||
      prev.step === 'error' ||
      !prev.vendor
    ) {
      return;
    }
    if (this.depth > 0) {
      await this.setStep('processing', {});
    } else {
      this.scheduleOff();
    }
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
      authChecklist?: IDeviceStageState['authChecklist'];
      authFailureReason?: IDeviceStageState['authFailureReason'];
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
    this.explicitToken = undefined;
    this.confirmContent = undefined;
    this.activeVendor = undefined;
    await this.forceOff();
  }

  /** Refreshes who is on stage without touching the step or the beat. */
  private async mergeDeviceIdentity(params: IDeviceStageBurstBeginParams) {
    const hasIdentity =
      params.connectId ||
      params.deviceType ||
      params.deviceName ||
      params.vendor ||
      params.vendorModel ||
      params.vendorModelName;
    if (!hasIdentity) {
      return;
    }
    await deviceStageAtom.set((prev) => {
      if (!prev || prev.step === 'off') {
        return prev;
      }
      return {
        ...prev,
        connectId: params.connectId ?? prev.connectId,
        deviceType: params.deviceType ?? prev.deviceType,
        deviceName: params.deviceName ?? prev.deviceName,
        vendor: params.vendor ?? prev.vendor,
        vendorModel: params.vendorModel ?? prev.vendorModel,
        vendorModelName: params.vendorModelName ?? prev.vendorModelName,
      };
    });
  }

  private scheduleOff(delayMs: number = OFF_GRACE_MS) {
    this.clearOffTimer();
    this.offTimer = setTimeout(() => {
      void this.forceOff();
    }, delayMs);
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
      vendor: prev.vendor,
      vendorModel: prev.vendorModel,
      vendorModelName: prev.vendorModelName,
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
      passphraseMode?: IDeviceStageState['passphraseMode'];
      authChecklist?: IDeviceStageState['authChecklist'];
      authFailureReason?: IDeviceStageState['authFailureReason'];
      vendor?: EHardwareVendor;
      vendorModel?: string;
      vendorModelName?: string;
      thirdPartyAction?: IDeviceStageState['thirdPartyAction'];
      appName?: string;
      installProgress?: number;
      installQueue?: string[];
      installActiveIndex?: number;
      btcHighIndexPath?: string;
      btcHighIndexAccountIndex?: number;
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
        connectId: extras.connectId ?? base?.connectId,
        deviceType: extras.deviceType ?? base?.deviceType,
        deviceName: extras.deviceName ?? base?.deviceName,
        // Device/vendor identity is sticky within the burst (base), never
        // across bursts; the per-step extras (install / btc / action)
        // never outlive their own step.
        vendor: extras.vendor ?? base?.vendor,
        vendorModel: extras.vendorModel ?? base?.vendorModel,
        vendorModelName: extras.vendorModelName ?? base?.vendorModelName,
        thirdPartyAction: extras.thirdPartyAction,
        appName: extras.appName,
        installProgress: extras.installProgress,
        installQueue: extras.installQueue,
        installActiveIndex: extras.installActiveIndex,
        btcHighIndexPath: extras.btcHighIndexPath,
        btcHighIndexAccountIndex: extras.btcHighIndexAccountIndex,
        // The checklist survives the whole authenticity run (the ask, the
        // wait, the landing, the unofficial-firmware failure card).
        authChecklist: AUTH_STEPS.has(step)
          ? (extras.authChecklist ?? base?.authChecklist)
          : undefined,
        authFailureReason:
          step === 'authFailure' ? extras.authFailureReason : undefined,
        errorReason: step === 'error' ? extras.errorReason : undefined,
        inputError: extras.inputError,
        passphraseMode: extras.passphraseMode ?? base?.passphraseMode,
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
