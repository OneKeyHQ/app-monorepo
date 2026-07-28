import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  executeFirmwareArtifactSelfTest,
  getFirmwareArtifactSelfTestArtifact,
  getFirmwareArtifactSelfTestErrorCode,
} from './FirmwareArtifactSelfTest';

import type { IFirmwareArtifactAdapter } from './FirmwareArtifactAdapter.types';
import type { downloadTrustedFirmwareArtifact } from './FirmwareArtifactPreflight';
import type { CoreApi, FirmwareUpdatePreparedPlan } from '@onekeyfe/hd-core';

const createAdapter = ({
  size,
  read,
}: {
  size: number;
  read?: IFirmwareArtifactAdapter['read'];
}) => {
  const readMock =
    read ?? jest.fn(async ({ length }) => new ArrayBuffer(length));
  const materializeImpl: IFirmwareArtifactAdapter['materialize'] = async ({
    expectedEntries,
  }) =>
    Promise.resolve(
      expectedEntries.map((entry) => ({
        entryName: entry.entryName,
        receipt: {
          artifactRef: `fw:${entry.expectedSha256}`,
          size: entry.expectedSize,
          sha256: entry.expectedSha256,
        },
      })),
    );
  const materialize = jest.fn(materializeImpl);
  const close = jest.fn(async () => undefined);
  const releaseLease = jest.fn(async () => undefined);
  const sweepOrphans = jest.fn(async () => ({
    deletedFiles: 2,
    deletedBytes: 4096,
  }));
  const adapter: IFirmwareArtifactAdapter = {
    getCapabilities: async () => ({
      firmwareArtifactProtocolVersion: 2,
      supportedRouteTypes: ['domain', 'pinnedIp'],
      supportsArchiveMaterialization: true,
      maxReadBytes: 256 * 1024,
    }),
    download: jest.fn(),
    cancelDownloads: jest.fn(),
    materialize,
    open: jest.fn(async () => ({ readerId: 'reader-1', size })),
    read: readMock,
    close,
    createLease: jest.fn(async () => ({ leaseRef: 'fwlease:test' })),
    retain: jest.fn(async () => undefined),
    releaseLease,
    sweepOrphans,
  };
  return {
    adapter,
    close,
    materialize,
    read: readMock,
    releaseLease,
    sweepOrphans,
  };
};

const createDownload = async (
  scenario: 'pro-firmware' | 'pro-resource',
): Promise<typeof downloadTrustedFirmwareArtifact> => {
  const { artifact } = await getFirmwareArtifactSelfTestArtifact(scenario);
  return jest.fn(async () => ({
    artifactRef: `fw:${artifact.expectedSha256}`,
    size: artifact.expectedSize,
    sha256: artifact.expectedSha256,
  }));
};

const createSdk = () => {
  const prepareFirmwareUpdatePlan = jest.fn(
    ({ plan }: Parameters<CoreApi['prepareFirmwareUpdatePlan']>[0]) =>
      ({
        preparedPlanDigest: 'd'.repeat(64),
        planDigest: plan.planDigest,
      }) as FirmwareUpdatePreparedPlan,
  );
  const unregisterFirmwareUpdateHostBinding = jest.fn(() => true);
  const firmwareUpdateV3 = jest
    .fn()
    .mockResolvedValueOnce({
      success: false,
      payload: { code: 'DeviceNotFound', error: 'Device not found' },
    })
    .mockResolvedValueOnce({
      success: false,
      payload: {
        code: 'RuntimeError',
        error: 'Firmware prepared plan artifact binding is invalid',
      },
    })
    .mockResolvedValueOnce({
      success: false,
      payload: {
        code: 'RuntimeError',
        error: 'Firmware host binding generation 7 is stale',
      },
    });
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
    unregisterFirmwareUpdateHostBinding,
    firmwareUpdateV3,
  } as unknown as Pick<
    CoreApi,
    | 'firmwareUpdateV3'
    | 'getFirmwareUpdateCapabilities'
    | 'prepareFirmwareUpdatePlan'
    | 'validateFirmwareUpdatePreparedPlan'
    | 'registerFirmwareUpdateHostBinding'
    | 'unregisterFirmwareUpdateHostBinding'
  >;
  return {
    sdk,
    firmwareUpdateV3,
    unregisterFirmwareUpdateHostBinding,
  };
};

describe('FirmwareArtifactSelfTest', () => {
  it('reads every firmware byte in bounded chunks and releases the lease', async () => {
    const { artifact } =
      await getFirmwareArtifactSelfTestArtifact('pro-firmware');
    const { adapter, read, releaseLease } = createAdapter({
      size: artifact.expectedSize,
    });
    const progress = jest.fn();
    const sdkFixture = createSdk();

    const result = await executeFirmwareArtifactSelfTest({
      scenario: 'pro-firmware',
      transactionId: 'fwtx:test-firmware',
      leaseRef: 'fwlease:test',
      sdk: sdkFixture.sdk,
      onProgress: progress,
      dependencies: {
        adapter,
        download: await createDownload('pro-firmware'),
      },
    });

    expect(result.bytesRead).toBe(artifact.expectedSize);
    expect(result.chunkCount).toBeGreaterThan(1);
    expect(result.materializedEntryCount).toBe(0);
    expect(result).toEqual(
      expect.objectContaining({
        sdkEntryValidated: true,
        sdkIntegrityRejected: true,
        sdkBindingReleased: true,
        sdkBoundaryCode: 'DeviceNotFound',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ deletedFiles: 2, deletedBytes: 4096 }),
    );
    expect(read).toHaveBeenCalledWith(
      expect.objectContaining({ length: expect.any(Number) }),
    );
    expect(releaseLease).toHaveBeenCalledWith({
      leaseRef: 'fwlease:test',
      disposition: 'completed',
    });
    expect(sdkFixture.firmwareUpdateV3).toHaveBeenCalledTimes(3);
    expect(sdkFixture.unregisterFirmwareUpdateHostBinding).toHaveBeenCalledWith(
      7,
    );
    expect(progress).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: 'sweeping', progress: 97 }),
    );
  });

  it('materializes every trusted resource entry', async () => {
    const { artifact } =
      await getFirmwareArtifactSelfTestArtifact('pro-resource');
    const { adapter, materialize } = createAdapter({
      size: artifact.expectedSize,
    });
    const { sdk } = createSdk();

    const result = await executeFirmwareArtifactSelfTest({
      scenario: 'pro-resource',
      transactionId: 'fwtx:test-resource',
      leaseRef: 'fwlease:test',
      sdk,
      onProgress: jest.fn(),
      dependencies: {
        adapter,
        download: await createDownload('pro-resource'),
      },
    });

    expect(artifact.expectedEntries?.length).toBeGreaterThan(0);
    expect(result.materializedEntryCount).toBe(
      artifact.expectedEntries?.length,
    );
    expect(materialize).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedEntries: artifact.expectedEntries,
      }),
    );
  });

  it('marks cancellation as safe and still runs cleanup', async () => {
    const { artifact } =
      await getFirmwareArtifactSelfTestArtifact('pro-firmware');
    const { adapter, releaseLease, sweepOrphans } = createAdapter({
      size: artifact.expectedSize,
    });
    const download = jest.fn(async () => {
      throw new OneKeyLocalError('ARTIFACT_CANCELLED: stopped by test');
    }) as typeof downloadTrustedFirmwareArtifact;
    const { sdk } = createSdk();

    await expect(
      executeFirmwareArtifactSelfTest({
        scenario: 'pro-firmware',
        transactionId: 'fwtx:test-cancel',
        leaseRef: 'fwlease:test',
        sdk,
        onProgress: jest.fn(),
        dependencies: { adapter, download },
      }),
    ).rejects.toThrow('ARTIFACT_CANCELLED');

    expect(releaseLease).toHaveBeenCalledWith({
      leaseRef: 'fwlease:test',
      disposition: 'safeCancelled',
    });
    expect(sweepOrphans).toHaveBeenCalledTimes(1);
  });

  it('closes the reader and safely abandons an incomplete chunk', async () => {
    const { artifact } =
      await getFirmwareArtifactSelfTestArtifact('pro-firmware');
    const { adapter, close, releaseLease } = createAdapter({
      size: artifact.expectedSize,
      read: jest.fn(async ({ length }) => new ArrayBuffer(length - 1)),
    });
    const { sdk } = createSdk();

    await expect(
      executeFirmwareArtifactSelfTest({
        scenario: 'pro-firmware',
        transactionId: 'fwtx:test-reader',
        leaseRef: 'fwlease:test',
        sdk,
        onProgress: jest.fn(),
        dependencies: {
          adapter,
          download: await createDownload('pro-firmware'),
        },
      }),
    ).rejects.toThrow('incomplete chunk');

    expect(close).toHaveBeenCalledWith('reader-1');
    expect(releaseLease).toHaveBeenCalledWith({
      leaseRef: 'fwlease:test',
      disposition: 'safeAbandoned',
    });
  });

  it('exposes only stable error codes', () => {
    expect(
      getFirmwareArtifactSelfTestErrorCode(
        new Error('ARTIFACT_HTTP_503: unavailable'),
      ),
    ).toBe('ARTIFACT_HTTP_503');
    expect(
      getFirmwareArtifactSelfTestErrorCode(
        new Error('https://secret.example/path failed'),
      ),
    ).toBe('SELF_TEST_FAILED');
  });
});
