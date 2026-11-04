import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { HardwareTelemetry } from './HardwareTelemetry';

import type { IHardwareTelemetryEvent } from '../../dbs/simple/entity/SimpleDbEntityHardwareTelemetry';

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    update: {
      firmware: {
        artifactDownloadRecorded: jest.fn(),
        reportArtifactDownload: jest.fn().mockResolvedValue(undefined),
      },
    },
    hardware: {
      connection: {
        bleCommunicationRecorded: jest.fn(),
        reportBleCommunicationResult: jest.fn().mockResolvedValue(undefined),
      },
    },
  },
}));

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

const bleParams = {
  deviceType: 'pro2',
  firmwareVersion: '1.0.3',
  bleVersion: '1.0.22',
  transportType: 'ble' as const,
  platform: 'ios' as const,
  method: 'FilesystemFileWrite' as const,
  status: 'success' as const,
  mode: 'native-frame' as const,
  frames: 2,
  packets: 4,
  bytes: 100,
  durationMs: 10,
  writeDurationMs: 3,
  readWaitDurationMs: 7,
};

describe('HardwareTelemetry delivery', () => {
  let downloadRecorded: jest.SpyInstance;
  let bleRecorded: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    downloadRecorded = jest.spyOn(
      defaultLogger.update.firmware,
      'artifactDownloadRecorded',
    );
    bleRecorded = jest.spyOn(
      defaultLogger.hardware.connection,
      'bleCommunicationRecorded',
    );
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('keeps offline events until acknowledgment and retries with the same ID/time', async () => {
    const store = createStore([event]);
    const send = jest
      .fn<Promise<void>, [IHardwareTelemetryEvent]>()
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
    const send = jest
      .fn<Promise<void>, [IHardwareTelemetryEvent]>()
      .mockResolvedValue(undefined);
    await new HardwareTelemetry(store, send).flush();
    expect(send).toHaveBeenCalledWith(event);
    expect(store.acknowledge).toHaveBeenCalledWith(event.id);
    expect(downloadRecorded).not.toHaveBeenCalled();
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

  it('records only the final download result locally and never repeats it during retries', async () => {
    const store = createStore();
    const send = jest
      .fn<Promise<void>, [IHardwareTelemetryEvent]>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const telemetry = new HardwareTelemetry(store, send);
    telemetry.report({
      kind: 'download',
      params: { ...event.params, phase: 'started', status: undefined },
    });
    telemetry.report({ kind: 'download', params: event.params });
    await jest.advanceTimersByTimeAsync(0);
    expect(downloadRecorded).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(downloadRecorded).toHaveBeenCalledTimes(1);
    const delivered = send.mock.calls.find(
      ([value]) =>
        value.kind === 'download' && value.params.phase === 'finished',
    )?.[0];
    expect(delivered).toBeDefined();
    expect(downloadRecorded).toHaveBeenCalledWith(
      expect.objectContaining({
        $insertId: delivered?.id,
        $timestamp: delivered?.timestamp,
        phase: 'finished',
        status: 'success',
      }),
    );
  });

  it('keeps the retry deadline when new events arrive or flush is called again', async () => {
    const store = createStore([event]);
    const send = jest
      .fn<Promise<void>, [IHardwareTelemetryEvent]>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const telemetry = new HardwareTelemetry(store, send);
    await telemetry.flush();
    telemetry.report({ kind: 'download', params: event.params });
    await jest.advanceTimersByTimeAsync(0);
    await telemetry.flush();
    await jest.advanceTimersByTimeAsync(59_999);
    expect(send).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(3);
    expect(await store.getPending()).toEqual([]);
  });

  it('coalesces frequent BLE successes into one summary per ten-second window', async () => {
    const store = createStore();
    const send = jest
      .fn<Promise<void>, [IHardwareTelemetryEvent]>()
      .mockResolvedValue(undefined);
    const telemetry = new HardwareTelemetry(store, send);
    for (let index = 0; index < 100; index += 1)
      telemetry.report({ kind: 'ble', params: bleParams });
    await jest.advanceTimersByTimeAsync(9999);
    expect(send).not.toHaveBeenCalled();
    expect(store.enqueue).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(bleRecorded).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'ble',
        params: expect.objectContaining({
          callCount: 100,
          frames: 200,
          packets: 400,
          bytes: 10_000,
          durationMs: 1000,
          writeDurationMs: 300,
          readWaitDurationMs: 700,
          effectiveTransferRateBytesPerSecond: 10_000,
        }),
      }),
    );
    telemetry.report({ kind: 'ble', params: bleParams });
    await jest.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        kind: 'ble',
        params: expect.objectContaining({ frames: 2, callCount: 1 }),
      }),
    );
  });

  it('preserves failures immediately and flushes the preceding success summary once', async () => {
    const send = jest
      .fn<Promise<void>, [IHardwareTelemetryEvent]>()
      .mockResolvedValue(undefined);
    const telemetry = new HardwareTelemetry(createStore(), send);
    telemetry.report({ kind: 'ble', params: bleParams });
    telemetry.report({
      kind: 'ble',
      params: { ...bleParams, status: 'failed' },
    });
    expect(bleRecorded).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(0);
    expect(send.mock.calls.map(([value]) => value.params.status)).toEqual([
      'success',
      'failed',
    ]);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('keeps different device versions in separate BLE summaries', async () => {
    const send = jest
      .fn<Promise<void>, [IHardwareTelemetryEvent]>()
      .mockResolvedValue(undefined);
    const telemetry = new HardwareTelemetry(createStore(), send);
    telemetry.report({ kind: 'ble', params: bleParams });
    telemetry.report({
      kind: 'ble',
      params: { ...bleParams, firmwareVersion: '1.0.4' },
    });
    await jest.advanceTimersByTimeAsync(10_000);
    expect(
      send.mock.calls.map(([value]) =>
        value.kind === 'ble' ? value.params.firmwareVersion : undefined,
      ),
    ).toEqual(['1.0.3', '1.0.4']);
  });

  it('warns once when persistence keeps failing without interrupting callers', async () => {
    const store = createStore();
    store.enqueue.mockRejectedValue(new Error('storage unavailable'));
    const warning = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const telemetry = new HardwareTelemetry(store, jest.fn());
    for (let index = 0; index < 10; index += 1)
      telemetry.report({ kind: 'download', params: event.params });
    await jest.advanceTimersByTimeAsync(0);
    expect(warning).toHaveBeenCalledTimes(1);
  });
});
