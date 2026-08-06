import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  executeFirmwareArtifactSelfTest,
  getFirmwareArtifactSelfTestArtifact,
  getFirmwareArtifactSelfTestErrorCode,
} from './FirmwareArtifactSelfTest';
import { getFirmwareManifestSnapshot } from './FirmwareManifestProvider';
import { getTrustedFirmwareArtifact } from './trustedFirmwareCatalog';

import type { IPreparedFirmwareArtifacts } from './FirmwareArtifactPreflight';
import type {
  FirmwarePreparedArtifactController,
  IFirmwarePreparedArtifactReleaseResult,
} from './FirmwarePreparedArtifactController';
import type {
  CoreApi,
  FirmwareUpdatePlan,
  FirmwareUpdatePreparedPlan,
  RemoteConfigResponse,
} from '@onekeyfe/hd-core';

jest.mock('./FirmwareManifestProvider', () => ({
  getFirmwareManifestSnapshot: jest.fn(),
}));

jest.mock('./trustedFirmwareCatalog', () => ({
  getTrustedFirmwareArtifact: jest.fn(),
}));

const mockedGetFirmwareManifestSnapshot = jest.mocked(
  getFirmwareManifestSnapshot,
);
const mockedGetTrustedFirmwareArtifact = jest.mocked(
  getTrustedFirmwareArtifact,
);
const mockFirmwareSha256 = '1'.repeat(64);
const mockResourceSha256 = '2'.repeat(64);
const mockResourceEntrySha256 = '3'.repeat(64);
const mockRemoteConfig = {
  pro: {
    firmware: [],
    ble: [],
    'firmware-v8': [
      {
        required: false,
        version: [4, 21, 0],
        url: 'https://firmware.example/pro.bin',
        fingerprint: mockFirmwareSha256,
        expectedSize: 1024 * 1024,
        resource: 'https://firmware.example/pro-resources.zip',
        resourceFingerprint: mockResourceSha256,
        resourceExpectedSize: 512 * 1024,
        fullResource: 'https://firmware.example/pro-full-resources.zip',
        fullResourceFingerprint: '4'.repeat(64),
        fullResourceExpectedSize: 2 * 1024 * 1024,
        changelog: { 'en-US': '', 'zh-CN': '' },
      },
    ],
  },
} as unknown as RemoteConfigResponse;

const createSdk = () => {
  const prepareFirmwareUpdatePlan = jest.fn(
    ({ plan }: Parameters<CoreApi['prepareFirmwareUpdatePlan']>[0]) =>
      ({
        preparedPlanDigest: 'd'.repeat(64),
        planDigest: plan.planDigest,
      }) as FirmwareUpdatePreparedPlan,
  );
  const firmwareUpdateV3 = jest.fn(async () => ({
    success: false as const,
    payload: { code: 'DeviceNotFound', error: 'Device not found' },
  }));
  const sdk = {
    getFirmwareUpdateCapabilities: () => ({
      planSchemaVersion: 2 as const,
      preparedPlanSchemaVersion: 2 as const,
      hostBindingProtocolVersion: 2 as const,
      manifestModes: ['external-only', 'sdk-managed'] as const,
      supportsArtifactReader: true as const,
    }),
    prepareFirmwareUpdatePlan,
    validateFirmwareUpdatePreparedPlan: (plan: FirmwareUpdatePreparedPlan) =>
      plan,
    registerFirmwareUpdateHostBinding: jest.fn(() => 7),
    unregisterFirmwareUpdateHostBinding: jest.fn(() => true),
    firmwareUpdateV3,
  } as unknown as CoreApi;
  return { sdk, firmwareUpdateV3, prepareFirmwareUpdatePlan };
};

const createController = async ({
  scenario,
  read,
  getReleaseResult,
}: {
  scenario: 'pro-firmware' | 'pro-resource';
  read?: IPreparedFirmwareArtifacts['artifactReader']['read'];
  getReleaseResult?: (
    transactionId: string,
  ) => IFirmwarePreparedArtifactReleaseResult;
}) => {
  const { artifact, artifactId } =
    await getFirmwareArtifactSelfTestArtifact(scenario);
  const expectedSize = artifact.expectedSize;
  const expectedSha256 = artifact.expectedSha256;
  if (expectedSize === undefined || expectedSha256 === undefined) {
    throw new OneKeyLocalError('Test fixture integrity metadata is missing');
  }
  const open = jest.fn(async () => ({
    readerId: 'reader-1',
    size: expectedSize,
  }));
  const readImpl: IPreparedFirmwareArtifacts['artifactReader']['read'] =
    read ??
    (async ({ offset, length }) => ({
      data: new ArrayBuffer(length),
      bytesRead: length,
      eof: offset + length === artifact.expectedSize,
    }));
  const readMock = jest.fn(readImpl);
  const close = jest.fn(async () => undefined);
  const dispositions: ('completed' | 'safeCancelled')[] = [];
  const sweepOrphanedArtifacts = jest.fn(async () => ({
    deletedFiles: 2,
    deletedBytes: 4096,
  }));

  const withPreparedPlanArtifacts: FirmwarePreparedArtifactController['withPreparedPlanArtifacts'] =
    async <T>(
      {
        plan,
        sdk,
        transactionId = 'fwtx:test',
      }: {
        plan: FirmwareUpdatePlan;
        sdk: CoreApi;
        transactionId?: string;
      },
      execute: (prepared: IPreparedFirmwareArtifacts) => Promise<T>,
      onReleased?: (result: IFirmwarePreparedArtifactReleaseResult) => void,
    ): Promise<T> => {
      // cspell:disable-next-line
      const leaseRef = `fwlease:${transactionId}`;
      const receipt = {
        artifactRef: `fw:${expectedSha256}`,
        size: expectedSize,
        sha256: expectedSha256,
      };
      const preparedPlan = sdk.prepareFirmwareUpdatePlan({
        plan,
        leaseRef,
        artifacts: [
          {
            artifactId,
            artifact: receipt,
          },
        ],
      });
      const prepared = {
        transactionId,
        leaseRef,
        plan,
        preparedPlan,
        artifactsById: { [artifactId]: receipt },
        selected: {
          ...(artifactId === 'firmware' ? { firmware: receipt } : {}),
          componentArtifacts: {},
          resourceBundleArtifacts: [],
        },
        artifactReader: {
          open,
          read: readMock,
          close,
        },
      } as IPreparedFirmwareArtifacts;

      let disposition: 'completed' | 'safeCancelled' = 'safeCancelled';
      try {
        const result = await execute(prepared);
        disposition = 'completed';
        return result;
      } finally {
        dispositions.push(disposition);
        onReleased?.(
          getReleaseResult?.(transactionId) ?? {
            hostBindingReleased: true,
            leaseReleased: true,
          },
        );
      }
    };

  const controller = {
    withPreparedPlanArtifacts: jest.fn(withPreparedPlanArtifacts),
    getExecutionArtifacts: jest.fn(
      (preparedArtifacts: IPreparedFirmwareArtifacts) => ({
        preparedArtifacts,
        hostBindingGeneration: 7,
      }),
    ),
    sweepOrphanedArtifacts,
  } as unknown as Pick<
    FirmwarePreparedArtifactController,
    | 'getExecutionArtifacts'
    | 'sweepOrphanedArtifacts'
    | 'withPreparedPlanArtifacts'
  >;
  return {
    artifact,
    close,
    controller,
    dispositions,
    open,
    read: readMock,
    sweepOrphanedArtifacts,
  };
};

describe('FirmwareArtifactSelfTest', () => {
  beforeEach(() => {
    mockedGetFirmwareManifestSnapshot.mockResolvedValue(mockRemoteConfig);
    mockedGetTrustedFirmwareArtifact.mockImplementation(async (url) => {
      if (url === 'https://firmware.example/pro.bin') {
        return {
          url,
          role: 'firmware',
          expectedSize: 1024 * 1024,
          expectedSha256: mockFirmwareSha256,
          container: 'raw',
        };
      }
      if (url === 'https://firmware.example/pro-resources.zip') {
        return {
          url,
          role: 'resource',
          expectedSize: 512 * 1024,
          expectedSha256: mockResourceSha256,
          container: 'zip',
          expectedEntries: [
            {
              artifactId: 'resource-entry',
              entryName: 'resource.bin',
              expectedSize: 1024,
              expectedSha256: mockResourceEntrySha256,
            },
          ],
        };
      }
      return {
        url,
        role: 'fullResource',
        expectedSize: 2 * 1024 * 1024,
        expectedSha256: '4'.repeat(64),
        container: 'zip',
        expectedEntries: [
          {
            artifactId: 'full-resource-entry',
            entryName: 'full-resource.bin',
            expectedSize: 2048,
            expectedSha256: '5'.repeat(64),
          },
        ],
      };
    });
  });

  it('runs the production firmware handoff and 50 cached preflight cycles', async () => {
    const fixture = await createController({ scenario: 'pro-firmware' });
    const sdkFixture = createSdk();
    const progress = jest.fn();

    const result = await executeFirmwareArtifactSelfTest({
      scenario: 'pro-firmware',
      transactionId: 'fwtx:test-firmware',
      sdk: sdkFixture.sdk,
      controller: fixture.controller,
      onProgress: progress,
    });

    expect(result.bytesRead).toBe(fixture.artifact.expectedSize);
    expect(result.chunkCount).toBeGreaterThan(1);
    expect(result.preflightCompletedIterations).toBe(50);
    expect(result).toEqual(
      expect.objectContaining({
        preparedPlanValidated: true,
        sdkHandoffValidated: true,
        cleanupValidated: true,
        failureCleanupValidated: true,
        sdkBoundaryCode: 'DeviceNotFound',
        deletedFiles: 2,
        deletedBytes: 4096,
      }),
    );
    expect(fixture.controller.withPreparedPlanArtifacts).toHaveBeenCalledTimes(
      52,
    );
    expect(fixture.open).toHaveBeenCalledTimes(51);
    expect(fixture.close).toHaveBeenCalledTimes(51);
    expect(fixture.dispositions).toEqual([
      ...Array.from({ length: 51 }, () => 'completed' as const),
      'safeCancelled',
    ]);
    expect(sdkFixture.firmwareUpdateV3).toHaveBeenCalledTimes(1);
    expect(sdkFixture.firmwareUpdateV3).toHaveBeenCalledWith(
      '__firmware_sdk_self_test_no_device__',
      expect.objectContaining({
        preparedPlan: expect.any(Object),
        platform: expect.any(String),
        firmwareVersion: [4, 21, 0],
        hostBindingGeneration: 7,
        artifacts: expect.objectContaining({
          firmware: expect.objectContaining({
            size: fixture.artifact.expectedSize,
          }),
        }),
      }),
    );
    expect(progress).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: 'sweeping', progress: 99 }),
    );
  });

  it('uses bundled archive metadata when it is absent from config.json', async () => {
    const result = await getFirmwareArtifactSelfTestArtifact('pro-resource');

    expect(result).toEqual(
      expect.objectContaining({
        artifactId: 'resource',
        artifact: expect.objectContaining({
          container: 'zip',
          url: 'https://firmware.example/pro-resources.zip',
        }),
      }),
    );
    expect(result.artifact.expectedEntries).toEqual([
      expect.objectContaining({
        entryName: 'resource.bin',
        expectedSha256: mockResourceEntrySha256,
      }),
    ]);
  });

  it('closes the production reader and releases with safeCancelled on failure', async () => {
    const fixture = await createController({
      scenario: 'pro-firmware',
      read: async ({ length }) => ({
        data: new ArrayBuffer(length - 1),
        bytesRead: length - 1,
        eof: false,
      }),
    });
    const { sdk } = createSdk();

    await expect(
      executeFirmwareArtifactSelfTest({
        scenario: 'pro-firmware',
        transactionId: 'fwtx:test-reader',
        sdk,
        controller: fixture.controller,
        onProgress: jest.fn(),
      }),
    ).rejects.toThrow('ARTIFACT_READER_CHUNK_INVALID');

    expect(fixture.close).toHaveBeenCalledWith({ readerId: 'reader-1' });
    expect(fixture.dispositions).toEqual(['safeCancelled']);
    expect(fixture.sweepOrphanedArtifacts).not.toHaveBeenCalled();
  });

  it('fails if the controlled production cleanup does not release the lease', async () => {
    const fixture = await createController({
      scenario: 'pro-firmware',
      getReleaseResult: (transactionId) => ({
        hostBindingReleased: true,
        leaseReleased: !transactionId.endsWith(':failure-cleanup'),
      }),
    });
    const { sdk } = createSdk();

    await expect(
      executeFirmwareArtifactSelfTest({
        scenario: 'pro-firmware',
        transactionId: 'fwtx:test-cleanup',
        sdk,
        controller: fixture.controller,
        onProgress: jest.fn(),
      }),
    ).rejects.toThrow('ARTIFACT_FAILURE_CLEANUP_FAILED');
  });

  it('exposes only stable error codes', () => {
    expect(
      getFirmwareArtifactSelfTestErrorCode(
        new OneKeyLocalError('ARTIFACT_HTTP_503: unavailable'),
      ),
    ).toBe('ARTIFACT_HTTP_503');
    expect(
      getFirmwareArtifactSelfTestErrorCode(
        new Error('https://secret.example/path failed'),
      ),
    ).toBe('SELF_TEST_FAILED');
  });
});
