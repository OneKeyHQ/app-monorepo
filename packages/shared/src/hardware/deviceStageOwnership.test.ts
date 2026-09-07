import {
  attachDeviceStageEscapeOwner,
  isDeviceStageAnsweredStep,
  resolveDeviceStageBackPress,
  resolveDeviceStageExitGrant,
  resolveDeviceStageWaitStall,
  setDeviceStageBurstActive,
  shouldCancelDeviceOnStageClose,
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

describe('resolveDeviceStageBackPress', () => {
  it('passes the press through while the stage is off', () => {
    expect(
      resolveDeviceStageBackPress({ stageIsOn: false, exitAllowed: false }),
    ).toBe('pass');
    expect(
      resolveDeviceStageBackPress({ stageIsOn: false, exitAllowed: true }),
    ).toBe('pass');
  });

  it('swallows the press while the stage is up but the exit is not allowed yet', () => {
    // Nothing underneath may react: the stage is the surface, and before
    // the exit is granted it cannot be dismissed by any route.
    expect(
      resolveDeviceStageBackPress({ stageIsOn: true, exitAllowed: false }),
    ).toBe('consume');
  });

  it('is the close button once the exit is allowed', () => {
    expect(
      resolveDeviceStageBackPress({ stageIsOn: true, exitAllowed: true }),
    ).toBe('close');
  });
});

describe('resolveDeviceStageExitGrant', () => {
  const grant = (
    step: Parameters<typeof resolveDeviceStageExitGrant>[0]['step'],
    flags: Partial<{
      settled: boolean;
      stalled: boolean;
      afterAnswer: boolean;
    }> = {},
  ) =>
    resolveDeviceStageExitGrant({
      step,
      settled: false,
      stalled: false,
      afterAnswer: false,
      ...flags,
    });

  it('opens an ask card on the settle clock, every exit at once', () => {
    expect(grant('confirm')).toEqual({ closable: false, exitAllowed: false });
    expect(grant('confirm', { settled: true })).toEqual({
      closable: true,
      exitAllowed: true,
    });
    // The third-party "do this on the device" beats wait on the person too.
    expect(grant('unlockDevice', { settled: true })).toEqual({
      closable: true,
      exitAllowed: true,
    });
  });

  it('keeps the close off a machine wait until it stalls, but lets the keys out once settled', () => {
    // Connecting: nothing the person did is in flight, so Escape / back
    // leave on the settle clock while the X waits for the stall.
    expect(grant('connecting', { settled: true })).toEqual({
      closable: false,
      exitAllowed: true,
    });
    expect(grant('connecting', { settled: true, stalled: true })).toEqual({
      closable: true,
      exitAllowed: true,
    });
  });

  it('holds every exit on the wait that follows an answer until it stalls', () => {
    // The processing right after a confirm on the device: a habitual back
    // press must not throw that confirmation away.
    expect(grant('processing', { settled: true, afterAnswer: true })).toEqual({
      closable: false,
      exitAllowed: false,
    });
    expect(
      grant('processing', { settled: true, stalled: true, afterAnswer: true }),
    ).toEqual({ closable: true, exitAllowed: true });
  });

  it('counts every card the person answers, the teach card and the fork included', () => {
    // The wait after Continue on the intro carries the hidden-wallet call
    // the person just asked for: a stray Esc/back must not cancel it.
    expect(isDeviceStageAnsweredStep('passphraseIntro')).toBe(true);
    expect(isDeviceStageAnsweredStep('selectWalletType')).toBe(true);
    expect(isDeviceStageAnsweredStep('confirm')).toBe(true);
    // Nothing was asked on these: the wait after them opens on the settle.
    expect(isDeviceStageAnsweredStep('connecting')).toBe(false);
    expect(isDeviceStageAnsweredStep('error')).toBe(false);
  });

  it('opens outcomes and decisions at once, and never the done beat', () => {
    expect(grant('error')).toEqual({ closable: true, exitAllowed: true });
    expect(grant('deviceNotFound')).toEqual({
      closable: true,
      exitAllowed: true,
    });
    expect(grant('selectWalletType')).toEqual({
      closable: true,
      exitAllowed: true,
    });
    // The air-gap pair asks nothing of a connected device: the QR card
    // and the viewfinder close at once (OK-62065).
    expect(grant('showQr')).toEqual({ closable: true, exitAllowed: true });
    expect(grant('scanQr')).toEqual({ closable: true, exitAllowed: true });
    expect(grant('done', { settled: true, stalled: true })).toEqual({
      closable: false,
      exitAllowed: false,
    });
    expect(grant('off', { settled: true, stalled: true })).toEqual({
      closable: false,
      exitAllowed: false,
    });
  });
});

describe('shouldCancelDeviceOnStageClose', () => {
  it('cancels the device call behind an ask or a wait, never behind an outcome', () => {
    expect(shouldCancelDeviceOnStageClose({ step: 'confirm' })).toBe(true);
    expect(shouldCancelDeviceOnStageClose({ step: 'processing' })).toBe(true);
    expect(shouldCancelDeviceOnStageClose({ step: 'error' })).toBe(false);
    expect(shouldCancelDeviceOnStageClose({ step: 'selectWalletType' })).toBe(
      false,
    );
    expect(shouldCancelDeviceOnStageClose({ step: 'deviceNotFound' })).toBe(
      false,
    );
  });

  it('leaves third-party bursts to their adapter', () => {
    expect(
      shouldCancelDeviceOnStageClose({ step: 'confirm', vendor: 'ledger' }),
    ).toBe(false);
  });
});

describe('resolveDeviceStageWaitStall', () => {
  it('stalls once the device has been silent for the idle time', () => {
    const t0 = 100_000;
    expect(
      resolveDeviceStageWaitStall({
        now: t0 + 9999,
        waitStartedAt: t0,
        lastActivityAt: t0,
      }),
    ).toEqual({ stalled: false, dueInMs: 1 });
    expect(
      resolveDeviceStageWaitStall({
        now: t0 + 10_000,
        waitStartedAt: t0,
        lastActivityAt: t0,
      }),
    ).toEqual({ stalled: true, dueInMs: 0 });
  });

  it('starts the idle clock over with every sign of life, up to the cap', () => {
    // Account creation: a call every few seconds for twenty seconds is a
    // busy wait, not a stuck one.
    const t0 = 100_000;
    expect(
      resolveDeviceStageWaitStall({
        now: t0 + 20_000,
        waitStartedAt: t0,
        lastActivityAt: t0 + 18_000,
      }),
    ).toEqual({ stalled: false, dueInMs: 8000 });
    // A transport reconnecting every few seconds is chatter, not
    // progress: the cap opens the way out at thirty seconds regardless.
    expect(
      resolveDeviceStageWaitStall({
        now: t0 + 30_000,
        waitStartedAt: t0,
        lastActivityAt: t0 + 29_000,
      }),
    ).toEqual({ stalled: true, dueInMs: 0 });
    expect(
      resolveDeviceStageWaitStall({
        now: t0 + 25_000,
        waitStartedAt: t0,
        lastActivityAt: t0 + 24_000,
      }),
    ).toEqual({ stalled: false, dueInMs: 5000 });
  });
});

describe('attachDeviceStageEscapeOwner', () => {
  type IListener = (event: {
    type: string;
    key: string;
    isComposing?: boolean;
    preventDefault(): void;
    stopImmediatePropagation(): void;
  }) => void;

  /** A window stand-in that records capture-phase listeners and lets a test
   * dispatch a key to them. */
  const createTarget = () => {
    const listeners = new Map<string, Set<IListener>>();
    const target = {
      addEventListener: jest.fn(
        (type: 'keydown' | 'keyup', listener: IListener, capture: boolean) => {
          expect(capture).toBe(true);
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type)?.add(listener);
        },
      ),
      removeEventListener: jest.fn(
        (type: 'keydown' | 'keyup', listener: IListener) => {
          listeners.get(type)?.delete(listener);
        },
      ),
    };
    const dispatch = (
      type: 'keydown' | 'keyup',
      key: string,
      isComposing = false,
    ) => {
      const event = {
        type,
        key,
        isComposing,
        preventDefault: jest.fn(),
        stopImmediatePropagation: jest.fn(),
      };
      listeners.get(type)?.forEach((listener) => listener(event));
      return event;
    };
    return {
      target,
      dispatch,
      listenerCount: () =>
        [...listeners.values()].reduce((n, set) => n + set.size, 0),
    };
  };

  it('stops Escape on both key phases while the stage is on, and closes on keydown only', () => {
    const { target, dispatch } = createTarget();
    const onEscape = jest.fn();
    attachDeviceStageEscapeOwner({ target, isStageOn: () => true, onEscape });

    const down = dispatch('keydown', 'Escape');
    expect(down.preventDefault).toHaveBeenCalledTimes(1);
    expect(down.stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(onEscape).toHaveBeenCalledTimes(1);

    // The modal navigator underneath listens on keyup: that half of the
    // press must not reach it either — and must not close twice.
    const up = dispatch('keyup', 'Escape');
    expect(up.preventDefault).toHaveBeenCalledTimes(1);
    expect(up.stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('touches nothing while the stage is off, and ignores other keys', () => {
    const { target, dispatch } = createTarget();
    const onEscape = jest.fn();
    attachDeviceStageEscapeOwner({ target, isStageOn: () => false, onEscape });

    const off = dispatch('keydown', 'Escape');
    expect(off.preventDefault).not.toHaveBeenCalled();
    expect(off.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(onEscape).not.toHaveBeenCalled();

    const { target: onTarget, dispatch: dispatchOn } = createTarget();
    attachDeviceStageEscapeOwner({
      target: onTarget,
      isStageOn: () => true,
      onEscape,
    });
    const enter = dispatchOn('keydown', 'Enter');
    expect(enter.preventDefault).not.toHaveBeenCalled();
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('leaves an Escape pressed mid-composition to the IME', () => {
    // Cancelling a Chinese / Japanese composition in the passphrase form
    // must not cancel the whole stage.
    const { target, dispatch } = createTarget();
    const onEscape = jest.fn();
    attachDeviceStageEscapeOwner({ target, isStageOn: () => true, onEscape });

    const composing = dispatch('keydown', 'Escape', true);
    expect(composing.preventDefault).not.toHaveBeenCalled();
    expect(composing.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('detaches both listeners', () => {
    const { target, listenerCount } = createTarget();
    const detach = attachDeviceStageEscapeOwner({
      target,
      isStageOn: () => true,
      onEscape: jest.fn(),
    });
    expect(listenerCount()).toBe(2);
    detach();
    expect(listenerCount()).toBe(0);
    expect(target.removeEventListener).toHaveBeenCalledTimes(2);
  });
});
