import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import serviceHardwareUtils from './serviceHardwareUtils';

describe('serviceHardwareUtils', () => {
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
