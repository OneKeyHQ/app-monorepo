import type { ComponentProps } from 'react';

import type {
  IAuthFailureReason,
  IDeviceStageErrorReason,
  IDeviceStageStep,
} from './type';
import type { HardwareDevice } from '../../content/HardwareDevice';
import type { IKeyOfIcons } from '../../primitives';

/**
 * The stage's words and scenes, shared by both engines (the sheet stage
 * and the overlay morph) so the two can never drift while they coexist.
 * Pure data: which steps exist and what they say is the stage vocabulary;
 * how a surface plays them is each engine's own business.
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
  // retires it (the engines suppress it when authChecklist is present).
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
  // No sub: the whole processing arrangement is this one line, set in the
  // strip's own compact row rather than the heading grammar above.
  processing: { title: 'Processing…' },
  error: ERROR_TEXT.generic,
  success: { title: '✓ Done' },
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
 * shows. The app-side inputs, the air-gap pair and the processing strip
 * have no replica on stage at all.
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
  success: undefined,
};

/**
 * The staged steps that wear the confirm miniature — the compact
 * arrangement — instead of the full stage: confirm's own shrink, and the
 * authenticity flow, which keeps the whole device in view while the card
 * talks. Both engines read this list so their geometry agrees.
 */
export const COMPACT_STAGED_STEPS: IDeviceStageStep[] = [
  'confirm',
  'genuineCheck',
  'authVerifying',
  'authSuccess',
];
