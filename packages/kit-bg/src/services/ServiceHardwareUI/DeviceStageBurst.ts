import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';

import type { IAirGapUrJson } from '@onekeyhq/qr-wallet-sdk';
import type {
  IOneKeyError,
  IOneKeyErrorI18nInfo,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ECustomOneKeyHardwareError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  isHardwareErrorByCode,
  isOneKeyHardwareError,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  isDeviceStageOwnedHardwareUiAction,
  setDeviceStageBurstActive,
} from '@onekeyhq/shared/src/hardware/deviceStageOwnership';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
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

/**
 * Product call (2026-09): every confirm plays bare — address verify,
 * transactions, messages alike — keeping the surface clean; the device
 * screen is the one read of what is being confirmed. The whole confirm
 * channel stays wired (business registrations, the builders, the atom
 * fields, the component's card and its stories), so flipping this single
 * gate re-lights the card unchanged; the gate only keeps the payload out
 * of the atom, at the one point every content path converges.
 */
const CONFIRM_PAYLOAD_HIDDEN = true;

/** Error codes that mean the user themselves ended the flow — the stage
 * simply leaves, no error outcome card. */
const SILENT_CANCEL_CODES = [
  HardwareErrorCode.PinCancelled,
  HardwareErrorCode.CallQueueActionCancelled,
  HardwareErrorCode.DeviceInterruptedFromUser,
  HardwareErrorCode.DeviceInterruptedFromOutside,
];

/** These errors already open a recovery dialog outside DeviceStage. */
const DEDICATED_DIALOG_ERROR_CODES = [
  HardwareErrorCode.BleDeviceBondError,
  HardwareErrorCode.BlePeerRemovedPairingInformation,
  HardwareErrorCode.BleBondInvalid,
  HardwareErrorCode.DeviceNotOpenedPassphrase,
  HardwareErrorCode.NewFirmwareForceUpdate,
];

/** DeviceNotFound (105) is deliberately absent: the initial search
 * failing is its own verdict — the "Device not connected" card's
 * territory (doc §05 mapping A), classified apart in mapErrorToReason. */
const DISCONNECTED_CODES = [
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

/** How long the authenticity ✓ rests before its narrative is retired —
 * the same beat the third-party ✓ takes, one hold for both endings.
 *
 * Unlike every other authored beat, `authSuccess` has no reader: the
 * runner returns on it and nothing downstream writes the stage again.
 * Without a hold of its own the ✓ stands until the burst happens to end —
 * seven seconds behind the firmware release check, and indefinitely where
 * nothing holds a burst at all. */
const AUTH_SUCCESS_HOLD_MS = DONE_HOLD_MS;

/** How long begin() waits before painting its own `connecting` beat. A
 * flow that opens straight into a real step (the genuine check above all)
 * supersedes it within this window — without it the replica flashes the
 * connecting wallpaper for a frame or two before the flow's first beat. */
const OPENING_BEAT_DEFER_MS = 120;

/** The authenticity flow's steps — they share one checklist. */
const AUTH_STEPS: ReadonlySet<IDeviceStageStepValue> = new Set([
  'genuineCheck',
  'authVerifying',
  'authSuccess',
  'authFailure',
]);

/** The only steps a progress tick may write over. Progress is the story
 * of data moving — while the stage asks something of the person (confirm,
 * an input, a teach card), a trailing tick must never repaint the ask as
 * a wait: the device is still asking. */
const PROGRESS_WRITABLE_STEPS: ReadonlySet<IDeviceStageStepValue> = new Set([
  'connecting',
  'processing',
]);

/** Outcomes that hold the stage until they are read: the notice a failed
 * call landed, the third-party ✓ beat, the Device-not-connected card. */
const OUTCOME_STEPS: ReadonlySet<IDeviceStageStepValue> = new Set([
  'error',
  'done',
  'deviceNotFound',
]);

/** The air-gap pair (doc §4.6). The request UR lives exactly as long as
 * the stage is inside it — the way back from scanQr re-presents the same
 * code, so the payload must survive the crossing in both directions. */
const QR_STEPS: ReadonlySet<IDeviceStageStepValue> = new Set([
  'showQr',
  'scanQr',
]);

/**
 * The air-gap fields' carry rule (the request UR and the session tag
 * alike): alive only inside the QR pair, where an explicit hand-over
 * wins and the crossing keeps what the step already showed; dead
 * everywhere else — no other step may re-present a stale code, and no
 * stale tag may authorize a submit (OK-59934 §4.6).
 */
export function pickQrScoped<T>(
  step: IDeviceStageStepValue,
  next: T | undefined,
  prev: T | undefined,
): T | undefined {
  if (!QR_STEPS.has(step)) {
    return undefined;
  }
  return next ?? prev;
}

/**
 * Which story a DeviceNotFound failure (105) tells — "Device not
 * connected" (doc §05 mapping A) or the mid-burst disconnect notice. The
 * code alone cannot say: a later call in the same burst re-searches an
 * unplugged device and throws the very same 105. But a device that was
 * ever present has spoken by then — the SDK emits no UI event at all when
 * its initial search fails — so "never heard from this burst" is the
 * at-initiation verdict, and everything else keeps `disconnected` (the
 * agreed split: mid-burst unplug stays the disconnect notice). Vendor
 * bursts stay out entirely: their deviceNotFound is the adapter's own
 * live retry ask, not an ending.
 */
export function resolveDeviceNotFoundLanding({
  wasVendorBurst,
  sawDeviceEventThisBurst,
}: {
  wasVendorBurst: boolean;
  sawDeviceEventThisBurst: boolean;
}): 'deviceNotFound' | 'disconnected' {
  if (wasVendorBurst || sawDeviceEventThisBurst) {
    return 'disconnected';
  }
  return 'deviceNotFound';
}

/** The steps that ask something of the person. Only an ask outranks an
 * outcome already on stage — the device is waiting on them, so the notice
 * has had its say. Waits and call-end closes carry no such news: the call
 * that just failed goes on winding down, and its own end must not wipe
 * the reason it failed. */
const ASK_STEPS: ReadonlySet<IDeviceStageStepValue> = new Set([
  'confirm',
  'enterPin',
  'pinOnApp',
  'passphraseIntro',
  'passphraseOnApp',
  'enterPassphrase',
]);

/**
 * The failure's own words, for the card to speak when no reason claims
 * it (OK-59934).
 *
 * The error layer has already localized these: a hardware error class
 * built without an explicit message resolves its translation key into
 * `.message`, which is the very sentence the legacy toast showed —
 * "Passphrase does not match the current wallet, please try again" and
 * some hundred others. The stage clears that toast (failures must not
 * spill), so without carrying the message here the card can only say
 * "Something went wrong".
 *
 * Deliberately unfiltered: where the SDK had nothing better than its own
 * technical string, showing it still matches what production showed, and
 * beats saying nothing.
 */
export function pickErrorMessage(error: unknown): string | undefined {
  const message = (error as { message?: unknown } | undefined)?.message;
  if (typeof message !== 'string') {
    return undefined;
  }
  const trimmed = message.trim();
  return trimmed.length ? trimmed : undefined;
}

/**
 * Who is on stage, kept across the burst.
 *
 * A payload saying `unknown` is one that does not know — the SDK stamps
 * that on every event carrying no device (progress ticks above all), and
 * taking it at face value would drop the replica mid-flow every time one
 * arrived. Identity only ever sharpens: once the stage knows the model,
 * only another real model replaces it.
 */
export function pickDeviceType(
  next: IDeviceStageState['deviceType'],
  prev: IDeviceStageState['deviceType'],
): IDeviceStageState['deviceType'] {
  if (next && next !== EDeviceType.Unknown) {
    return next;
  }
  return prev ?? next;
}

/**
 * The same rule for the identity's text fields — and `??` is not it.
 *
 * The SDK's call-end close arrives with `connectId: ''`, and an empty
 * string is neither null nor undefined, so it wins a `??` and erases the
 * device the stage had already named. That is how a burst reached its
 * own end with no connectId to probe, leaving an unplugged device to
 * land as a generic failure instead of a disconnect (OK-59934).
 *
 * Nothing is ever named by the empty string: it is the absence of news,
 * and absence never replaces knowledge.
 */
export function pickIdentityText(
  next: string | undefined,
  prev: string | undefined,
): string | undefined {
  return next || prev;
}

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
  /** Live connectivity probe backing end()'s disconnect fallback. Injected
   * by ServiceHardwareUI so the scope stays free of service imports. */
  private isDeviceStillConnected?: (connectId: string) => Promise<boolean>;

  constructor(options?: {
    isDeviceStillConnected?: (connectId: string) => Promise<boolean>;
  }) {
    this.isDeviceStillConnected = options?.isDeviceStillConnected;
  }

  private depth = 0;

  private burstSeq = 0;

  private offTimer: ReturnType<typeof setTimeout> | undefined;

  /** The opening beat begin() deferred; the first real step consumes it. */
  private pendingOpen: IDeviceStageBurstBeginParams | undefined;

  private openingTimer: ReturnType<typeof setTimeout> | undefined;

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

  /** Whether the live explicit token's burst actually opened. A token
   * minted while the firmware workflow silenced the stage holds nothing
   * yet; a later ensureBurst presenting it must open the burst then, not
   * merge identity into a stage that is not there. */
  private explicitOpened = false;

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

  /** Whether any SDK-owned device event landed this burst — the input to
   * resolveDeviceNotFoundLanding. App-authored beats (noteStep, the
   * opening `connecting`) must not count: they play whether or not a
   * device is there. */
  private sawDeviceEventThisBurst = false;

  /**
   * The step a UI-side runner authored (the authenticity flow's beats).
   * While one is on stage, the SDK's generic events must not demote it:
   * progress ticks and ButtonRequests are exactly what the authored card
   * is already narrating. Input asks (PIN, passphrase) still play — and
   * return here when answered, not to a generic processing beat.
   */
  private authoredAuthStep: IDeviceStageStepValue | undefined;

  private authHoldTimer: ReturnType<typeof setTimeout> | undefined;

  /** Bumped on every arm and every clear. The handover reads the atom
   * before it decides, so clearing the timer alone cannot stop a callback
   * already past its await — the generation can. */
  private authHoldSeq = 0;

  /** Bumped whenever something claims the stage (every claiming path
   * clears the exit timer first). A scheduled exit reads the atom before
   * it decides, so clearing the timer alone cannot stop a callback already
   * past its await — the generation can: the exit aborts when a claim came
   * in meanwhile, instead of hiding the stage that claim just painted. */
  private claimSeq = 0;

  /** Bumped when the person dismisses the stage, or the firmware workflow
   * takes the screen. An event that read the stage before that must not
   * write it back: its ask belongs to a call the person already left. */
  private dismissSeq = 0;

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
    this.claimSeq += 1;
  }

  private clearPendingOpen() {
    clearTimeout(this.openingTimer);
    this.openingTimer = undefined;
    this.pendingOpen = undefined;
  }

  private clearAuthHold() {
    clearTimeout(this.authHoldTimer);
    this.authHoldTimer = undefined;
    this.authHoldSeq += 1;
  }

  /**
   * Arms the ✓'s handover.
   *
   * Armed from `noteStep` only, never from `setStep`: a call end inside an
   * authored flow re-asserts the same step through `setStep` — three times
   * over during the firmware release check, one per call — and arming
   * there would push the hold out again every time, so it would never
   * expire.
   */
  private armAuthSuccessHold() {
    this.clearAuthHold();
    const seq = this.authHoldSeq;
    this.authHoldTimer = setTimeout(() => {
      void this.handoverFromAuthSuccess(seq);
    }, AUTH_SUCCESS_HOLD_MS);
  }

  /** The ✓ has been read: retire the narrative and land the stage on what
   * the burst is actually doing. */
  private async handoverFromAuthSuccess(seq: number) {
    if (this.authHoldSeq !== seq) {
      return;
    }
    this.authHoldTimer = undefined;
    const prev = await deviceStageAtom.get();
    // Re-checked after the await: a beat that landed meanwhile owns the
    // stage now, and it brought its own ending.
    if (this.authHoldSeq !== seq) {
      return;
    }
    // Never resurrect a stage that has left, and never overwrite whatever
    // replaced the ✓ — an ask, an error notice, a newer burst's opening.
    if (!prev || prev.step !== 'authSuccess') {
      return;
    }
    // Retiring the narrative is the point, not a side effect: from here a
    // call end falls through to the ordinary processing beat instead of
    // re-pinning the ✓ this handover just collapsed.
    this.authoredAuthStep = undefined;
    if (this.depth > 0) {
      await this.setStep('processing', { connectId: prev.connectId });
      return;
    }
    // No burst left to speak for — and noteStep dropped the pending exit
    // when it wrote the ✓. This is that burst's one exit.
    this.scheduleOff();
  }

  /**
   * Opens (or joins) a burst. Returns whether the stage is now behind the
   * caller: false while the firmware workflow silences it, and a caller
   * that paints beats past the gate (the air-gap pair) must take that answer,
   * not a gate read taken a moment earlier — a card painted with no burst
   * behind it has no exit, because end() finds nothing to close.
   */
  async begin(params: IDeviceStageBurstBeginParams = {}): Promise<boolean> {
    if (!(await this.isEnabled())) {
      return false;
    }
    const dismissal = this.dismissSeq;
    this.clearOffTimer();
    this.depth += 1;
    setDeviceStageBurstActive(true);
    if (params.confirmContent) {
      this.confirmContent = params.confirmContent;
    }
    if (this.depth === 1) {
      this.activeVendor = params.vendor;
      this.authoredAuthStep = undefined;
      // A fresh initiation makes its own presence finding — a device the
      // PREVIOUS burst heard from proves nothing about this one.
      this.sawDeviceEventThisBurst = false;
      // A new burst owns the stage; a nested wrapper joining mid-dwell
      // (depth >= 2) is not a new narrative and must not disarm it.
      this.clearAuthHold();
      const prev = await deviceStageAtom.get();
      const stillEnabled = await this.isEnabled();
      // Re-checked after the awaits: the firmware workflow can take the
      // stage meanwhile (or the person can close it) — its silence found no
      // pendingOpen to clear yet, so the opening timer below would have
      // painted connecting over the update page, and the caller would have
      // been told a burst it does not have is open. Roll this claim back.
      if (dismissal !== this.dismissSeq || !stillEnabled) {
        this.depth = Math.max(this.depth - 1, 0);
        if (this.depth === 0) {
          setDeviceStageBurstActive(false);
        }
        return false;
      }
      const stageStillOn = prev && prev.step !== 'off';
      // A follow-up wrapper inside the grace window rejoins the visible
      // stage: keep the burstId so the container's close grant stays armed.
      this.burstSeq = stageStillOn ? prev.burstId : this.burstSeq + 1;
      // The opening `connecting` beat is deferred a beat: a flow whose
      // first real step follows immediately (the genuine check) opens
      // straight into it, instead of flashing the connecting scene first.
      this.clearPendingOpen();
      this.pendingOpen = params;
      this.openingTimer = setTimeout(() => {
        const opening = this.pendingOpen;
        this.pendingOpen = undefined;
        this.openingTimer = undefined;
        if (!opening) {
          return;
        }
        void this.setStep('connecting', {
          connectId: opening.connectId,
          deviceType: opening.deviceType,
          deviceName: opening.deviceName,
          vendor: opening.vendor,
          vendorModel: opening.vendorModel,
          vendorModelName: opening.vendorModelName,
          resetOutcome: true,
        });
      }, OPENING_BEAT_DEFER_MS);
      return true;
    }
    // Joined a burst already on stage (typically a UI-held one): the flow
    // is mid-step, so only the device identity refreshes — the caller
    // often knows the device the holder could not name yet.
    if (params.vendor && !this.activeVendor) {
      this.activeVendor = params.vendor;
    }
    await this.mergeDeviceIdentity(params);
    return true;
  }

  /**
   * Opens a UI-held burst spanning a whole flow. Returns the token the
   * holder must present to close it.
   */
  async beginExplicit(
    params: IDeviceStageBurstBeginParams & { reuseToken?: number } = {},
  ) {
    // Still holding: nothing to open. Refresh who is on stage at most —
    // unless the hold was minted while the stage was silenced and never
    // opened; the flow resuming after the firmware page gets its stage now.
    if (
      params.reuseToken !== undefined &&
      params.reuseToken === this.explicitToken
    ) {
      if (!this.explicitOpened) {
        this.explicitOpened = await this.begin(params);
        return params.reuseToken;
      }
      await this.mergeDeviceIdentity(params);
      return params.reuseToken;
    }
    // A different holder is taking the flow over. The superseded holder's
    // layer has to leave WITH its token: endExplicit drops a stale token
    // without ending anything, so that layer would otherwise never be
    // released and the stage would stand until the person closed it. This
    // is the plain end-then-begin handoff the pages already perform
    // between flows — the end lands at depth 0 and schedules the exit,
    // the begin below cancels that timer and rejoins the visible burst.
    if (this.explicitToken !== undefined) {
      this.explicitToken = undefined;
      await this.end();
    }
    this.explicitSeq += 1;
    const token = this.explicitSeq;
    this.explicitToken = token;
    this.explicitOpened = await this.begin(params);
    return token;
  }

  /** Closes a UI-held burst. A stale token is ignored. */
  async endExplicit(params: { token: number; error?: unknown }) {
    if (this.explicitToken !== params.token) {
      return;
    }
    this.explicitToken = undefined;
    this.explicitOpened = false;
    await this.end({ error: params.error });
  }

  async end(params: { error?: unknown } = {}) {
    // Read, never returned on — the same reasoning that keeps the QR
    // beats off this gate: a burst already in flight must not lose its
    // bookkeeping because the gate closed under it. The firmware workflow
    // raises the flag FIRST and only then waits for the hardware work in
    // flight to drain, so a wrapper begun a moment earlier reaches its
    // end() inside that window; returning here left the depth standing
    // and the burst marked active forever, and no later burst could ever
    // reach its own exit again (only userClose healed it). What the gate
    // does own is the painting, held back below.
    const enabled = await this.isEnabled();
    // No burst to end: the flag flipped mid-flow, or the person already
    // closed the stage (userClose drops the depth). Either way there is
    // nothing to land — never resurrect a dismissed stage with an outcome.
    if (this.depth <= 0) {
      return;
    }
    // The person cancelling on the device ends the whole run, not one
    // call of it: without this, an outer hold keeps the stage up, the
    // close event walks it back to the flow's authored beat, and the
    // person watches a second exit play after the one they caused.
    if (
      params.error &&
      (isHardwareErrorByCode({
        error: params.error as any,
        code: SILENT_CANCEL_CODES,
      }) ||
        // A device-side cancel (ActionCancelled) during an authored
        // narrative is the person ending that run on the device — the
        // runner aborts, so nothing is left to land. Outside a narrative
        // the same code is a call outcome and stays the 'rejected' notice.
        (this.authoredAuthStep &&
          isHardwareErrorByCode({
            error: params.error as any,
            code: HardwareErrorCode.ActionCancelled,
          })))
    ) {
      await this.userClose();
      return;
    }
    this.depth = Math.max(this.depth - 1, 0);
    if (this.depth > 0) {
      return;
    }
    // The last layer is landing: any DeviceNotFound built after this
    // belongs to the legacy dialog again.
    setDeviceStageBurstActive(false);
    this.confirmContent = undefined;
    // A ✓ still resting when the last burst layer ends keeps its own
    // exit: the armed handover retires the narrative at full rest and
    // schedules this burst's off itself once depth is 0. Ending over it
    // would trim the rest down to the grace window. Silenced, there is no
    // rest left to protect — the release below takes the hold with it.
    if (
      enabled &&
      !params.error &&
      this.authoredAuthStep === 'authSuccess' &&
      this.authHoldTimer
    ) {
      this.clearPendingOpen();
      this.activeVendor = undefined;
      return;
    }
    this.authoredAuthStep = undefined;
    // The burst's own exit owns the beat from here.
    this.clearAuthHold();
    // Kept for the probe below: a burst that failed inside its opening
    // beat never painted, so the stage never learned the device — but
    // the opening knew it all along.
    const openingConnectId = this.pendingOpen?.connectId;
    this.clearPendingOpen();
    const wasVendorBurst = Boolean(this.activeVendor);
    this.activeVendor = undefined;
    // The burst is released; from here on it is only the stage speaking,
    // and while the firmware page runs the stage is not the surface — so
    // whatever this burst had painted leaves with it. The workflow raises
    // its flag and only then waits for the work in flight to drain, so a
    // wrapper begun a moment earlier reaches this end inside that window:
    // returning without the exit left its connecting / processing capsule
    // standing over the update page, behind the touch wall.
    if (!enabled) {
      await this.forceOff({ force: true });
      return;
    }
    const error = params.error as
      | IOneKeyError<IOneKeyErrorI18nInfo>
      | undefined;
    if (
      isHardwareErrorByCode({ error, code: DEDICATED_DIALOG_ERROR_CODES }) ||
      (error?.payload?.connectId &&
        isHardwareErrorByCode({
          error,
          code: HardwareErrorCode.NotAllowInBootloaderMode,
        }))
    ) {
      await this.forceOff({ force: true });
      return;
    }
    // A failure the hardware layer never claimed — a keyring or vault
    // OneKeyLocalError riding out through the very same finally — is not
    // this stage's news to land. The toast suppression only covers
    // hardware errors, so the person would read the same internal English
    // sentence twice, once on the card and once in the toast that still
    // fires; and the probe below would hold the caller ~500ms longer to
    // ask a device that never failed whether it is still there. The burst
    // still closes, only the outcome stays out.
    if (params.error && !isOneKeyHardwareError(params.error)) {
      this.scheduleOff();
      return;
    }
    let reason = params.error ? this.mapErrorToReason(params.error) : undefined;
    // DeviceNotFound splits by whether this burst ever heard from the
    // device (see resolveDeviceNotFoundLanding). The at-initiation half
    // lands the Device-not-connected card and is done — synchronously,
    // like the mapped disconnect below, so no stale-landing window opens.
    if (reason === 'notFound') {
      if (
        resolveDeviceNotFoundLanding({
          wasVendorBurst,
          sawDeviceEventThisBurst: this.sawDeviceEventThisBurst,
        }) === 'deviceNotFound'
      ) {
        await this.setStep('deviceNotFound', {});
        return;
      }
      reason = 'disconnected';
    }
    // A dying transport rarely reports a mapped disconnect code — each
    // protocol fails with its own string (V2 transferIn errors, V1 retry
    // exhaustion, bridge messages) — so a generic outcome on a device
    // that is no longer reachable is really a disconnect. Third-party
    // bursts stay out: the probe only knows OneKey transports.
    if (
      reason === 'generic' &&
      !wasVendorBurst &&
      // These failures identify the cause even when the transport tracker
      // has already cleared the connection (for example USB blocking BLE).
      !isHardwareErrorByCode({
        error,
        code: [
          HardwareErrorCode.BleUnavailableWhileUsbConnected,
          HardwareErrorCode.DeviceCheckUnlockTypeError,
          HardwareErrorCode.DeviceCheckPassphraseStateError,
          HardwareErrorCode.DeviceCheckDeviceIdError,
          ECustomOneKeyHardwareError.NeedFirmwareUpgradeFromWeb,
        ],
      }) &&
      this.isDeviceStillConnected
    ) {
      const stateAtLanding = await deviceStageAtom.get();
      const connectId = pickIdentityText(
        stateAtLanding?.connectId,
        openingConnectId,
      );
      if (connectId) {
        let stillConnected: boolean | undefined;
        // DEVICE.DISCONNECT can land a beat after the failed call's
        // finally (it lost by ~200ms in the desktop unplug repro), so
        // give the tracker a bounded window to catch up before trusting
        // a `true`.
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (attempt > 0) {
            await timerUtils.wait(250);
          }
          try {
            stillConnected = await this.isDeviceStillConnected(connectId);
          } catch {
            // Probe failure keeps the generic outcome.
            break;
          }
          if (stillConnected === false) {
            break;
          }
        }
        if (stillConnected === false) {
          reason = 'disconnected';
        }
      }
      // This branch awaited (up to ~500ms): a new burst may have claimed
      // the stage (depth grew), or the person may have closed it (step
      // walked to 'off' during the window). Landing the stale outcome
      // would pin it over the live flow or resurrect a dismissed stage —
      // leave it to its owner. An error landing on a stage that never
      // painted (still 'off' from before the window) stays legitimate.
      if (this.depth > 0) {
        return;
      }
      if (
        stateAtLanding?.step !== 'off' &&
        (await deviceStageAtom.get())?.step === 'off'
      ) {
        return;
      }
    }
    if (
      reason === 'generic' &&
      isHardwareErrorByCode({
        error,
        code: [
          ECustomOneKeyHardwareError.NeedFirmwareUpgradeFromWeb,
          ECustomOneKeyHardwareError.UnknownHardwareError,
        ],
      })
    ) {
      // The existing toast carries a firmware-update action. The outermost
      // burst owns this handoff; normal auto-toasts stay suppressed so nested
      // calls and cross-runtime copies cannot show it before the stage exits.
      const claim = this.claimSeq;
      await this.forceOff({ force: true });
      if (claim !== this.claimSeq) {
        return;
      }
      errorToastUtils.showToastOfError({
        ...toPlainErrorObject(error),
        autoToast: true,
      });
      return;
    }
    if (error && reason !== 'silent') {
      await this.setStep('error', {
        errorReason: reason === 'generic' ? undefined : reason,
        // Only where no reason claims the failure. A mapped reason's
        // words are the considered ones — the disconnect notice above
        // all, which exists precisely because the raw message was
        // unreadable — so they are never overwritten.
        errorMessage:
          reason === 'generic' ? pickErrorMessage(params.error) : undefined,
        errorI18n:
          reason === 'generic' && error.key
            ? { key: error.key, info: error.info }
            : undefined,
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
    askCompleted,
  }: {
    action: string;
    connectId?: string;
    payload?: IHardwareUiPayload;
    shouldClearUiState?: boolean;
    /** This event ends an ask the person answered on the device. The
     * pipeline renders it as plain progress, and a progress tick may not
     * write over an ask — so without the flag the answered card stands
     * until something else happens to speak. */
    askCompleted?: boolean;
  }) {
    const dismissal = this.dismissSeq;
    if (!(await this.isEnabled())) {
      return;
    }
    const current = await deviceStageAtom.get();
    // The person closed the stage (or the firmware page took it) while
    // this event was reading: the ask it carries belongs to the call they
    // just left. Writing it would reopen a stage no burst stands behind —
    // one nothing but a second close could end.
    if (dismissal !== this.dismissSeq) {
      return;
    }
    const outcomeOnStage = Boolean(current && OUTCOME_STEPS.has(current.step));
    // The air-gap pair owns the stage while it stands (doc §4.6). No
    // hd-core traffic belongs to it — an air-gapped flow never touches
    // the SDK — so every event here is a bystander's: background
    // housekeeping (an XFP backfill, a features poll) whose call-end
    // close would stomp the code card into a wait with no way back
    // (qrShowCode plays once per session), stranding the pending scan.
    if (current && QR_STEPS.has(current.step)) {
      return;
    }
    const isCloseEvent =
      shouldClearUiState ||
      action === EHardwareUiStateAction.CLOSE_UI_WINDOW ||
      // Demo only: the event pipeline rewrites a real PIN-window close
      // into progress carrying `askCompleted`, so this branch never sees
      // one from a device. The gallery feeds the raw action.
      action === EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW;
    if (isCloseEvent) {
      if (outcomeOnStage) {
        // The call that landed this outcome is winding down — its own end
        // is not news, and must not replace the reason it failed with a
        // wait the person can make nothing of.
        return;
      }
      if (this.authoredAuthStep) {
        // A call ended inside an authored flow: the runner narrates what
        // comes next, the stage stays on its beat meanwhile.
        const isFailure = this.authoredAuthStep === 'authFailure';
        await this.setStep(this.authoredAuthStep, {
          connectId,
          // The re-assert carries no extras of its own, and a step keeps
          // only what it declares — so without this the first call end
          // after a failure blanks the reason, the card falls back to the
          // generic one, and a verdict that may only be taken to Support
          // grows a "continue anyway" button it must never offer.
          authFailureReason: isFailure ? current?.authFailureReason : undefined,
          authFailureMessage: isFailure
            ? current?.authFailureMessage
            : undefined,
          authFailureCode: isFailure ? current?.authFailureCode : undefined,
        });
        return;
      }
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
    // An owned, non-close SDK event is the device speaking — the initial
    // search failing emits nothing, so this is the presence proof
    // resolveDeviceNotFoundLanding reads. Recorded before the repaint
    // gates below: whether the event wins the stage is beside the point.
    this.sawDeviceEventThisBurst = true;
    if (outcomeOnStage && !ASK_STEPS.has(step)) {
      return;
    }
    if (
      this.authoredAuthStep &&
      (step === 'processing' || step === 'confirm' || step === 'connecting')
    ) {
      // Progress ticks and the device's ButtonRequest during an authored
      // flow ARE the authored card's own story ("confirm on your device
      // to verify…") — never a step of their own.
      //
      // A ButtonRequest is still news, though: the device asks for the
      // next thing only once the ask that played over the narrative was
      // answered, and on-device entry is announced no other way — there
      // is no close event between the PIN and the request that follows
      // it. Resume the narrative there, or the answered PIN card stands
      // on stage while the device waits for a confirmation the person
      // was never told about.
      if (
        (step === 'confirm' || askCompleted) &&
        current &&
        current.step !== 'off' &&
        current.step !== this.authoredAuthStep
      ) {
        await this.setStep(this.authoredAuthStep, { connectId });
      }
      return;
    }
    if (step === 'processing' && !askCompleted) {
      // A progress-flavored event only refreshes a wait that is already
      // on stage. Any ask (confirm, PIN, passphrase, the teach card…)
      // outranks it — the trailing BLE tick behind a ButtonRequest must
      // not repaint the ask the device is still making. The one tick that
      // IS news carries `askCompleted` and is exempt above.
      if (
        current &&
        current.step !== 'off' &&
        !PROGRESS_WRITABLE_STEPS.has(current.step)
      ) {
        return;
      }
    }
    this.clearOffTimer();
    if (step === 'passphraseOnApp') {
      // Which passphrase this is decides the shape of the ask. The SDK
      // names the wallet it wants recovered (V1 `passphraseState`, V2
      // `expectedPassphraseState`) — that is an unlock. Neither means the
      // device is opening a wallet that does not exist yet: a creation,
      // which plays as the Add-hidden-wallet entry form.
      //
      // Never the teach card from here: education happens BEFORE the
      // device is touched (v6.5.2's order) — the account selector puts
      // the intro on stage itself via showPassphraseIntro and only then
      // starts the hardware flow, so by the time this ask arrives the
      // teaching is done and the entry is all that is left. Onboarding's
      // fork deliberately teaches nothing.
      const isCreate =
        !payload?.passphraseState && !payload?.expectedPassphraseState;
      await this.setStep('passphraseOnApp', {
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

  /** The teach card was read. The intro plays BEFORE the device flow
   * starts (the account selector primes it, then Continue kicks off the
   * hardware call), so there is no ask to answer yet — the stage waits,
   * and the flow's own beats (connecting, the real entry ask) take over
   * from here. */
  async notePassphraseIntroDone() {
    if (!(await this.isEnabled())) {
      return;
    }
    const prev = await deviceStageAtom.get();
    if (prev?.step !== 'passphraseIntro') {
      return;
    }
    this.clearOffTimer();
    await this.setStep('processing', { passphraseMode: 'create' });
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
    const dismissal = this.dismissSeq;
    if (!(await this.isEnabled())) {
      return;
    }
    // Same rule as the SDK events: a state read before the person closed
    // the stage is not news any more.
    if (dismissal !== this.dismissSeq) {
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
    if (dismissal !== this.dismissSeq) {
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
      deviceType?: IDeviceStageState['deviceType'];
      deviceName?: string;
      payload?: IHardwareUiPayload;
      confirmDetails?: IDeviceStageState['confirmDetails'];
      confirmMessage?: string;
      confirmDescription?: string;
      confirmDescriptionDanger?: boolean;
      inputError?: string;
      errorReason?: IDeviceStageErrorReasonValue;
      errorMessage?: string;
      errorI18n?: IDeviceStageState['errorI18n'];
      authChecklist?: IDeviceStageState['authChecklist'];
      authFailureReason?: IDeviceStageState['authFailureReason'];
      authFailureMessage?: string;
      authFailureCode?: string;
      passphraseMode?: IDeviceStageState['passphraseMode'];
    } = {},
  ) {
    if (!(await this.isEnabled())) {
      return;
    }
    if (PROGRESS_WRITABLE_STEPS.has(step)) {
      // An app-authored wait obeys the rule an SDK progress tick obeys
      // (see onHardwareUiEvent): it may refresh a wait, never repaint an
      // ask. The checking / loading notes are detached — `void`ed by the
      // show* methods, a bridge hop or two behind — so a fast device's
      // REQUEST_PIN can land first; letting the late wait through took the
      // PIN card down while the device still waited for its PIN.
      const current = await deviceStageAtom.get();
      if (current && ASK_STEPS.has(current.step)) {
        return;
      }
    }
    this.clearOffTimer();
    // Any newer beat cancels a pending handover: a Retry's authFailure,
    // an error notice, the loading beat a flow shows next.
    this.clearAuthHold();
    // An ask plays OVER a narrative rather than ending it — the app-side
    // PIN handing itself to the device (`sendEnterPinOnDeviceEvent`) is
    // one, and forgetting there leaves the ButtonRequest that follows
    // with no beat to come back to. Only another authored beat re-aims
    // the narrative; anything else ends it.
    if (AUTH_STEPS.has(step)) {
      this.authoredAuthStep = step;
    } else if (!ASK_STEPS.has(step)) {
      this.authoredAuthStep = undefined;
    }
    // The ✓ is the authored run's last word — nothing downstream is
    // scheduled to move the stage off it. Armed before the write, so a
    // second note interleaving at the await disarms this one rather than
    // leaving a stale hold behind a newer beat.
    if (step === 'authSuccess') {
      this.armAuthSuccessHold();
    }
    await this.setStep(step, extras);
  }

  /** Retire the skipped failure immediately, without releasing the outer
   * flow's burst or cancelling its next hardware interaction. */
  async noteAuthNarrativeResolved() {
    const seq = this.authHoldSeq;
    if (!(await this.isEnabled())) {
      return;
    }
    const current = await deviceStageAtom.get();
    // A newer beat owns its own exit, even if it is another auth failure.
    if (seq !== this.authHoldSeq || current?.step !== 'authFailure') {
      return;
    }
    this.authoredAuthStep = undefined;
    this.clearAuthHold();
    await this.forceOff({ force: true });
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
    await this.setStep(this.authoredAuthStep ?? 'processing', {});
  }

  /**
   * The air-gap track's beats (doc §4.6), fed by ServiceQrWallet — the
   * one bg exit every two-way scan goes through. Unlike the SDK tracks
   * there is no event stream to translate: the flow is promise-driven,
   * the request UR is born in bg, and the person's Next/Back on the card
   * walk the pair by these methods.
   *
   * Deliberately NOT gated on isEnabled(): a QR session only starts
   * through a bracket that checked the gate (ServiceQrWallet falls back
   * to the legacy toast when the stage is silenced), and gating the
   * beats individually would strand a session mid-flight if the firmware
   * flag flipped under it.
   *
   * No deviceName ever rides in — an offline device has no connection to
   * name, and the QR steps must not wear a badge (doc hard rule).
   */
  async qrShowCode({
    valueUr,
    sessionId,
  }: {
    valueUr: IAirGapUrJson;
    /** The session's tag, echoed back by the viewfinder's submit — a
     * stale frame must never answer a newer request (see ServiceQrWallet
     * stageAirGapSession). */
    sessionId: number;
  }) {
    this.clearOffTimer();
    await this.setStep('showQr', {
      qrValueUr: valueUr,
      qrSessionId: sessionId,
    });
  }

  /** The person watched the device show its answer code and pressed
   * Next: on to the camera. A stale press (the stage already left the
   * pair) moves nothing. */
  async qrProceedToScan() {
    const prev = await deviceStageAtom.get();
    if (prev?.step !== 'showQr') {
      return;
    }
    this.clearOffTimer();
    await this.setStep('scanQr', {});
  }

  /** The escape hatch for a premature handoff: back to presenting the
   * code — the carried UR re-presents itself. Never a reject (the legacy
   * container's skipReject, in stage form). */
  async qrBackToShow() {
    const prev = await deviceStageAtom.get();
    if (prev?.step !== 'scanQr') {
      return;
    }
    this.clearOffTimer();
    await this.setStep('showQr', {});
  }

  /** The scan is in: the bg flow decodes and carries on, so the stage
   * settles into the wait — the burst's own end lands the exit. */
  async qrNoteScanCompleted() {
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
    this.clearPendingOpen();
    this.dismissSeq += 1;
    this.depth = 0;
    setDeviceStageBurstActive(false);
    this.explicitToken = undefined;
    this.explicitOpened = false;
    this.confirmContent = undefined;
    this.activeVendor = undefined;
    this.authoredAuthStep = undefined;
    this.sawDeviceEventThisBurst = false;
    // The person's own exit wins outright.
    this.clearAuthHold();
    await this.forceOff({ force: true });
  }

  /** The firmware workflow is taking the screen (it drives its own full
   * page, outside the stage's scope): whatever the stage shows leaves
   * now, not at the end of the call that painted it. The burst's own
   * bookkeeping is untouched — its end() still releases the layer, and
   * finds nothing left to take down. */
  async silenceForFirmwareWorkflow() {
    this.clearOffTimer();
    this.clearPendingOpen();
    this.dismissSeq += 1;
    await this.forceOff({ force: true });
  }

  /** A flow abandoned before any burst began — the checking beat a connect
   * painted, then a bootloader hand-off or a failed connect — has nothing
   * to land its exit: no burst, so no end(). The legacy checking dialog is
   * cleared by cleanHardwareUiState at those sites; this is the stage's
   * half, and deliberately NOT part of that method: withHardwareProcessing
   * clears the legacy state right before its begin(), and taking the stage
   * down there would flash the connecting scene off and on at exactly the
   * seam the stage exists to smooth. Never touches a stage a burst owns
   * (its own end lands the exit), nor an outcome (it owns its exit). */
  async dismissUnowned() {
    if (this.depth > 0) {
      return;
    }
    this.clearPendingOpen();
    await this.forceOff();
  }

  /** Refreshes who is on stage without touching the step or the beat —
   * the device often becomes known after the stage is already up. */
  async mergeDeviceIdentity(params: IDeviceStageBurstBeginParams) {
    if (this.pendingOpen) {
      this.pendingOpen = {
        ...this.pendingOpen,
        connectId: pickIdentityText(
          params.connectId,
          this.pendingOpen.connectId,
        ),
        deviceType: params.deviceType ?? this.pendingOpen.deviceType,
        deviceName: pickIdentityText(
          params.deviceName,
          this.pendingOpen.deviceName,
        ),
        vendor: params.vendor ?? this.pendingOpen.vendor,
        vendorModel: pickIdentityText(
          params.vendorModel,
          this.pendingOpen.vendorModel,
        ),
        vendorModelName: pickIdentityText(
          params.vendorModelName,
          this.pendingOpen.vendorModelName,
        ),
      };
      return;
    }
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
        connectId: pickIdentityText(params.connectId, prev.connectId),
        deviceType: pickDeviceType(params.deviceType, prev.deviceType),
        deviceName: pickIdentityText(params.deviceName, prev.deviceName),
        vendor: params.vendor ?? prev.vendor,
        vendorModel: pickIdentityText(params.vendorModel, prev.vendorModel),
        vendorModelName: pickIdentityText(
          params.vendorModelName,
          prev.vendorModelName,
        ),
      };
    });
  }

  private scheduleOff(delayMs: number = OFF_GRACE_MS) {
    this.clearOffTimer();
    this.offTimer = setTimeout(() => {
      void this.forceOff();
    }, delayMs);
  }

  private async forceOff(options: { force?: boolean } = {}) {
    const claim = this.claimSeq;
    const prev = await deviceStageAtom.get();
    // Re-checked after the await: a burst that claimed the stage while
    // this exit was reading — the follow-up inside the grace window, a
    // teach card, an ask — owns it now, and this exit was the previous
    // occupant's. Writing off here hid the stage that burst had just
    // painted while its device call ran on without a PIN or confirm
    // surface.
    if (claim !== this.claimSeq || (!options.force && this.depth > 0)) {
      return;
    }
    if (!prev || prev.step === 'off') {
      return;
    }
    // An error outcome owns its own exit: the notice form leaves through
    // onClose after its readable hold, the ask form waits for the person.
    // The Device-not-connected card waits the same way. A scheduled off
    // (burst end racing in behind the outcome) must not cut either short;
    // only the user's dismissal forces through.
    if (
      (prev.step === 'error' || prev.step === 'deviceNotFound') &&
      !options.force
    ) {
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
      errorMessage?: string;
      errorI18n?: IDeviceStageState['errorI18n'];
      confirmDetails?: IDeviceStageState['confirmDetails'];
      confirmMessage?: string;
      confirmDescription?: string;
      confirmDescriptionDanger?: boolean;
      inputError?: string;
      passphraseMode?: IDeviceStageState['passphraseMode'];
      authChecklist?: IDeviceStageState['authChecklist'];
      authFailureReason?: IDeviceStageState['authFailureReason'];
      authFailureMessage?: string;
      authFailureCode?: string;
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
      qrValueUr?: IDeviceStageState['qrValueUr'];
      qrSessionId?: number;
      resetOutcome?: boolean;
    },
  ) {
    // A deferred opening beat is consumed by the first real step: its
    // device identity rides in here and `connecting` never paints.
    const opening = this.pendingOpen;
    let mergedExtras = extras;
    if (opening) {
      this.clearPendingOpen();
      mergedExtras = {
        ...extras,
        connectId: pickIdentityText(extras.connectId, opening.connectId),
        deviceType: extras.deviceType ?? opening.deviceType,
        deviceName: pickIdentityText(extras.deviceName, opening.deviceName),
        vendor: extras.vendor ?? opening.vendor,
        vendorModel: pickIdentityText(extras.vendorModel, opening.vendorModel),
        vendorModelName: pickIdentityText(
          extras.vendorModelName,
          opening.vendorModelName,
        ),
        resetOutcome: true,
      };
    }
    // Confirm payload priority: explicit extras (demo / special flows) >
    // the burst's registered content (the confirm channel) > what the
    // step already showed (repeat confirms of the same call).
    const registered = step === 'confirm' ? this.confirmContent : undefined;
    const hasExplicitConfirm = Boolean(
      mergedExtras.confirmDetails ||
      mergedExtras.confirmMessage ||
      mergedExtras.confirmDescription,
    );
    await deviceStageAtom.set((prev): IDeviceStageState => {
      const base = mergedExtras.resetOutcome ? undefined : prev;
      const pickConfirm = <T>(
        explicit: T | undefined,
        fromRegistration: T | undefined,
        carried: T | undefined,
      ): T | undefined => {
        if (CONFIRM_PAYLOAD_HIDDEN || step !== 'confirm') {
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
        connectId: pickIdentityText(mergedExtras.connectId, base?.connectId),
        deviceType: pickDeviceType(mergedExtras.deviceType, base?.deviceType),
        deviceName: pickIdentityText(mergedExtras.deviceName, base?.deviceName),
        // Device/vendor identity is sticky within the burst (base), never
        // across bursts; the per-step extras (install / btc / action)
        // never outlive their own step.
        vendor: mergedExtras.vendor ?? base?.vendor,
        vendorModel: pickIdentityText(
          mergedExtras.vendorModel,
          base?.vendorModel,
        ),
        vendorModelName: pickIdentityText(
          mergedExtras.vendorModelName,
          base?.vendorModelName,
        ),
        thirdPartyAction: mergedExtras.thirdPartyAction,
        appName: mergedExtras.appName,
        installProgress: mergedExtras.installProgress,
        installQueue: mergedExtras.installQueue,
        installActiveIndex: mergedExtras.installActiveIndex,
        btcHighIndexPath: mergedExtras.btcHighIndexPath,
        btcHighIndexAccountIndex: mergedExtras.btcHighIndexAccountIndex,
        // The checklist survives the whole authenticity run (the ask, the
        // wait, the landing, the unofficial-firmware failure card).
        authChecklist: AUTH_STEPS.has(step)
          ? (mergedExtras.authChecklist ?? base?.authChecklist)
          : undefined,
        authFailureReason:
          step === 'authFailure' ? mergedExtras.authFailureReason : undefined,
        authFailureMessage:
          step === 'authFailure' ? mergedExtras.authFailureMessage : undefined,
        authFailureCode:
          step === 'authFailure' ? mergedExtras.authFailureCode : undefined,
        errorReason: step === 'error' ? mergedExtras.errorReason : undefined,
        errorMessage: step === 'error' ? mergedExtras.errorMessage : undefined,
        errorI18n: step === 'error' ? mergedExtras.errorI18n : undefined,
        qrValueUr: pickQrScoped(step, mergedExtras.qrValueUr, base?.qrValueUr),
        qrSessionId: pickQrScoped(
          step,
          mergedExtras.qrSessionId,
          base?.qrSessionId,
        ),
        inputError: mergedExtras.inputError,
        passphraseMode: mergedExtras.passphraseMode ?? base?.passphraseMode,
        confirmDetails: pickConfirm(
          mergedExtras.confirmDetails,
          registered?.details,
          base?.confirmDetails,
        ),
        confirmMessage: pickConfirm(
          mergedExtras.confirmMessage,
          registered?.message,
          base?.confirmMessage,
        ),
        confirmDescription: pickConfirm(
          mergedExtras.confirmDescription,
          registered?.description,
          base?.confirmDescription,
        ),
        confirmDescriptionDanger: pickConfirm(
          mergedExtras.confirmDescriptionDanger,
          registered?.descriptionDanger,
          base?.confirmDescriptionDanger,
        ),
        confirmCount:
          // eslint-disable-next-line no-nested-ternary
          CONFIRM_PAYLOAD_HIDDEN || step !== 'confirm'
            ? undefined
            : registered
              ? registered.count
              : base?.confirmCount,
        payload: mergedExtras.payload ?? base?.payload,
      };
    });
  }

  private mapErrorToReason(
    error: unknown,
  ): IDeviceStageErrorReasonValue | 'silent' | 'generic' | 'notFound' {
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
      isHardwareErrorByCode({
        error: error as any,
        code: HardwareErrorCode.DeviceNotFound,
      })
    ) {
      // Not a reason of its own — end() resolves it into the
      // Device-not-connected card or the disconnect notice by whether
      // this burst ever heard from the device.
      return 'notFound';
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

/**
 * Runs `run` for the latest state only: a trigger while a run is in
 * flight marks one rerun, never a concurrent one. The third-party atoms
 * fire three subscriptions per call boundary (ui, install, batch), each
 * reading all three atoms — run concurrently, a stale prompt read could
 * land after the clear that followed it and paint over the done / error
 * beat the wrapper had just landed. The rerun re-reads everything, so
 * whatever the last trigger meant is what the stage ends up showing.
 */
export function createLatestStateFeed(run: () => Promise<void>) {
  let inFlight = false;
  let rerun = false;
  const pump = async () => {
    if (inFlight) {
      rerun = true;
      return;
    }
    inFlight = true;
    try {
      do {
        rerun = false;
        try {
          await run();
        } catch {
          // A failed read is not worth a retry of its own: the next
          // trigger reads all three atoms afresh.
        }
      } while (rerun);
    } finally {
      inFlight = false;
    }
  };
  return () => {
    void pump();
  };
}
