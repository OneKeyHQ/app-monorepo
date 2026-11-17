import { act, renderHook } from '@testing-library/react-native';

import { useRafCoalesced } from './useRafCoalesced';

type ITestValue = { id: string };

// The hook emits on the next animation frame, so drive rAF manually instead of
// waiting on real frames.
let pendingFrames: Array<() => void> = [];

function flushFrames() {
  const frames = pendingFrames;
  pendingFrames = [];
  frames.forEach((frame) => frame());
}

type IFrameGlobals = {
  requestAnimationFrame?: (callback: (time: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
};

const frameGlobals = globalThis as IFrameGlobals;
const originalRequestAnimationFrame = frameGlobals.requestAnimationFrame;
const originalCancelAnimationFrame = frameGlobals.cancelAnimationFrame;

beforeEach(() => {
  pendingFrames = [];
  // Assigned rather than spied: the jest environment does not define these, so
  // there is nothing for spyOn to attach to.
  frameGlobals.requestAnimationFrame = (callback) => {
    pendingFrames.push(() => callback(0));
    return pendingFrames.length;
  };
  frameGlobals.cancelAnimationFrame = () => undefined;
});

afterEach(() => {
  frameGlobals.requestAnimationFrame = originalRequestAnimationFrame;
  frameGlobals.cancelAnimationFrame = originalCancelAnimationFrame;
});

describe('useRafCoalesced', () => {
  it('holds the previous value until the next frame', () => {
    const first = { id: 'first' };
    const second = { id: 'second' };
    const { result, rerender } = renderHook(
      ({ value }: { value: ITestValue }) => useRafCoalesced(value, 'epoch'),
      { initialProps: { value: first } },
    );

    expect(result.current).toBe(first);

    rerender({ value: second });
    expect(result.current).toBe(first);

    act(() => {
      flushFrames();
    });
    expect(result.current).toBe(second);
  });

  it('emits synchronously when the flush key changes', () => {
    const first = { id: 'first' };
    const second = { id: 'second' };
    const { result, rerender } = renderHook(
      ({ value, flushKey }: { value: ITestValue; flushKey: string }) =>
        useRafCoalesced(value, flushKey),
      { initialProps: { value: first, flushKey: 'a' } },
    );

    rerender({ value: second, flushKey: 'b' });
    expect(result.current).toBe(second);
  });

  it('passes the live value straight through while disabled', () => {
    const first = { id: 'first' };
    const second = { id: 'second' };
    const { result, rerender } = renderHook(
      ({ value }: { value: ITestValue }) =>
        useRafCoalesced(value, 'epoch', false),
      { initialProps: { value: first } },
    );

    rerender({ value: second });
    // No frame flush: a disabled hook must not defer anything.
    expect(result.current).toBe(second);
    expect(pendingFrames).toHaveLength(0);
  });

  it('returns the live value on the first render after being re-enabled', () => {
    // Guards the regression this flag introduced: `emitted` keeps whatever was
    // current when the hook was switched off, which by the time it comes back
    // can be an entirely different coin or tick size.
    const first = { id: 'first' };
    const second = { id: 'second' };
    const third = { id: 'third' };
    const { result, rerender } = renderHook(
      ({ value, enabled }: { value: ITestValue; enabled: boolean }) =>
        useRafCoalesced(value, 'epoch', enabled),
      { initialProps: { value: first, enabled: true } },
    );

    rerender({ value: second, enabled: false });
    expect(result.current).toBe(second);

    rerender({ value: third, enabled: true });
    expect(result.current).toBe(third);
  });
});
