import serviceHardwareUtils from './serviceHardwareUtils';

describe('serviceHardwareUtils', () => {
  it('keeps identifier suffixes for logs', () => {
    expect(serviceHardwareUtils.maskLogIdentifier('PR1234567890')).toBe(
      '***7890',
    );
    expect(serviceHardwareUtils.maskLogIdentifier(undefined)).toBeUndefined();
  });

  describe('parseBleMtuReadyLogPayload', () => {
    it('builds structured telemetry from the SDK MTU-ready log', () => {
      expect(
        serviceHardwareUtils.parseBleMtuReadyLogPayload([
          '@onekey/hd-ble-transport',
          '[ReactNativeBleTransport] BLE MTU ready',
          '{"platform":"ios","requested":247,"actual":23}',
        ]),
      ).toEqual({
        transportType: 'ble',
        blePlatform: 'ios',
        requestedMtu: 247,
        actualMtu: 23,
        isDefaultMtu: true,
      });
    });

    it('keeps an unavailable negotiated MTU distinguishable from the default', () => {
      expect(
        serviceHardwareUtils.parseBleMtuReadyLogPayload([
          '@onekey/hd-ble-transport',
          '[ReactNativeBleTransport] BLE MTU ready',
          '{"platform":"android","requested":247}',
        ]),
      ).toEqual({
        transportType: 'ble',
        blePlatform: 'android',
        requestedMtu: 247,
        actualMtu: undefined,
        isDefaultMtu: undefined,
      });
    });

    it.each([
      ['an unrelated event', ['@onekey/hd-ble-transport', 'other event']],
      [
        'malformed JSON',
        [
          '@onekey/hd-ble-transport',
          '[ReactNativeBleTransport] BLE MTU ready',
          '{bad-json}',
        ],
      ],
      [
        'unsupported fields',
        [
          '@onekey/hd-ble-transport',
          '[ReactNativeBleTransport] BLE MTU ready',
          '{"platform":"web","requested":247,"actual":23}',
        ],
      ],
    ])('ignores %s', (_name, payload) => {
      expect(
        serviceHardwareUtils.parseBleMtuReadyLogPayload(payload),
      ).toBeUndefined();
    });

    it('reports each distinct MTU result only once per runtime', () => {
      const reportedSignatures = new Set<string>();
      const defaultMtu = {
        transportType: 'ble' as const,
        blePlatform: 'ios' as const,
        requestedMtu: 247,
        actualMtu: 23,
        isDefaultMtu: true,
      };

      expect(
        serviceHardwareUtils.shouldReportBleMtuReadyTelemetry(
          reportedSignatures,
          defaultMtu,
        ),
      ).toBe(true);
      expect(
        serviceHardwareUtils.shouldReportBleMtuReadyTelemetry(
          reportedSignatures,
          defaultMtu,
        ),
      ).toBe(false);
      expect(
        serviceHardwareUtils.shouldReportBleMtuReadyTelemetry(
          reportedSignatures,
          { ...defaultMtu, actualMtu: 247, isDefaultMtu: false },
        ),
      ).toBe(true);
    });
  });
});
