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

/**
 * Wallet grammar: an instruction-first title, one line under. The steps
 * with the device in the picture (see DEVICE_NAMED_STEPS) carry titles
 * only here — their second line is the device's own name, resolved at
 * runtime; the outcome cards keep a line of their own.
 */
export const STEP_TEXT: Record<
  IDeviceStageStep,
  { title: string; sub?: string }
> = {
  off: CONNECTING_TEXT,
  connecting: CONNECTING_TEXT,
  // Titles name the place only when it is not here: the app is where the
  // person already is, so app-side steps stay bare and device-side steps
  // carry "on device" — the one fact that changes when a step hops sides.
  enterPin: { title: 'Enter PIN on device' },
  pinOnApp: { title: 'Enter PIN' },
  // The teach-first beat titles itself after the flow it opens (the live
  // dialog's own name). No sub on purpose: the definition line needs an
  // emphasized word — rich text the panel carries itself (see
  // PassphraseIntro).
  passphraseIntro: { title: 'Add hidden wallet' },
  enterPassphrase: { title: 'Enter passphrase on device' },
  passphraseOnApp: { title: 'Enter passphrase' },
  showQr: { title: 'Scan with your device' },
  scanQr: { title: 'Scan your device screen' },
  confirm: { title: 'Confirm on device' },
  genuineCheck: { title: 'Genuine check' },
  authVerifying: { title: 'Verifying device' },
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
  processing: { title: 'Processing…' },
  error: ERROR_TEXT.generic,
  // The third-party track. Capsule labels ride the vendor SDKs' own
  // vocabulary (the ratified board keeps their wording); the card steps
  // with runtime words — vendor, app name, path — resolve below.
  searching: { title: 'Searching for device…' },
  confirmOnDevice: { title: 'Confirm on device' },
  openApp: { title: 'Please open the correct app on your device' },
  unlockDevice: { title: 'Please manually unlock the device.' },
  done: { title: 'Done' },
  pairingCode: {
    title: 'Pair Trezor',
    sub: 'Confirm OneKey Wallet is connecting to your Trezor, then enter the security code shown on the device.',
  },
  deviceNotFound: {
    title: 'Connect device',
    sub: 'Please connect and unlock your device, then press Confirm.',
  },
  btcHighIndex: {
    title: 'Multiple device confirmations required',
    sub: 'This account path is a non-standard derivation and needs extra confirmations on the device.',
  },
  installConfirm: { title: 'Install app' },
  installing: { title: 'Installing app', sub: 'Processing…' },
  installBatch: {
    title: 'Get started',
    sub: 'The current operation requires the Ledger apps listed below. Install them, then retry the operation.',
  },
};

/** The vendors' display names, for the cards that address the brand. */
export const VENDOR_LABEL: Record<'ledger' | 'trezor', string> = {
  ledger: 'Ledger',
  trezor: 'Trezor',
};

/** `connecting` worn by the vendor track: the board's own label — the
 * capsule has no device-name line there, so the title carries it. */
export const VENDOR_CONNECTING_TEXT = { title: 'Connecting your device' };

/** `deviceNotFound`'s words, addressed to the brand. */
export function resolveDeviceNotFoundText(vendor?: 'ledger' | 'trezor'): {
  title: string;
  sub: string;
} {
  if (!vendor) {
    return {
      title: STEP_TEXT.deviceNotFound.title,
      sub: STEP_TEXT.deviceNotFound.sub ?? '',
    };
  }
  const label = VENDOR_LABEL[vendor];
  return {
    title: `Connect ${label}`,
    sub: `Please connect and unlock your ${label} device, then press Confirm.`,
  };
}

/** `btcHighIndex`'s warning, current-UI verbatim, path and index in. */
export function resolveBtcHighIndexSub(
  path?: string,
  accountIndex?: number,
): string {
  const index = accountIndex ?? '';
  return `You're about to access a BIP44 account at index ${index} (path ${
    path ?? ''
  }). The Ledger Bitcoin App treats this as a non-standard derivation — each such path needs a separate manual confirmation on the device, with no batch exemption. If you don't need this index, cancel and use an index below 99.`;
}

/** The install steps' words around the app's name. */
export function resolveInstallText(
  step: 'installConfirm' | 'installing',
  appName?: string,
): { title: string; sub: string } {
  const app = appName ?? 'app';
  if (step === 'installConfirm') {
    return {
      title: `Install ${app}`,
      sub: `"${app}" is not installed. Install it now?`,
    };
  }
  return { title: `Installing ${app}`, sub: 'Processing…' };
}

/**
 * The steps whose second line is the device's own name — every step with
 * the device in the picture, waits and asks alike, the flow spec's
 * connecting-capsule pairing made the rule. The outcome cards (the
 * authenticity landing and failures, the error) and the teach-first
 * intro keep their own words.
 */
export const DEVICE_NAMED_STEPS: ReadonlySet<IDeviceStageStep> =
  new Set<IDeviceStageStep>([
    'connecting',
    'processing',
    'enterPin',
    'pinOnApp',
    'enterPassphrase',
    'passphraseOnApp',
    'showQr',
    'scanQr',
    'confirm',
    'genuineCheck',
    'authVerifying',
  ]);

/** A step's second line: the device's name where the device is in the
 * picture, the step's own line otherwise — empty when neither exists. */
export function resolveStepSub(
  step: IDeviceStageStep,
  deviceName?: string,
): string {
  return (
    (DEVICE_NAMED_STEPS.has(step) ? deviceName : STEP_TEXT[step].sub) ?? ''
  );
}

/**
 * The passphrase step's other name: creating a hidden wallet titles the
 * step after the flow it performs — the live Add-hidden-wallet dialog's
 * title — while plain entry keeps the step's own words above.
 */
export const PASSPHRASE_CREATE_TEXT = {
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
  // The third-party track never lights the replica: those devices have
  // no code-drawn twin, so no step maps to a scene.
  searching: undefined,
  confirmOnDevice: undefined,
  openApp: undefined,
  unlockDevice: undefined,
  done: undefined,
  pairingCode: undefined,
  deviceNotFound: undefined,
  btcHighIndex: undefined,
  installConfirm: undefined,
  installing: undefined,
  installBatch: undefined,
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
  // Third-party: the passive vendor events stay in the capsule — the
  // person acts on the physical device, nothing is asked in the app —
  // and `done` lands its ✓ there too; the decision, input and progress
  // beats are cards.
  searching: 'capsule',
  confirmOnDevice: 'capsule',
  openApp: 'capsule',
  unlockDevice: 'capsule',
  done: 'capsule',
  pairingCode: 'card',
  deviceNotFound: 'card',
  btcHighIndex: 'card',
  installConfirm: 'card',
  installing: 'card',
  installBatch: 'card',
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

/** The stage seat's words, resolved: the step's title over the device's
 * name (every staged step has the device in the picture). */
export function resolveStageText(
  step: IDeviceStageStep,
  deviceName?: string,
): { title: string; sub: string } {
  return {
    title: STEP_TEXT[step].title,
    sub: resolveStepSub(step, deviceName),
  };
}

/** The passphrase panel's words: create mode titles the step after the
 * flow it performs, plain entry keeps the step's own title; the device's
 * name sits under either. */
export function resolvePassphrasePanelText(
  mode: 'create' | 'verify' | undefined,
  deviceName?: string,
): { title: string; sub: string } {
  return {
    title:
      mode === 'create'
        ? PASSPHRASE_CREATE_TEXT.title
        : STEP_TEXT.passphraseOnApp.title,
    sub: resolveStepSub('passphraseOnApp', deviceName),
  };
}

/** The capsule's words: the live step's title over the device's name —
 * both waiting beats have the device in the picture. The vendor track
 * speaks single labels (the board carries no device-name line there),
 * with `connecting` reworded to say what the missing line said. */
export function resolveCapsuleText(
  step: IDeviceStageStep,
  deviceName?: string,
  vendor?: 'ledger' | 'trezor',
): { title: string; sub: string } {
  if (vendor) {
    return {
      title:
        step === 'connecting'
          ? VENDOR_CONNECTING_TEXT.title
          : STEP_TEXT[step].title,
      sub: '',
    };
  }
  return {
    title: STEP_TEXT[step].title,
    sub: resolveStepSub(step, deviceName),
  };
}
