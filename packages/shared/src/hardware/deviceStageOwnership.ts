import { EHardwareUiStateAction } from '../../types/hardwareUi';

import type { IDeviceStageStepValue } from '../../types/deviceStage';

/**
 * Which hardware UI actions the DeviceStage plays (OK-59934).
 *
 * The stage replaced the popup surfaces for these; everything else still
 * belongs to the legacy container, and both sides read this one table so
 * an action can never be shown twice or by nobody.
 */
const STAGE_OWNED_ACTIONS: ReadonlySet<string> = new Set([
  EHardwareUiStateAction.DeviceChecking,
  EHardwareUiStateAction.ProcessLoading,
  EHardwareUiStateAction.DEVICE_PROGRESS,
  EHardwareUiStateAction.EnterPinOnDevice,
  EHardwareUiStateAction.REQUEST_PIN,
  EHardwareUiStateAction.REQUEST_BUTTON,
  EHardwareUiStateAction.REQUEST_PASSPHRASE,
  EHardwareUiStateAction.REQUEST_PASSPHRASE_ON_DEVICE,
]);

export function isDeviceStageOwnedHardwareUiAction({
  action,
  eventType,
  firmwareUpdateRunning,
}: {
  action: string | undefined;
  eventType?: string;
  /** The firmware update page owns its own surfaces start to finish — the
   * stage stands down for the whole workflow (handover doc §01). */
  firmwareUpdateRunning?: boolean;
}): boolean {
  if (!action || firmwareUpdateRunning) {
    return false;
  }
  // Bluetooth pairing rides in on DeviceChecking, but it is a system
  // pairing prompt, explicitly outside the stage's scope.
  if (eventType === EHardwareUiStateAction.BLUETOOTH_DEVICE_PAIRING) {
    return false;
  }
  return STAGE_OWNED_ACTIONS.has(action);
}

/**
 * Whether a DeviceStage burst currently owns the hardware flow. Set by the
 * burst scope in kit-bg; read where kit-bg cannot be imported — the
 * DeviceNotFound error emits its legacy dialog event from its own
 * constructor, before the failed call ever returns to the burst wrapper.
 * Module state is per-runtime, which is exactly right: the burst scope and
 * every DeviceNotFound construction live in the background runtime.
 */
let deviceStageBurstActive = false;

export function setDeviceStageBurstActive(active: boolean): void {
  deviceStageBurstActive = active;
}

/**
 * Whether the DeviceNotFound constructor should emit the legacy
 * "Device not connected" dialog event. While a burst is active the stage
 * lands the failure itself (the deviceNotFound outcome), and the UI-side
 * `stageIsShowing` gate cannot cover that case — an at-initiation failure
 * outruns the stage's deferred opening beat, so the event has to stand
 * down at the source. With no burst the legacy dialog remains the only
 * surface (bare calls, the firmware workflow) and the emit proceeds.
 */
export function shouldEmitDeviceNotFoundDialogEvent({
  silentMode,
}: {
  silentMode?: boolean;
}): boolean {
  return !silentMode && !deviceStageBurstActive;
}

/**
 * Whether the legacy container should still raise its hardware-error
 * dialog. One failure, one surface: when the stage is on it lands the
 * failure itself as its error outcome, but plenty of hardware work never
 * opens a stage burst at all — device search, the firmware update
 * workflow, calls outside any wrapper — and those failures would go
 * unseen if this dialog stood down unconditionally.
 */
export function shouldLegacyContainerRaiseHardwareErrorDialog({
  errorType,
  stageIsShowing,
}: {
  errorType: string | undefined;
  stageIsShowing: boolean;
}): boolean {
  if (errorType !== 'DeviceNotFound') {
    return false;
  }
  return !stageIsShowing;
}

/**
 * Whether the legacy popup surfaces the DeviceStage replaced are still in
 * play.
 *
 * They are switched off rather than deleted for the duration of this
 * integration: the code that used to drive them stays compiled,
 * type-checked and reviewable next to what replaced it, and flipping this
 * one function brings the old behavior back in a single step while the
 * replacement is still being proven on real devices. The cleanup pass
 * after the PR lands removes this switch and everything behind it.
 */
export function isLegacyHardwareUiActive(): boolean {
  return false;
}

/**
 * The exit policy (design hard rule #3, 2026-09-05 revision): who the
 * stage is waiting on decides when the person may leave.
 *
 * - Waiting on the PERSON (an ask card, the third-party "do this on the
 *   device" beats): every exit — the close button, the drag, Escape,
 *   Android back — opens once the stage has settled for
 *   DEVICE_STAGE_EXIT_SETTLE_MS after appearing, and stays open for the
 *   rest of that appearance. The device side can always refuse, so a
 *   later app-side exit protects nothing; the settle only absorbs a
 *   double tap, a repeated key or a back press carried in from the
 *   screen before.
 * - Waiting on the MACHINE (the capsule waits, an app install): the
 *   close button appears only once THIS wait has stalled — the device
 *   silent for DEVICE_STAGE_WAIT_STALL_MS (the legacy dialogs' own rule:
 *   their timer restarted with every call) or, whatever the chatter, the
 *   wait past DEVICE_STAGE_WAIT_CAP_MS (see resolveDeviceStageWaitStall).
 *   A wait is one stretch on one wait step: moving to another wait step
 *   starts the next, clocks and stall alike. A busy wait shows nothing to tap, so a
 *   "processing" pill can never be dismissed like a toast. Escape and
 *   back stay on the settle clock while nothing the person did is in
 *   flight (connecting, searching); after they answered a card (the
 *   processing that follows a confirm, a PIN, an install confirm) the
 *   keys follow the stall clock too — a habitual back press right after
 *   confirming on the device must not throw that confirmation away.
 * - Nothing in flight on the device (outcomes, decisions, the teach
 *   card, the authenticity run, the air-gap QR pair — that device is
 *   offline by design): every exit at once.
 * - The ✓ done beat leaves by itself and cannot be closed.
 */
export const DEVICE_STAGE_EXIT_SETTLE_MS = 1000;
export const DEVICE_STAGE_WAIT_STALL_MS = 10_000;
export const DEVICE_STAGE_WAIT_CAP_MS = 30_000;

/** Whether a machine wait has stalled (device silent past the idle time,
 * or the wait past its cap whatever the chatter), and `dueInMs` until the
 * earlier of those two deadlines — 0 once stalled. */
export function resolveDeviceStageWaitStall({
  now,
  waitStartedAt,
  lastActivityAt,
}: {
  now: number;
  waitStartedAt: number;
  lastActivityAt: number;
}): { stalled: boolean; dueInMs: number } {
  const due = Math.min(
    lastActivityAt + DEVICE_STAGE_WAIT_STALL_MS,
    waitStartedAt + DEVICE_STAGE_WAIT_CAP_MS,
  );
  return { stalled: now >= due, dueInMs: Math.max(0, due - now) };
}

type IDeviceStageExitClass = 'never' | 'immediate' | 'stall' | 'settle';

interface IDeviceStageExitRule {
  /** never: cannot be closed; immediate: every exit at once; stall: the
   * close waits for the machine wait to stall; settle: every exit once
   * the stage has settled after appearing. */
  exit: IDeviceStageExitClass;
  /** Leaving this step means the person answered something — the wait
   * that follows carries work they already did. */
  answered: boolean;
  /** A user close here leaves a device call to cancel. */
  cancelsDevice: boolean;
}

const rule = (
  exit: IDeviceStageExitClass,
  answered = false,
  cancelsDevice = true,
): IDeviceStageExitRule => ({ exit, answered, cancelsDevice });

/** Every step's exit rule — a Record, so a step added to the vocabulary
 * cannot fall through to a default it was never given. */
const EXIT_RULE: Record<IDeviceStageStepValue, IDeviceStageExitRule> = {
  off: rule('never', false, false),
  connecting: rule('stall'),
  enterPin: rule('settle', true),
  pinOnApp: rule('settle', true),
  selectWalletType: rule('immediate', true, false),
  // Continue on the teach card is an answer: the hidden-wallet call that
  // follows carries it, so a stray Esc/back must not cancel that call.
  passphraseIntro: rule('immediate', true, false),
  enterPassphrase: rule('settle', true),
  passphraseOnApp: rule('settle', true),
  showQr: rule('immediate', true, false),
  scanQr: rule('immediate', true, false),
  confirm: rule('settle', true),
  genuineCheck: rule('immediate'),
  authVerifying: rule('immediate'),
  authSuccess: rule('immediate'),
  authFailure: rule('immediate'),
  processing: rule('stall'),
  error: rule('immediate', false, false),
  searching: rule('stall'),
  confirmOnDevice: rule('settle', true),
  openApp: rule('settle', true),
  unlockDevice: rule('settle', true),
  done: rule('never', false, false),
  pairingCode: rule('settle', true),
  deviceNotFound: rule('immediate', false, false),
  btcHighIndex: rule('immediate', true),
  installConfirm: rule('immediate', true),
  installing: rule('stall'),
  installBatch: rule('stall'),
};

/** A capsule wait on the machine: its close arms on the stall clock. */
export function isDeviceStageMachineWaitStep(
  step: IDeviceStageStepValue,
): boolean {
  return EXIT_RULE[step].exit === 'stall';
}

/** Whether leaving `step` means the person answered something. */
export function isDeviceStageAnsweredStep(
  step: IDeviceStageStepValue,
): boolean {
  return EXIT_RULE[step].answered;
}

/**
 * Whether a user close on `step` must cancel the device call behind it.
 * Third-party bursts cancel through their adapter instead; outcomes,
 * decisions, the teach card and the air-gap pair leave nothing on the
 * device to cancel.
 */
export function shouldCancelDeviceOnStageClose({
  step,
  vendor,
}: {
  step: IDeviceStageStepValue;
  vendor?: string;
}): boolean {
  return !vendor && EXIT_RULE[step].cancelsDevice;
}

export interface IDeviceStageExitGrant {
  /** The close button and the drag. */
  closable: boolean;
  /** Escape and Android back. */
  exitAllowed: boolean;
}

/**
 * The grant for the live step. `settled`: the stage has been up for the
 * settle time since it appeared. `stalled`: the current machine wait has
 * run past the stall time. `afterAnswer`: that wait
 * began right after the person answered a card.
 */
export function resolveDeviceStageExitGrant({
  step,
  settled,
  stalled,
  afterAnswer,
}: {
  step: IDeviceStageStepValue;
  settled: boolean;
  stalled: boolean;
  afterAnswer: boolean;
}): IDeviceStageExitGrant {
  switch (EXIT_RULE[step].exit) {
    case 'never':
      return { closable: false, exitAllowed: false };
    case 'immediate':
      return { closable: true, exitAllowed: true };
    case 'stall':
      return {
        closable: stalled,
        exitAllowed: afterAnswer ? stalled : settled || stalled,
      };
    default:
      return { closable: settled, exitAllowed: settled };
  }
}

export type IDeviceStageBackPressOutcome = 'close' | 'consume' | 'pass';

/**
 * Android back (and Escape on web, through the same hook) while the stage
 * is up. The stage is the surface, so the press must never reach the screen
 * underneath — the legacy container blocked it the same way while its
 * toast showed, and the legacy dialog mapped it to its close. Once the
 * exit is allowed (see resolveDeviceStageExitGrant) the press IS the close
 * button; before that it is swallowed, like a dialog with system close
 * disabled. Off stage it passes through untouched.
 */
export function resolveDeviceStageBackPress({
  stageIsOn,
  exitAllowed,
}: {
  stageIsOn: boolean;
  exitAllowed: boolean;
}): IDeviceStageBackPressOutcome {
  if (!stageIsOn) {
    return 'pass';
  }
  return exitAllowed ? 'close' : 'consume';
}

export interface IDeviceStageKeyEventLike {
  type: string;
  key: string;
  /** An IME composition in progress: Escape cancels the composition,
   * not the stage. */
  isComposing?: boolean;
  preventDefault(): void;
  stopImmediatePropagation(): void;
}

export interface IDeviceStageKeyEventTargetLike {
  addEventListener(
    type: 'keydown' | 'keyup',
    listener: (event: IDeviceStageKeyEventLike) => void,
    capture: boolean,
  ): void;
  removeEventListener(
    type: 'keydown' | 'keyup',
    listener: (event: IDeviceStageKeyEventLike) => void,
    capture: boolean,
  ): void;
}

/**
 * Web / desktop Escape while the stage is up. The shared back-handler hook
 * only calls back on Escape — it neither reads the callback's answer nor
 * consumes the event — so a Dialog's keydown handler and the modal
 * navigator's keyup handler underneath would still receive the same press
 * and close what the stage covers. This owner sits in the capture phase on
 * the window and stops the press outright, keydown and keyup alike, while
 * the stage is on; only the keydown drives the close decision (`onEscape`
 * decides close-or-swallow, see resolveDeviceStageBackPress). Off stage it
 * touches nothing. Returns the detach.
 */
export function attachDeviceStageEscapeOwner({
  target,
  isStageOn,
  onEscape,
}: {
  target: IDeviceStageKeyEventTargetLike;
  isStageOn: () => boolean;
  onEscape: () => void;
}): () => void {
  const listener = (event: IDeviceStageKeyEventLike) => {
    if (event.key !== 'Escape' || !isStageOn() || event.isComposing) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === 'keydown') {
      onEscape();
    }
  };
  target.addEventListener('keydown', listener, true);
  target.addEventListener('keyup', listener, true);
  return () => {
    target.removeEventListener('keydown', listener, true);
    target.removeEventListener('keyup', listener, true);
  };
}
