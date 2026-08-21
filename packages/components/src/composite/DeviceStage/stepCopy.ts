import type { ComponentProps } from 'react';

import type {
  IAuthFailureReason,
  IDeviceStageErrorReason,
  IDeviceStageStep,
} from './type';
import type { HardwareDevice } from '../../content/HardwareDevice';
import type { IKeyOfIcons } from '../../primitives';

/**
 * The stage's vocabulary: which steps exist, what they say, what pose
 * and scene they wear — plus the resolution rules for the words that
 * vary at runtime. Pure data and pure functions; how the stage plays
 * them is the engine's own business (see ./index).
 */

// `off` has no words of its own: searching is part of connecting, so the
// copy is in place from the first frame and holds still while the screen
// renders its content in — one literal, shared, so they cannot drift.
export const CONNECTING_TEXT = {
  title: 'Connecting…',
  sub: 'Keep your device nearby.',
};

/**
 * Failure copy by reason, each with its single recovery action. The stage
 * ends on the surface it played on: no toast, no second dialog.
 */
export const ERROR_TEXT: Record<
  IDeviceStageErrorReason | 'generic',
  { title: string; sub: string; action: string }
> = {
  rejected: {
    title: 'Canceled on device',
    sub: 'The request was declined on the device.',
    action: 'Try again',
  },
  pinInvalid: {
    title: 'Wrong PIN',
    sub: 'The PIN did not match the device.',
    action: 'Re-enter PIN',
  },
  disconnected: {
    title: 'Device disconnected',
    sub: 'Check the connection, then try again.',
    action: 'Reconnect',
  },
  busy: {
    title: 'Device is busy',
    sub: 'Another operation is still running.',
    action: 'Try again',
  },
  generic: {
    title: 'Something went wrong',
    sub: 'Try again in a moment.',
    action: 'Try again',
  },
};

/**
 * The authenticity flow's failure copy, live-dialog verbatim (the design
 * drops the old error-code suffixes). `action` picks the card's exits:
 * 'support' is terminal — one Support button; 'retry' is recoverable —
 * Retry plus the Continue-anyway gate (see AUTH_NOTE_TEXT). The icon
 * fronts the card where the staged steps front the replica.
 */
export const AUTH_FAILURE_TEXT: Record<
  IAuthFailureReason,
  {
    title: string;
    sub: string;
    icon: IKeyOfIcons;
    action: 'support' | 'retry';
  }
> = {
  unofficialDevice: {
    title: 'Unofficial device detected',
    sub: 'Your device could not be verified as official. Please contact us immediately.',
    icon: 'ErrorSolid',
    action: 'support',
  },
  unofficialFirmware: {
    title: 'Unofficial device detected',
    sub: 'Your device could not be verified as official. Please contact us immediately.',
    icon: 'ErrorSolid',
    action: 'support',
  },
  defective: {
    title: 'For your security, this device has been temporarily disabled',
    sub: 'We’ve identified that this device may belong to an early batch. To protect your assets, its use in the OneKey client has been suspended. Please contact customer support for a replacement.',
    icon: 'ErrorSolid',
    action: 'support',
  },
  network: {
    title: 'Network error',
    sub: 'Check your connection and retry',
    icon: 'GlobusSolid',
    action: 'retry',
  },
  unknown: {
    title: 'Unknown error',
    sub: 'An unexpected error occurred. Please try again.',
    icon: 'ErrorSolid',
    action: 'retry',
  },
  unavailable: {
    title: 'Verification temporarily unavailable',
    sub: "Currently, we're unable to verify your device due to server issues. Please try again later.",
    icon: 'ServerSolid',
    action: 'retry',
  },
};

/**
 * The Continue-anyway gate, one card shared by every recoverable
 * failure: the content swaps to this NOTE in place, I-understand is the
 * real exit, Back returns to the failure.
 */
export const AUTH_NOTE_TEXT = {
  title: 'NOTE!',
  sub: "We're currently unable to verify your device. Continuing may pose security risks.",
  confirm: 'I understand',
  back: 'Back',
};

/** Wallet grammar: an instruction-first title, one informative line under. */
export const STEP_TEXT: Record<
  IDeviceStageStep,
  { title: string; sub?: string }
> = {
  off: CONNECTING_TEXT,
  connecting: CONNECTING_TEXT,
  // Titles name the place only when it is not here: the app is where the
  // person already is, so app-side steps stay bare and device-side steps
  // carry "on device" — the one fact that changes when a step hops sides.
  enterPin: { title: 'Enter PIN on device', sub: 'Unlock your device.' },
  // No sub on purpose: the pad's strip carries the teaching line.
  pinOnApp: { title: 'Enter PIN' },
  // The teach-first beat titles itself after the flow it opens (the live
  // dialog's own name). No sub on purpose: the definition line needs an
  // emphasized word — rich text the panel carries itself (see
  // PassphraseIntro).
  passphraseIntro: { title: 'Add hidden wallet' },
  enterPassphrase: {
    title: 'Enter passphrase on device',
    sub: 'Each passphrase opens its own hidden wallet.',
  },
  // No sub on purpose: the form's bullets carry the character rules.
  passphraseOnApp: { title: 'Enter passphrase' },
  // No sub: the panel's numbered steps carry the air-gap instructions.
  showQr: { title: 'Scan with your device' },
  scanQr: {
    title: 'Scan your device screen',
    sub: 'Aim at the code your device is showing.',
  },
  confirm: { title: 'Confirm on device' },
  genuineCheck: {
    title: 'Genuine check',
    sub: 'Confirm on your device to verify its authenticity and secure your connection.',
  },
  // The sub is the legacy single-check shape's; a checklist on show
  // retires it (resolveStageText suppresses it when one is present).
  authVerifying: { title: 'Verifying device', sub: 'Please wait...' },
  authSuccess: {
    title: 'Verification successful',
    sub: "Your device is now officially verified! You're all set to enjoy a secure and seamless experience.",
  },
  // The step's real words come off AUTH_FAILURE_TEXT by reason; this is
  // the Record's required fallback, matching the 'unknown' shape.
  authFailure: {
    title: AUTH_FAILURE_TEXT.unknown.title,
    sub: AUTH_FAILURE_TEXT.unknown.sub,
  },
  // No sub: the waiting capsule speaks this one line by itself.
  processing: { title: 'Processing…' },
  error: ERROR_TEXT.generic,
};

/**
 * The passphrase step's other name: creating a hidden wallet titles the
 * step after the flow it performs — the live Add-hidden-wallet dialog's
 * title — while plain entry keeps the step's own words above.
 */
export const PASSPHRASE_CREATE_TEXT: { title: string; sub?: string } = {
  title: 'Add hidden wallet',
};

/**
 * What the replica's screen plays per step. The endings go dark: the
 * stage mirrors state, it does not invent what the physical screen
 * shows. The app-side inputs, the air-gap pair and the waiting card
 * beats have no replica on stage at all.
 */
export const SCENE_ANIMATION: Record<
  IDeviceStageStep,
  ComponentProps<typeof HardwareDevice>['animation']
> = {
  off: undefined,
  connecting: 'connecting',
  enterPin: 'enterPin',
  pinOnApp: undefined,
  passphraseIntro: undefined,
  enterPassphrase: 'enterPassphrase',
  passphraseOnApp: undefined,
  showQr: undefined,
  scanQr: undefined,
  confirm: 'confirm',
  // The authenticity flow's screens: the ask mirrors the device's own
  // confirm prompt; the wait plays dark (its screen is undecided); the
  // landing rests on the idle wallpaper. The failure card has no replica.
  genuineCheck: 'confirm',
  authVerifying: undefined,
  authSuccess: 'connecting',
  authFailure: undefined,
  processing: undefined,
  error: undefined,
};

/**
 * Which rest pose a step belongs to: absent before the burst has
 * anything to say, the capsule for waiting beats — nothing is asked of
 * the person — and the card for everything else.
 */
export const STEP_POSE: Record<
  IDeviceStageStep,
  'hidden' | 'capsule' | 'card'
> = {
  off: 'hidden',
  connecting: 'capsule',
  processing: 'capsule',
  enterPin: 'card',
  pinOnApp: 'card',
  passphraseIntro: 'card',
  enterPassphrase: 'card',
  passphraseOnApp: 'card',
  showQr: 'card',
  scanQr: 'card',
  confirm: 'card',
  genuineCheck: 'card',
  authVerifying: 'card',
  authSuccess: 'card',
  authFailure: 'card',
  error: 'card',
};

/**
 * The staged steps — the ones that keep the replica on stage. The full
 * stage crops the device to screen-and-keys for the device-side asks;
 * the compact list wears the confirm miniature instead — confirm's own
 * shrink, and the authenticity flow, which keeps the whole device in
 * view while the card talks. The engine derives its port map (and the
 * miniature's scale) from these two lists, so membership is stated once.
 */
export const FULL_STAGED_STEPS: IDeviceStageStep[] = [
  'enterPin',
  'enterPassphrase',
];
export const COMPACT_STAGED_STEPS: IDeviceStageStep[] = [
  'confirm',
  'genuineCheck',
  'authVerifying',
  'authSuccess',
];

/**
 * The stage seat's words, resolved: confirm swaps its sub for the live
 * operation context, and a checklist on show retires authVerifying's
 * legacy "Please wait..." line — the progress rows speak instead.
 */
export function resolveStageText(
  step: IDeviceStageStep,
  options: { confirmContext?: string; hasChecklist: boolean },
): { title: string; sub: string } {
  const text = STEP_TEXT[step];
  let sub = (step === 'confirm' ? options.confirmContext : text.sub) ?? '';
  if (step === 'authVerifying' && options.hasChecklist) {
    sub = '';
  }
  return { title: text.title, sub };
}

/** The passphrase panel's words: create mode titles the step after the
 * flow it performs, plain entry keeps the step's own words. */
export function resolvePassphrasePanelText(mode?: 'create' | 'verify'): {
  title: string;
  sub?: string;
} {
  return mode === 'create' ? PASSPHRASE_CREATE_TEXT : STEP_TEXT.passphraseOnApp;
}

/** The capsule's words: always the live step's title, with the device's
 * name as the second line while connecting (the flow spec's pairing). */
export function resolveCapsuleText(
  step: IDeviceStageStep,
  deviceName?: string,
): { title: string; sub?: string } {
  return {
    title: STEP_TEXT[step].title,
    sub: step === 'connecting' ? deviceName : undefined,
  };
}
