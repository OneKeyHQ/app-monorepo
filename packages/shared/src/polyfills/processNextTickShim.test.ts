import { installAndroidBackgroundProcessNextTick } from './processNextTickShim';

type INextTick = (
  callback: (...args: unknown[]) => void,
  ...args: unknown[]
) => void;

function createScope() {
  const queued: Array<() => void> = [];
  const deadNextTick = jest.fn<void, Parameters<INextTick>>();
  const scope = {
    process: { nextTick: deadNextTick as INextTick } as {
      nextTick?: INextTick;
    },
    setImmediate: jest.fn((callback: () => void) => {
      queued.push(callback);
      return queued.length;
    }),
  };
  const flush = () => {
    queued.splice(0).forEach((run) => run());
  };
  return { scope, deadNextTick, flush };
}

const androidBackground = {
  isNativeAndroid: true,
  isNativeBackgroundThread: true,
};

describe('installAndroidBackgroundProcessNextTick', () => {
  it('routes process.nextTick through setImmediate on the Android background runtime', () => {
    const { scope, deadNextTick, flush } = createScope();

    expect(
      installAndroidBackgroundProcessNextTick(scope, androidBackground),
    ).toBe(true);

    const callback = jest.fn();
    scope.process.nextTick?.(callback, 'first', 2);
    expect(callback).not.toHaveBeenCalled();

    flush();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('first', 2);
    expect(deadNextTick).not.toHaveBeenCalled();
  });

  it('resolves setImmediate at call time so timers installed later are used', () => {
    const { scope } = createScope();
    installAndroidBackgroundProcessNextTick(scope, androidBackground);

    const lateQueue: Array<() => void> = [];
    scope.setImmediate = jest.fn((callback: () => void) => {
      lateQueue.push(callback);
      return lateQueue.length;
    });

    const callback = jest.fn();
    scope.process.nextTick?.(callback);
    expect(lateQueue).toHaveLength(1);
    lateQueue[0]();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('installs nextTick when the runtime process object has none yet', () => {
    const { scope, flush } = createScope();
    scope.process = {};

    expect(
      installAndroidBackgroundProcessNextTick(scope, androidBackground),
    ).toBe(true);

    const callback = jest.fn();
    scope.process.nextTick?.(callback);
    flush();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'iOS background',
      { isNativeAndroid: false, isNativeBackgroundThread: true },
    ],
    [
      'Android main thread',
      { isNativeAndroid: true, isNativeBackgroundThread: false },
    ],
    ['non-native', { isNativeAndroid: false, isNativeBackgroundThread: false }],
  ])('leaves process.nextTick untouched on %s', (_name, env) => {
    const { scope, deadNextTick } = createScope();

    expect(installAndroidBackgroundProcessNextTick(scope, env)).toBe(false);
    expect(scope.process.nextTick).toBe(deadNextTick);
  });
});
