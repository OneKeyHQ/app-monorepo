import { arrangementOf, panelLeftBehind } from './arrangements';
import { COMPACT_STAGED_STEPS, FULL_STAGED_STEPS, STEP_POSE } from './stepCopy';

/**
 * The seat-reset rule (OK-59934). A stateful seat is never unmounted,
 * so this is the only thing that drops what the person typed.
 */

describe('arrangementOf', () => {
  it('gives the app-side inputs a seat each', () => {
    expect(arrangementOf('passphraseOnApp')).toBe('passphraseOnApp');
    expect(arrangementOf('pinOnApp')).toBe('pinOnApp');
  });

  it('seats the staged steps together', () => {
    expect(arrangementOf('enterPin')).toBe('stage');
    expect(arrangementOf('genuineCheck')).toBe('stage');
    // The confirm capsule (2026-09-11) is not on the stage: a PIN card
    // folding into it is a pose flight, never an in-stage port move.
    expect(arrangementOf('confirm')).toBe('confirm');
  });

  // The stage arrangement exists on the card alone — the engine reads
  // the scene map and seats the device badge only under the card pose —
  // so a staged step with another pose would play a dark, bare seat.
  it('stages only card-posed steps', () => {
    for (const step of [...FULL_STAGED_STEPS, ...COMPACT_STAGED_STEPS]) {
      expect(STEP_POSE[step]).toBe('card');
    }
  });
});

describe('panelLeftBehind', () => {
  // The repro: the passphrase card is left for the wait, the failure and
  // the exit, then the retry brings the SAME card back. Reading the
  // signal on the way in saw no change and handed the person their last
  // passphrase; read on the way out, the seat was cleared at the first
  // of those steps.
  it('clears the passphrase seat the moment the ask ends', () => {
    expect(panelLeftBehind('passphraseOnApp', 'processing')).toBe(
      'passphraseOnApp',
    );
  });

  it('clears the PIN seat the same way', () => {
    expect(panelLeftBehind('pinOnApp', 'processing')).toBe('pinOnApp');
  });

  it('clears an abandoned ask, not just an answered one', () => {
    // Nobody pressed anything: the device was taken away and the burst
    // landed its failure. The typed secret still has to go.
    expect(panelLeftBehind('passphraseOnApp', 'error')).toBe('passphraseOnApp');
    expect(panelLeftBehind('passphraseOnApp', 'off')).toBe('passphraseOnApp');
  });

  // The guard that keeps the fix from eating live input: the SDK
  // re-asserting the step the person is answering is not a departure.
  it('keeps the entry while the same ask stands', () => {
    expect(
      panelLeftBehind('passphraseOnApp', 'passphraseOnApp'),
    ).toBeUndefined();
  });

  it('says nothing when the step was never in a seat of its own', () => {
    expect(panelLeftBehind('processing', 'passphraseOnApp')).toBeUndefined();
    expect(panelLeftBehind('connecting', 'processing')).toBeUndefined();
  });

  it('treats the shared staged seat as one seat', () => {
    // enterPin and genuineCheck both sit in 'stage': moving between them
    // is not leaving the seat.
    expect(panelLeftBehind('enterPin', 'genuineCheck')).toBe('stage');
    expect(panelLeftBehind('enterPin', 'processing')).toBe('stage');
  });
});
