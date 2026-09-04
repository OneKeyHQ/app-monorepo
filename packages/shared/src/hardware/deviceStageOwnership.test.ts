import {
  attachDeviceStageEscapeOwner,
  resolveDeviceStageBackPress,
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

describe('resolveDeviceStageBackPress', () => {
  it('passes the press through while the stage is off', () => {
    expect(
      resolveDeviceStageBackPress({ stageIsOn: false, closable: false }),
    ).toBe('pass');
    expect(
      resolveDeviceStageBackPress({ stageIsOn: false, closable: true }),
    ).toBe('pass');
  });

  it('swallows the press while the stage is up but its close is not armed yet', () => {
    // Nothing underneath may react: the stage is the surface, and a burst
    // that has not armed its close grant cannot be dismissed by any route.
    expect(
      resolveDeviceStageBackPress({ stageIsOn: true, closable: false }),
    ).toBe('consume');
  });

  it('is the close button once the close grant is armed', () => {
    expect(
      resolveDeviceStageBackPress({ stageIsOn: true, closable: true }),
    ).toBe('close');
  });
});

describe('attachDeviceStageEscapeOwner', () => {
  type IListener = (event: {
    type: string;
    key: string;
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
    const dispatch = (type: 'keydown' | 'keyup', key: string) => {
      const event = {
        type,
        key,
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
