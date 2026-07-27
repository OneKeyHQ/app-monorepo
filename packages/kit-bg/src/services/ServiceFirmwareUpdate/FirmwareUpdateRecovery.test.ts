import { EFirmwareType } from '@onekeyfe/hd-shared';

import ServiceFirmwareUpdate from './ServiceFirmwareUpdate';

import type {
  CoreApi,
  FirmwareCheckpoint,
  FirmwareUpdatePlan,
} from '@onekeyfe/hd-core';

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getAllDevices: jest.fn(async () => ({ devices: [] })),
  },
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  const methodDecorator =
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor;
  return {
    ...actual,
    backgroundClass: () => (target: unknown) => target,
    backgroundMethod: methodDecorator,
    toastIfError: methodDecorator,
  };
});

const reference = (sha256: string) => ({
  artifactRef: `fw:${sha256}`,
  size: 4,
  sha256,
});

type IServiceFirmwareUpdateRecoveryInternals = {
  bindFirmwareCheckpoint: (
    transactionId: string,
    checkpointSequenceStart: number,
    resumeCheckpoint?: FirmwareCheckpoint,
  ) => unknown;
  bindFirmwareHostBinding: (
    transactionId: string,
    prepared: unknown,
    sdk: CoreApi,
  ) => number;
  executePreparedFirmwareV2Recovery: (params: {
    connectId: string | undefined;
    plan: FirmwareUpdatePlan;
    prepared: unknown;
  }) => Promise<void>;
};

describe('firmware update recovery', () => {
  test('continues V2 after the last durably verified phase without replaying it', async () => {
    const bootloader = reference('a'.repeat(64));
    const firmware = reference('b'.repeat(64));
    const ble = reference('c'.repeat(64));
    const plan: FirmwareUpdatePlan = {
      schemaVersion: 1,
      planDigest: 'd'.repeat(64),
      executor: 'v2',
      deviceIdentity: 'device-1',
      deviceModel: 'classic1s',
      firmwareType: EFirmwareType.Universal,
      platform: 'desktop',
      artifacts: [
        {
          artifactId: 'bootloader',
          role: 'bootloader',
          target: 'bootloader',
          url: 'https://example.invalid/bootloader.bin',
          container: 'raw',
          expectedSize: bootloader.size,
          expectedSha256: bootloader.sha256,
        },
        {
          artifactId: 'firmware',
          role: 'firmware',
          target: 'firmware',
          url: 'https://example.invalid/firmware.bin',
          container: 'raw',
          expectedSize: firmware.size,
          expectedSha256: firmware.sha256,
        },
        {
          artifactId: 'ble',
          role: 'ble',
          target: 'ble',
          url: 'https://example.invalid/ble.bin',
          container: 'raw',
          expectedSize: ble.size,
          expectedSha256: ble.sha256,
        },
      ],
      epochs: [
        {
          epoch: 0,
          kind: 'legacy-update',
          artifactIds: ['firmware', 'bootloader', 'ble'],
          targets: ['firmware', 'bootloader', 'ble'],
        },
        {
          epoch: 1,
          kind: 'final-verify',
          artifactIds: [],
          targets: ['firmware', 'bootloader', 'ble'],
        },
      ],
      targetsToUpdate: ['firmware', 'bootloader', 'ble'],
    };
    type IV2CallParams = {
      updateType: 'firmware' | 'ble';
      artifact: { artifactRef: string };
      hostBindingGeneration: number;
      resumeCheckpoint?: FirmwareCheckpoint;
      url?: string;
    };
    const firmwareUpdateV2 = jest.fn(
      async (_id: string | undefined, _params: IV2CallParams) => ({
        success: true,
        payload: { message: 'success' },
      }),
    );
    const deviceUpdateBootloader = jest.fn();
    const sdk = {
      firmwareUpdateV2,
      deviceUpdateBootloader,
      registerFirmwareUpdateHostBinding: jest.fn(() => 7),
      unregisterFirmwareUpdateHostBinding: jest.fn(() => true),
    } as unknown as CoreApi;
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardware: {
          getSDKInstance: jest.fn(async () => sdk),
        },
      },
    });
    const resumeCheckpoint: FirmwareCheckpoint = {
      schemaVersion: 1,
      sequence: 3,
      stage: 'FINAL_VERIFIED',
      destructiveActionStarted: true,
      target: 'bootloader',
    };
    const transactionId = 'fwtx:00000000-0000-4000-8000-000000000001';
    const serviceInternals =
      service as unknown as IServiceFirmwareUpdateRecoveryInternals;
    serviceInternals.bindFirmwareCheckpoint(
      transactionId,
      resumeCheckpoint.sequence,
      resumeCheckpoint,
    );

    const prepared = {
      transactionId,
      leaseRef: 'fwlease:00000000-0000-4000-8000-000000000002',
      plan,
      artifactsById: { bootloader, firmware, ble },
      selected: {
        bootloader,
        firmware,
        ble,
        componentArtifacts: {},
        resourceBundleArtifacts: [],
      },
      artifactReader: {
        open: jest.fn(),
        read: jest.fn(),
        close: jest.fn(),
      },
    };
    serviceInternals.bindFirmwareHostBinding(transactionId, prepared, sdk);

    await serviceInternals.executePreparedFirmwareV2Recovery({
      connectId: undefined,
      plan,
      prepared,
    });

    expect(deviceUpdateBootloader).not.toHaveBeenCalled();
    expect(firmwareUpdateV2).toHaveBeenCalledTimes(1);
    expect(
      firmwareUpdateV2.mock.calls.map(([, params]) => params.updateType),
    ).toEqual(['ble']);
    for (const [, params] of firmwareUpdateV2.mock.calls) {
      expect(params).not.toHaveProperty('url');
      expect(params).not.toHaveProperty('artifactReader');
      expect(params.hostBindingGeneration).toBe(7);
      expect(params.artifact.artifactRef).toMatch(/^fw:/u);
      expect(params.resumeCheckpoint).toEqual(resumeCheckpoint);
    }
  });
});
