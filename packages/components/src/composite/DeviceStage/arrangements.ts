import { COMPACT_STAGED_STEPS, FULL_STAGED_STEPS } from './stepCopy';

import type { IDeviceStageStep } from './type';

/**
 * The stage's seats and which step sits in which — plus the rule for
 * when a seat's own state has to be dropped.
 *
 * Kept apart from the engine so the reset rule can be read, and pinned,
 * without standing up the whole component.
 */
export const CARD_ARRANGEMENTS = [
  'stage',
  'pinOnApp',
  'selectWalletType',
  'passphraseIntro',
  'passphraseOnApp',
  'showQr',
  'scanQr',
  'authFailure',
  'error',
  'pairingCode',
  'deviceNotFound',
  'btcHighIndex',
  'installConfirm',
  'installing',
  'installBatch',
] as const;

export type ICardArrangement = (typeof CARD_ARRANGEMENTS)[number];

const CARD_ARRANGEMENT_SET: ReadonlySet<string> = new Set(CARD_ARRANGEMENTS);

const STAGED_STEPS: ReadonlySet<string> = new Set<string>([
  ...FULL_STAGED_STEPS,
  ...COMPACT_STAGED_STEPS,
]);

/** The stage's grouping: the staged steps share one arrangement, every
 * other card step is its own — a crossing between two different
 * arrangements runs the two-phase swap. */
export function arrangementOf(step: IDeviceStageStep): string {
  return STAGED_STEPS.has(step) ? 'stage' : step;
}

/**
 * The seat whose state must be dropped now, because the step just left
 * it — or nothing, when the step stayed put or was never in a seat.
 *
 * The stateful seats (the PIN pad, the passphrase form, the pairing
 * code) are never unmounted: the design parks them so a crossing has
 * something to morph, and a per-visit signal stands in for the clean
 * slate a remount used to give. Reading that signal on the way IN is
 * what let a secret survive: the arrangement is frozen while the card
 * is off screen, so leaving a card and coming back to the SAME one
 * never looked like a change, and the form still held the last entry
 * (OK-59934).
 *
 * So the signal is read on the way OUT instead. An ask that has ended
 * has ended — its answer is spent, and the device is not listening for
 * it any more. This also covers what a visit-time reset never could:
 * the flows with no next visit at all, where the person answered
 * correctly, closed the stage, or had the device taken away mid-ask.
 * A re-assert of the same step is not a departure and clears nothing.
 */
export function panelLeftBehind(
  prevStep: IDeviceStageStep,
  nextStep: IDeviceStageStep,
): ICardArrangement | undefined {
  if (prevStep === nextStep) {
    return undefined;
  }
  const leaving = arrangementOf(prevStep);
  return CARD_ARRANGEMENT_SET.has(leaving)
    ? (leaving as ICardArrangement)
    : undefined;
}
