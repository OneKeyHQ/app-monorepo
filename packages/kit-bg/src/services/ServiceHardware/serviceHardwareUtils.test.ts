import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import serviceHardwareUtils from './serviceHardwareUtils';

describe('serviceHardwareUtils', () => {
  it('reports scalar BLE transfer results without forwarding packets or identifiers', () => {
    const result = serviceHardwareUtils.parseBleFileWriteLogPayload([
      '[ReactNativeBleTransport] FileWrite perf',
      JSON.stringify({
        platform: 'ios',
        mode: 'native-frame',
        ok: false,
        frames: 2,
        packets: 4,
        frameBytes: 100,
        elapsedMs: 50,
        writeMs: { total: 10 },
        readWaitMs: { total: 40 },
        serialNo: 'private',
        packet: 'secret',
      }),
    ]);
    expect(result).toMatchObject({
      status: 'failed',
      bytes: 100,
      durationMs: 50,
      effectiveTransferRateBytesPerSecond: 2000,
      writeDurationMs: 10,
    });
    expect(result).not.toHaveProperty('serialNo');
    expect(result).not.toHaveProperty('packet');
  });

  it.each([-1, '100', null, 0.5])(
    'rejects malformed BLE byte counters (%s)',
    (frameBytes) => {
      expect(
        serviceHardwareUtils.parseBleFileWriteLogPayload([
          '[ReactNativeBleTransport] FileWrite perf',
          JSON.stringify({
            platform: 'android',
            mode: 'per-packet',
            ok: true,
            frames: 0,
            packets: 0,
            frameBytes,
            elapsedMs: 0,
          }),
        ]),
      ).toBeUndefined();
    },
  );

  it('keeps identifier suffixes for logs', () => {
    expect(serviceHardwareUtils.maskLogIdentifier('PR1234567890')).toBe(
      '***7890',
    );
    expect(serviceHardwareUtils.maskLogIdentifier(undefined)).toBeUndefined();
  });

  it('deduplicates MTU telemetry by connection rather than matching MTU values', () => {
    const reportedSignatures = new Set<string>();
    const parse = (connectionId: number) =>
      serviceHardwareUtils.parseBleMtuReadyLogPayload([
        '[ReactNativeBleTransport] BLE MTU ready',
        JSON.stringify({
          platform: 'android',
          requested: 512,
          actual: 23,
          connectionId,
        }),
      ]);
    const first = parse(1);
    const second = parse(2);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) {
      throw new OneKeyLocalError('Expected MTU telemetry');
    }
    expect(
      serviceHardwareUtils.shouldReportBleMtuReadyTelemetry(
        reportedSignatures,
        first,
      ),
    ).toBe(true);
    expect(
      serviceHardwareUtils.shouldReportBleMtuReadyTelemetry(
        reportedSignatures,
        first,
      ),
    ).toBe(false);
    expect(
      serviceHardwareUtils.shouldReportBleMtuReadyTelemetry(
        reportedSignatures,
        second,
      ),
    ).toBe(true);
  });

  it.each([undefined, 'device-address', -1, 0, 1.5])(
    'does not deduplicate unrelated connections with an invalid token %s',
    (connectionId) => {
      const telemetry = serviceHardwareUtils.parseBleMtuReadyLogPayload([
        '[ReactNativeBleTransport] BLE MTU ready',
        JSON.stringify({
          platform: 'ios',
          requested: 512,
          actual: 247,
          connectionId,
        }),
      ]);
      expect(telemetry).toBeDefined();
      if (!telemetry) {
        throw new OneKeyLocalError('Expected MTU telemetry');
      }
      const reportedSignatures = new Set<string>();
      expect(
        serviceHardwareUtils.shouldReportBleMtuReadyTelemetry(
          reportedSignatures,
          telemetry,
        ),
      ).toBe(true);
      expect(
        serviceHardwareUtils.shouldReportBleMtuReadyTelemetry(
          reportedSignatures,
          telemetry,
        ),
      ).toBe(true);
      expect(reportedSignatures.size).toBe(0);
    },
  );
});
