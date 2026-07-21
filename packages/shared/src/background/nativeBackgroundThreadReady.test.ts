import { OneKeyLocalError } from '../errors';

import {
  onNativeBackgroundThreadReady,
  publishNativeBackgroundThreadReady,
} from './nativeBackgroundThreadReady';

describe('native background thread ready latch', () => {
  it('supports subscribing before the runtime publisher is installed', () => {
    const listener = jest.fn();
    const unsubscribe = onNativeBackgroundThreadReady(listener);
    listener.mockClear();

    const signal = publishNativeBackgroundThreadReady({
      bootId: 'boot-before-publish',
      reason: 'initial',
    });

    expect(listener).toHaveBeenCalledWith(signal);
    unsubscribe();
  });

  it('replays the latest signal and gives a same-boot recovery a new sequence', () => {
    const initial = publishNativeBackgroundThreadReady({
      bootId: 'boot-same',
      reason: 'initial',
    });
    const recovered = publishNativeBackgroundThreadReady({
      bootId: 'boot-same',
      reason: 'recovered',
    });
    const listener = jest.fn();

    const unsubscribe = onNativeBackgroundThreadReady(listener);

    expect(recovered.sequence).toBe(initial.sequence + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(recovered);
    unsubscribe();
  });

  it('isolates throwing listeners during publish and late replay', () => {
    const throwingListener = jest.fn(() => {
      throw new OneKeyLocalError('listener failed');
    });
    const healthyListener = jest.fn();
    const unsubscribeThrowing = onNativeBackgroundThreadReady(throwingListener);
    const unsubscribeHealthy = onNativeBackgroundThreadReady(healthyListener);
    throwingListener.mockClear();
    healthyListener.mockClear();

    let signal: ReturnType<typeof publishNativeBackgroundThreadReady>;
    expect(() => {
      signal = publishNativeBackgroundThreadReady({
        bootId: 'boot-listener-isolation',
        reason: 'recovered',
      });
    }).not.toThrow();
    expect(throwingListener).toHaveBeenCalledTimes(1);
    expect(healthyListener).toHaveBeenCalledWith(signal!);

    const lateListener = jest.fn();
    expect(() => onNativeBackgroundThreadReady(lateListener)).not.toThrow();
    expect(lateListener).toHaveBeenCalledWith(signal!);

    unsubscribeThrowing();
    unsubscribeHealthy();
  });
});
