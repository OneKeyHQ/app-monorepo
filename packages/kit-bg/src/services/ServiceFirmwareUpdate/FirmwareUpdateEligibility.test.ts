import {
  FIRMWARE_UPDATE_COMPATIBILITY_DEV_SETTING_KEYS,
  FirmwareUpdateEligibility,
} from './FirmwareUpdateEligibility';

const DIGEST = 'a'.repeat(64);

const createHarness = () => {
  const calls: string[] = [];
  const journal = new FirmwareUpdateEligibility<{ deviceId: string }>({
    now: () => 1_721_862_400_000,
    digestAttestation: async (value) => {
      calls.push(`digest:${JSON.stringify(value)}`);
      return DIGEST;
    },
    validateFullResource: async () => {
      calls.push('full-resource');
    },
    validateMinimumVersions: async () => {
      calls.push('minimum-versions');
    },
    validateBridge: async () => {
      calls.push('bridge');
    },
    validateBattery: async () => {
      calls.push('battery');
    },
    revalidateConnection: async () => {
      calls.push('connection');
    },
    revalidateIdentity: async () => {
      calls.push('identity');
    },
  });
  return {
    calls,
    eligibility: journal,
  };
};

describe('FirmwareUpdateEligibility', () => {
  it('copies and hashes the exact UI confirmation DTO in bg', async () => {
    const { calls, eligibility } = createHarness();
    const input = {
      backuped: true,
      usbConnected: true,
    };
    const attestation = await eligibility.createUserAttestation(input);
    input.backuped = false;

    expect(attestation).toEqual({
      backuped: true,
      usbConnected: true,
      confirmedAt: 1_721_862_400_000,
      attestationDigest: DIGEST,
    });
    expect(Object.isFrozen(attestation)).toBe(true);
    expect(calls[0]).toContain('"schemaVersion":1');
  });

  it.each([
    [{ backuped: false, usbConnected: true }],
    [{ backuped: true, usbConnected: false }],
    [{ backuped: true, usbConnected: true, releaseResult: {} }],
    [Object.create({ backuped: true, usbConnected: true })],
  ])('rejects invalid or incomplete confirmations', async (input) => {
    const { eligibility } = createHarness();
    await expect(
      eligibility.createUserAttestation(input),
    ).rejects.toMatchObject({
      firmwareUpdateEligibilityCode: 'INVALID_USER_CONFIRMATION',
    });
  });

  it('runs every compatibility gate before artifact acquisition', async () => {
    const { calls, eligibility } = createHarness();
    const attestation = await eligibility.createUserAttestation({
      backuped: true,
      usbConnected: true,
    });
    calls.length = 0;

    await eligibility.assertBeforeAcquisition({
      context: { deviceId: 'device-1' },
      attestation,
    });

    expect(calls).toEqual([
      'full-resource',
      'minimum-versions',
      'bridge',
      'battery',
      'connection',
      'identity',
    ]);
  });

  it('revalidates dynamic device gates immediately before mutation', async () => {
    const { calls, eligibility } = createHarness();
    const attestation = await eligibility.createUserAttestation({
      backuped: true,
      usbConnected: true,
    });
    calls.length = 0;

    await eligibility.assertBeforeDeviceMutation({
      context: { deviceId: 'device-1' },
      attestation,
    });

    expect(calls).toEqual(['connection', 'identity', 'battery']);
  });

  it('retains the complete legacy firmware dev-setting compatibility surface', () => {
    expect(FIRMWARE_UPDATE_COMPATIBILITY_DEV_SETTING_KEYS).toEqual([
      'shouldUpdateBridge',
      'allIsUpToDate',
      'forceUpdateFirmware',
      'forceUpdateBle',
      'forceUpdateBootloader',
      'forceUpdateOnceFirmware',
      'forceUpdateOnceBle',
      'forceUpdateOnceBootloader',
      'forceUpdateResEvenSameVersion',
      'shouldUpdateFullRes',
      'shouldUpdateFromWeb',
      'updateDevDeviceBootloaderOnAppAllowed',
      'lowBatteryLevel',
    ]);
  });
});
