import { HardwareTelemetry } from './HardwareTelemetry';

import type { IHardwareTelemetryEvent } from '../../dbs/simple/entity/SimpleDbEntityHardwareTelemetry';

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({ defaultLogger: {} }));

const event: IHardwareTelemetryEvent = {
  id: 'stable-event-id',
  timestamp: 123,
  kind: 'download',
  params: {
    deviceType: 'pro2',
    firmwareType: 'universal',
    releaseChannel: 'stable',
    source: 'prefetch',
    artifactRole: 'firmware',
    phase: 'finished',
    status: 'success',
    platform: 'ios',
  },
};

function createStore(initial: IHardwareTelemetryEvent[] = []) {
  let pending = [...initial];
  return {
    getPending: jest.fn(async () => [...pending]),
    enqueue: jest.fn(async (value: IHardwareTelemetryEvent) => {
      pending.push(value);
    }),
    acknowledge: jest.fn(async (id: string) => {
      pending = pending.filter((value) => value.id !== id);
    }),
  };
}

describe('HardwareTelemetry delivery', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('keeps offline events until acknowledgment and retries with the same ID/time', async () => {
    const store = createStore([event]);
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const telemetry = new HardwareTelemetry(store, send);
    await telemetry.flush();
    expect(store.acknowledge).not.toHaveBeenCalled();
    expect(await store.getPending()).toEqual([event]);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(send.mock.calls).toEqual([[event], [event]]);
    expect(await store.getPending()).toEqual([]);
  });

  it('replays persisted events after a new background instance starts', async () => {
    const store = createStore([event]);
    const send = jest.fn().mockResolvedValue(undefined);
    await new HardwareTelemetry(store, send).flush();
    expect(send).toHaveBeenCalledWith(event);
    expect(store.acknowledge).toHaveBeenCalledWith(event.id);
  });

  it('joins concurrent flushes without sending an event twice', async () => {
    const store = createStore([event]);
    let finish: (() => void) | undefined;
    const send = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const telemetry = new HardwareTelemetry(store, send);
    const first = telemetry.flush();
    expect(telemetry.flush()).toBe(first);
    await Promise.resolve();
    await Promise.resolve();
    finish?.();
    await first;
    expect(send).toHaveBeenCalledTimes(1);
  });
});
