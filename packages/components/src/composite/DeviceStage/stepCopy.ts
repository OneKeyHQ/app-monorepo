import type { ComponentProps } from 'react';

import type { IDeviceStageErrorReason, IDeviceStageStep } from './type';
import type { HardwareDevice } from '../../content/HardwareDevice';

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
  processing: undefined,
  error: undefined,
  success: undefined,
};
