import {
  setDeviceStageBurstActive,
  shouldEmitDeviceNotFoundDialogEvent,
} from './deviceStageOwnership';

describe('shouldEmitDeviceNotFoundDialogEvent', () => {
  afterEach(() => {
    setDeviceStageBurstActive(false);
  });

  it('emits for a bare call — the legacy dialog is the only surface', () => {
    expect(shouldEmitDeviceNotFoundDialogEvent({})).toBe(true);
    expect(shouldEmitDeviceNotFoundDialogEvent({ silentMode: false })).toBe(
      true,
    );
  });

  it('stands down while a burst is active — the stage lands the failure itself', () => {
    // The emit fires from the error's constructor, before the failed call
    // returns to the wrapper: an at-initiation failure outruns the stage's
    // deferred opening beat, so the UI-side stage-is-showing gate alone
    // would let the legacy dialog and the stage card double up.
    setDeviceStageBurstActive(true);
    expect(shouldEmitDeviceNotFoundDialogEvent({})).toBe(false);
  });

  it('stays silent in silent mode regardless of the burst', () => {
    expect(shouldEmitDeviceNotFoundDialogEvent({ silentMode: true })).toBe(
      false,
    );
    setDeviceStageBurstActive(true);
    expect(shouldEmitDeviceNotFoundDialogEvent({ silentMode: true })).toBe(
      false,
    );
  });

  it('emits again once the burst has ended', () => {
    setDeviceStageBurstActive(true);
    setDeviceStageBurstActive(false);
    expect(shouldEmitDeviceNotFoundDialogEvent({})).toBe(true);
  });
});
