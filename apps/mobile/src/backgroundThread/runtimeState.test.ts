import { onNativeBackgroundThreadReady } from '@onekeyhq/shared/src/background/nativeBackgroundThreadReady';

import {
  classifyBackgroundThreadReadyReason,
  setBackgroundThreadReadyPayload,
} from './runtimeState';

import type { IBackgroundThreadReadyPayload } from './runtimeReady';

function buildReadyPayload(bootId: string): IBackgroundThreadReadyPayload {
  return {
    runtime: 'background',
    status: 'ready',
    protocolVersion: '1',
    bootId,
    ts: 1,
  };
}

describe('background thread ready signal', () => {
  it('publishes a consumable recovered signal when the first ready arrives after timeout', () => {
    const payload = buildReadyPayload('boot-after-timeout');
    const reason = classifyBackgroundThreadReadyReason({
      nextBootId: payload.bootId,
      previousBootId: undefined,
      transportState: 'remote-broken',
    });

    expect(reason).toBe('recovered');
    setBackgroundThreadReadyPayload(payload, reason);

    const lateListener = jest.fn();
    const unsubscribe = onNativeBackgroundThreadReady(lateListener);

    expect(lateListener).toHaveBeenCalledTimes(1);
    expect(lateListener).toHaveBeenCalledWith({
      bootId: payload.bootId,
      reason: 'recovered',
      sequence: expect.any(Number),
    });
    unsubscribe();
  });

  it('delivers a new boot with restart semantics and supports unsubscribe', () => {
    const listener = jest.fn();
    setBackgroundThreadReadyPayload(buildReadyPayload('boot-first'));
    const unsubscribe = onNativeBackgroundThreadReady(listener);
    listener.mockClear();

    const restartedPayload = buildReadyPayload('boot-second');
    setBackgroundThreadReadyPayload(restartedPayload, 'restarted');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      bootId: restartedPayload.bootId,
      reason: 'restarted',
      sequence: expect.any(Number),
    });

    unsubscribe();
    setBackgroundThreadReadyPayload(buildReadyPayload('boot-third'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      expected: 'recovered',
      nextBootId: 'boot-same',
      previousBootId: 'boot-same',
      transportState: 'remote-broken',
    },
    {
      expected: 'restarted',
      nextBootId: 'boot-next',
      previousBootId: 'boot-previous',
      transportState: 'remote-broken',
    },
    {
      expected: 'restarted',
      nextBootId: 'boot-next',
      previousBootId: 'boot-previous',
      transportState: 'ready',
    },
    {
      expected: 'initial',
      nextBootId: 'boot-first',
      previousBootId: undefined,
      transportState: 'starting',
    },
  ] as const)(
    'classifies $transportState with $previousBootId -> $nextBootId as $expected',
    ({ expected, nextBootId, previousBootId, transportState }) => {
      expect(
        classifyBackgroundThreadReadyReason({
          nextBootId,
          previousBootId,
          transportState,
        }),
      ).toBe(expected);
    },
  );

  it('stores the debug payload before publishing the shared signal', () => {
    const payload = buildReadyPayload('boot-atomic');
    const sharedListener = jest.fn(() => {
      expect(
        (
          globalThis as typeof globalThis & {
            __onekeyBackgroundThreadReadyPayload?: IBackgroundThreadReadyPayload;
          }
        ).__onekeyBackgroundThreadReadyPayload,
      ).toBe(payload);
    });
    const unsubscribeShared = onNativeBackgroundThreadReady(sharedListener);
    sharedListener.mockClear();

    expect(() =>
      setBackgroundThreadReadyPayload(payload, 'recovered'),
    ).not.toThrow();
    expect(sharedListener).toHaveBeenCalledTimes(1);

    unsubscribeShared();
  });
});
