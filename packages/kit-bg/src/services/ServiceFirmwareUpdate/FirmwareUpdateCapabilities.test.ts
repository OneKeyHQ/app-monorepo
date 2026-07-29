import { EFirmwareType } from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import loggerUtils from '@onekeyhq/shared/src/logger/utils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import { firmwareArtifactAdapter } from './FirmwareArtifactAdapter';
import {
  cancelFirmwareArtifactPreparations,
  downloadTrustedFirmwareArtifact,
  getBridgeFirmwareV3BinaryParams,
  getBridgeFirmwareV4BinaryParams,
  isExternalFirmwareCapabilityReady,
  isFirmwareArtifactCapabilityReadyValue,
  prepareBridgeFirmwareBinaries,
  prepareFirmwareArtifacts,
} from './FirmwareArtifactPreflight';
import { FirmwarePreparedArtifactController } from './FirmwarePreparedArtifactController';
import {
  executePreparedFirmwareUpdateV2,
  executePreparedFirmwareUpdateV3,
} from './FirmwarePreparedExecution';
import { getTrustedFirmwareArtifact } from './trustedFirmwareCatalog';

import type { IPreparedFirmwareArtifacts } from './FirmwareArtifactPreflight';
import type { CoreApi, FirmwareUpdatePlan } from '@onekeyfe/hd-core';

const ready = {
  planSchemaVersion: 2,
  preparedPlanSchemaVersion: 2,
  hostBindingProtocolVersion: 2,
  manifestModes: ['external-only', 'sdk-managed'],
  supportsArtifactReader: true,
};

describe('isExternalFirmwareCapabilityReady', () => {
  test('requires the exact cross-repo capability contract', () => {
    expect(isExternalFirmwareCapabilityReady(ready)).toBe(true);
    expect(
      isExternalFirmwareCapabilityReady({
        ...ready,
        planSchemaVersion: 1,
      }),
    ).toBe(false);
    expect(
      isExternalFirmwareCapabilityReady({
        ...ready,
        unexpected: true,
      }),
    ).toBe(false);
  });

  test('requires the exact native artifact protocol and bounded reader contract', () => {
    const nativeReady = {
      firmwareArtifactProtocolVersion: 2,
      maxReadBytes: 256 * 1024,
      supportsArchiveMaterialization: true,
      supportedRouteTypes: ['domain', 'pinnedIp'],
    };
    expect(isFirmwareArtifactCapabilityReadyValue(nativeReady)).toBe(true);
    expect(
      isFirmwareArtifactCapabilityReadyValue({
        ...nativeReady,
        maxReadBytes: 512 * 1024,
      }),
    ).toBe(false);
    expect(
      isFirmwareArtifactCapabilityReadyValue({
        ...nativeReady,
        supportedRouteTypes: ['pinnedIp'],
      }),
    ).toBe(false);
  });
});

describe('prepared firmware execution', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createController = () =>
    new FirmwarePreparedArtifactController({
      getHardwareTransportType: async () => EHardwareTransportType.Bridge,
      getSDKInstance: async () => ({}) as CoreApi,
    });

  const createPreparedArtifacts = (
    selected: Partial<IPreparedFirmwareArtifacts['selected']> = {},
  ) =>
    ({
      transactionId: 'fwtx:test',
      leaseRef: 'fwlease:test',
      preparedPlan: {},
      plan: { deviceIdentity: 'device', artifacts: [] },
      selected: {
        componentArtifacts: {},
        resourceBundleArtifacts: [],
        ...selected,
      },
    }) as unknown as IPreparedFirmwareArtifacts;

  test('releases prepared artifacts with the exact workflow disposition', async () => {
    const controller = createController();
    const prepared = createPreparedArtifacts({});
    jest
      .spyOn(controller, 'prepareWorkflowArtifacts')
      .mockResolvedValue(prepared);
    const release = jest
      .spyOn(controller, 'releasePreparedArtifacts')
      .mockResolvedValue();
    const releaseResult = {} as ICheckAllFirmwareReleaseResult;

    await controller.withWorkflowArtifacts(releaseResult, async () => 'done');
    await expect(
      controller.withWorkflowArtifacts(releaseResult, async () => {
        throw new OneKeyLocalError('install failed');
      }),
    ).rejects.toThrow('install failed');

    expect(release).toHaveBeenNthCalledWith(1, prepared, 'completed');
    expect(release).toHaveBeenNthCalledWith(2, prepared, 'safeCancelled');
  });

  test('never falls back to SDK network for malformed prepared artifacts', () => {
    const firmwareUpdateV2 = jest.fn();
    const sdk = { firmwareUpdateV2 } as unknown as CoreApi;
    const baseParams = {
      sdk,
      connectId: 'device',
      forcedUpdateRes: false,
      platform: 'native' as const,
      firmwareType: EFirmwareType.Universal,
      version: [1, 0, 0],
    };

    expect(() =>
      executePreparedFirmwareUpdateV2({
        ...baseParams,
        updateType: 'firmware',
        preparedArtifacts: createPreparedArtifacts({}),
        hostBindingGeneration: 1,
      }),
    ).toThrow('Prepared firmware artifact is unavailable');
    expect(() =>
      executePreparedFirmwareUpdateV2({
        ...baseParams,
        updateType: 'firmware',
        preparedArtifacts: createPreparedArtifacts({
          firmware: {} as NonNullable<
            IPreparedFirmwareArtifacts['selected']['firmware']
          >,
        }),
      }),
    ).toThrow('Firmware host binding is unavailable');
    expect(firmwareUpdateV2).not.toHaveBeenCalled();
  });

  test('logs and passes matching prepared firmware and resource inputs to V3', async () => {
    const firmwareUpdateV3 = jest.fn();
    const sdk = { firmwareUpdateV3 } as unknown as CoreApi;
    const firmware = {
      artifactRef: 'fw:firmware',
      size: 4,
      sha256: 'a'.repeat(64),
    };
    const resource = {
      artifactRef: 'fw:resource',
      size: 6,
      sha256: 'b'.repeat(64),
    };
    const prepared = createPreparedArtifacts({
      firmware,
      resourceEntries: [{ entryName: 'resource.bin', artifact: resource }],
    });
    prepared.artifactsById = { firmware, resource };
    prepared.plan.executor = 'v3';
    const controller = createController();
    jest
      .spyOn(controller, 'getExecutionBindingParams')
      .mockReturnValue({ hostBindingGeneration: 105 });
    const localLog = jest
      .spyOn(loggerUtils, 'consoleFunc')
      .mockImplementation(() => undefined);
    const executionArtifacts = controller.getExecutionArtifacts(
      prepared,
      'firmwareUpdateV3',
    );

    await executePreparedFirmwareUpdateV3({
      sdk,
      connectId: 'device',
      ...executionArtifacts,
      platform: 'native',
      firmwareType: EFirmwareType.Universal,
      bleVersion: undefined,
      firmwareVersion: [4, 21, 0],
      bootloaderVersion: undefined,
    });

    expect(firmwareUpdateV3).toHaveBeenCalledWith(
      'device',
      expect.objectContaining({
        preparedPlan: prepared.preparedPlan,
        hostBindingGeneration: 105,
        artifacts: {
          firmware,
          resourceEntries: [{ entryName: 'resource.bin', artifact: resource }],
        },
      }),
    );
    expect(localLog).toHaveBeenCalledWith(
      expect.stringContaining(
        '"stage":"sdk-handoff","executor":"v3","sdkMethod":"firmwareUpdateV3"',
      ),
    );
    expect(localLog).toHaveBeenCalledWith(
      expect.stringContaining(
        '"artifacts":{"count":2,"bytes":10,"firmwareBytes":4,"resourceCount":1,"resourceBytes":6,"integrityVerified":true}',
      ),
    );
  });

  test('logs and passes Desktop Bridge binaries without claiming a resource input', async () => {
    const firmwareUpdateV3 = jest.fn();
    const sdk = { firmwareUpdateV3 } as unknown as CoreApi;
    const firmware = new ArrayBuffer(4);
    const controller = createController();
    const localLog = jest
      .spyOn(loggerUtils, 'consoleFunc')
      .mockImplementation(() => undefined);
    const executionArtifacts = controller.getExecutionArtifacts(
      {
        transactionId: 'bridge:test',
        executor: 'v3',
        planDigest: 'a'.repeat(64),
        targetBinaries: { firmware },
      },
      'firmwareUpdateV3',
    );

    await executePreparedFirmwareUpdateV3({
      sdk,
      connectId: 'device',
      ...executionArtifacts,
      platform: 'desktop',
      firmwareType: EFirmwareType.Universal,
      bleVersion: undefined,
      firmwareVersion: [4, 21, 0],
      bootloaderVersion: undefined,
    });

    expect(firmwareUpdateV3).toHaveBeenCalledWith(
      'device',
      expect.objectContaining({
        firmwareBinary: firmware,
      }),
    );
    expect(firmwareUpdateV3.mock.calls[0][1]).not.toHaveProperty(
      'resourceBinary',
    );
    expect(localLog).toHaveBeenCalledWith(
      expect.stringContaining(
        '"artifacts":{"count":1,"bytes":4,"firmwareBytes":4,"resourceCount":0,"resourceBytes":0,"integrityVerified":true}',
      ),
    );
  });

  test('uses artifact capability to enable Desktop Bridge plan caching', async () => {
    const previousPlatform = {
      isDesktop: platformEnv.isDesktop,
      appPlatform: platformEnv.appPlatform,
      symbol: platformEnv.symbol,
    };
    Object.assign(platformEnv, {
      isDesktop: true,
      appPlatform: 'desktop',
      symbol: 'desktop',
    });
    try {
      jest
        .spyOn(loggerUtils, 'consoleFunc')
        .mockImplementation(() => undefined);
      jest.spyOn(firmwareArtifactAdapter, 'getCapabilities').mockReturnValue({
        firmwareArtifactProtocolVersion: 2,
        maxReadBytes: 256 * 1024,
        supportsArchiveMaterialization: true,
        supportedRouteTypes: ['domain', 'pinnedIp'],
      });
      const controller = createController();
      const plan = {
        planDigest: 'a'.repeat(64),
        deviceIdentity: 'device',
        deviceModel: 'pro',
        platform: 'desktop',
        artifacts: [],
      } as unknown as FirmwareUpdatePlan;

      await expect(
        controller.cachePlanIfPreparedSupported({
          plan,
          connectId: 'device',
          transportType: EHardwareTransportType.Bridge,
        }),
      ).resolves.toBe(true);

      await expect(
        controller.prepareWorkflowArtifacts({
          firmwareUpdatePlanDigest: plan.planDigest,
          deviceUUID: 'device',
          deviceType: 'pro',
        } as unknown as ICheckAllFirmwareReleaseResult),
      ).resolves.toBeUndefined();
    } finally {
      Object.assign(platformEnv, previousPlatform);
    }
  });
});

describe('downloadTrustedFirmwareArtifact', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses the canonical domain route with the remaining deadline', async () => {
    const artifact = await getTrustedFirmwareArtifact(
      'https://common.onekey-asset.com/hw/legacy/bootloader/classic/2.0.0/classic-boot.2.0.0-0510-6d616dc.signed.bin',
    );
    const download = jest
      .spyOn(firmwareArtifactAdapter, 'download')
      .mockResolvedValue({
        artifactRef: `fw:${artifact.expectedSha256}`,
        size: artifact.expectedSize,
        sha256: artifact.expectedSha256,
      });
    const deadlineAt = Date.now() + 20 * 60 * 1000;

    await expect(
      downloadTrustedFirmwareArtifact({
        artifact,
        artifactId: 'bootloader',
        transactionId: 'fwtx:single-route-deadline',
        leaseRef: 'fwlease:single-route-deadline',
        deadlineAt,
      }),
    ).resolves.toMatchObject({
      artifactRef: `fw:${artifact.expectedSha256}`,
    });

    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][0].route).toEqual({
      routeType: 'domain',
    });
    expect(download.mock.calls[0][0].overallDeadlineSeconds).toBeGreaterThan(
      15 * 60,
    );
    expect(
      download.mock.calls[0][0].overallDeadlineSeconds,
    ).toBeLessThanOrEqual(20 * 60);
  });

  test('does not start a download after the preparation deadline', async () => {
    const artifact = await getTrustedFirmwareArtifact(
      'https://common.onekey-asset.com/hw/legacy/bootloader/classic/2.0.0/classic-boot.2.0.0-0510-6d616dc.signed.bin',
    );
    const download = jest.spyOn(firmwareArtifactAdapter, 'download');
    await expect(
      downloadTrustedFirmwareArtifact({
        artifact,
        artifactId: 'bootloader',
        transactionId: 'fwtx:test',
        leaseRef: 'fwlease:test',
        deadlineAt: Date.now() - 1,
      }),
    ).rejects.toThrow('Firmware artifact preparation exceeded its deadline');
    expect(download).not.toHaveBeenCalled();
  });
});

describe('Desktop Bridge firmware binaries', () => {
  const createBridgePlan = async () => {
    const url =
      'https://common.onekey-asset.com/hw/legacy/bootloader/classic/2.0.0/classic-boot.2.0.0-0510-6d616dc.signed.bin';
    const trusted = await getTrustedFirmwareArtifact(url);
    const plan = {
      schemaVersion: 2,
      planDigest: 'a'.repeat(64),
      executor: 'v2',
      deviceIdentity: 'device',
      deviceModel: 'classic',
      firmwareType: EFirmwareType.Universal,
      platform: 'desktop',
      artifacts: [
        {
          artifactId: 'bootloader',
          role: 'bootloader',
          target: 'bootloader',
          url,
          container: 'raw',
          expectedSize: trusted.expectedSize,
          expectedSha256: trusted.expectedSha256,
        },
      ],
      targetsToUpdate: ['bootloader'],
    } as unknown as FirmwareUpdatePlan;
    return { plan, trusted };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('downloads and reads a small admitted artifact before releasing its lease', async () => {
    const { plan, trusted } = await createBridgePlan();
    jest.spyOn(firmwareArtifactAdapter, 'getCapabilities').mockReturnValue({
      firmwareArtifactProtocolVersion: 2,
      maxReadBytes: 256 * 1024,
      supportsArchiveMaterialization: true,
      supportedRouteTypes: ['domain', 'pinnedIp'],
    });
    jest
      .spyOn(firmwareArtifactAdapter, 'createLease')
      .mockResolvedValue({ leaseRef: 'fwlease:test' });
    jest.spyOn(firmwareArtifactAdapter, 'download').mockResolvedValue({
      artifactRef: `fw:${trusted.expectedSha256}`,
      size: trusted.expectedSize,
      sha256: trusted.expectedSha256,
    });
    jest.spyOn(firmwareArtifactAdapter, 'open').mockResolvedValue({
      readerId: 'reader',
      size: trusted.expectedSize,
    });
    const read = jest
      .spyOn(firmwareArtifactAdapter, 'read')
      .mockImplementation(async ({ length }) => new ArrayBuffer(length));
    jest.spyOn(firmwareArtifactAdapter, 'close').mockResolvedValue();
    const release = jest
      .spyOn(firmwareArtifactAdapter, 'releaseLease')
      .mockResolvedValue();

    const result = await prepareBridgeFirmwareBinaries(plan);

    expect(result?.targetBinaries.bootloader?.byteLength).toBe(
      trusted.expectedSize,
    );
    expect(read.mock.calls.every(([input]) => input.length <= 256 * 1024)).toBe(
      true,
    );
    expect(release).toHaveBeenCalledWith({
      leaseRef: 'fwlease:test',
      disposition: 'completed',
    });
  });

  test('uses the bundled catalog when optional plan integrity fields are absent', async () => {
    const { plan, trusted } = await createBridgePlan();
    delete plan.artifacts[0].expectedSize;
    delete plan.artifacts[0].expectedSha256;
    jest.spyOn(firmwareArtifactAdapter, 'getCapabilities').mockReturnValue({
      firmwareArtifactProtocolVersion: 2,
      maxReadBytes: 256 * 1024,
      supportsArchiveMaterialization: true,
      supportedRouteTypes: ['domain', 'pinnedIp'],
    });
    jest
      .spyOn(firmwareArtifactAdapter, 'createLease')
      .mockResolvedValue({ leaseRef: 'fwlease:catalog' });
    const download = jest
      .spyOn(firmwareArtifactAdapter, 'download')
      .mockResolvedValue({
        artifactRef: `fw:${trusted.expectedSha256}`,
        size: trusted.expectedSize,
        sha256: trusted.expectedSha256,
      });
    jest.spyOn(firmwareArtifactAdapter, 'open').mockResolvedValue({
      readerId: 'reader',
      size: trusted.expectedSize,
    });
    jest
      .spyOn(firmwareArtifactAdapter, 'read')
      .mockImplementation(async ({ length }) => new ArrayBuffer(length));
    jest.spyOn(firmwareArtifactAdapter, 'close').mockResolvedValue();
    jest.spyOn(firmwareArtifactAdapter, 'releaseLease').mockResolvedValue();

    await expect(prepareBridgeFirmwareBinaries(plan)).resolves.toBeDefined();
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedSize: trusted.expectedSize,
        expectedSha256: trusted.expectedSha256,
      }),
    );
  });

  test('cancels an active preparation after a download failure', async () => {
    const { plan } = await createBridgePlan();
    jest.spyOn(firmwareArtifactAdapter, 'getCapabilities').mockReturnValue({
      firmwareArtifactProtocolVersion: 2,
      maxReadBytes: 256 * 1024,
      supportsArchiveMaterialization: true,
      supportedRouteTypes: ['domain', 'pinnedIp'],
    });
    jest
      .spyOn(firmwareArtifactAdapter, 'createLease')
      .mockResolvedValue({ leaseRef: 'fwlease:test' });
    let rejectDownload: (reason?: unknown) => void = () => undefined;
    const download = jest
      .spyOn(firmwareArtifactAdapter, 'download')
      .mockImplementation(
        () =>
          new Promise((_resolve, reject) => {
            rejectDownload = reject;
          }),
      );
    const cancel = jest
      .spyOn(firmwareArtifactAdapter, 'cancelDownloads')
      .mockImplementation(async () => {
        rejectDownload(new Error('ARTIFACT_CANCELLED'));
      });
    const release = jest
      .spyOn(firmwareArtifactAdapter, 'releaseLease')
      .mockResolvedValue();

    const preparing = prepareBridgeFirmwareBinaries(plan);
    for (
      let attempt = 0;
      attempt < 10 && !download.mock.calls.length;
      attempt += 1
    ) {
      await Promise.resolve();
    }
    await cancelFirmwareArtifactPreparations();

    await expect(preparing).rejects.toThrow('ARTIFACT_CANCELLED');
    expect(download).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith(expect.stringMatching(/^bridge:/u));
    expect(release).toHaveBeenCalledWith({
      leaseRef: 'fwlease:test',
      disposition: 'safeCancelled',
    });
  });

  test('maps prefetched binaries onto existing V3 and V4 SDK fields', () => {
    const firmware = new ArrayBuffer(1);
    const ble = new ArrayBuffer(2);
    const boot = new ArrayBuffer(3);
    expect(
      getBridgeFirmwareV3BinaryParams({
        transactionId: 'bridge:v3',
        executor: 'v3',
        planDigest: 'a',
        targetBinaries: { firmware, ble, bootloader: boot },
      }),
    ).toEqual({
      firmwareBinary: firmware,
      bleBinary: ble,
      bootloaderBinary: boot,
    });
    expect(
      getBridgeFirmwareV4BinaryParams({
        transactionId: 'bridge:v4',
        executor: 'v4',
        planDigest: 'b',
        targetBinaries: {
          boot,
          app_v1: firmware,
          coprocessor: ble,
        },
      }),
    ).toEqual({
      bootloaderBinary: boot,
      applicationP1Binary: firmware,
      coprocessorBinary: ble,
    });
  });
});

describe('external firmware artifact preparation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('cancels sibling downloads before surfacing a preparation failure', async () => {
    const url =
      'https://common.onekey-asset.com/hw/legacy/bootloader/classic/2.0.0/classic-boot.2.0.0-0510-6d616dc.signed.bin';
    const trusted = await getTrustedFirmwareArtifact(url);
    const artifact = {
      artifactId: 'bootloader',
      role: 'bootloader' as const,
      target: 'bootloader' as const,
      url,
      container: 'raw' as const,
      expectedSize: trusted.expectedSize,
      expectedSha256: trusted.expectedSha256,
    };
    const plan = {
      schemaVersion: 2,
      planDigest: 'a'.repeat(64),
      executor: 'v2',
      deviceIdentity: 'device',
      deviceModel: 'classic',
      firmwareType: EFirmwareType.Universal,
      platform: 'desktop',
      artifacts: [artifact, { ...artifact, artifactId: 'bootloader-copy' }],
      targetsToUpdate: ['bootloader'],
    } as unknown as FirmwareUpdatePlan;
    jest.spyOn(firmwareArtifactAdapter, 'getCapabilities').mockReturnValue({
      firmwareArtifactProtocolVersion: 2,
      maxReadBytes: 256 * 1024,
      supportsArchiveMaterialization: true,
      supportedRouteTypes: ['domain', 'pinnedIp'],
    });
    let rejectSibling: (reason?: unknown) => void = () => undefined;
    const download = jest
      .spyOn(firmwareArtifactAdapter, 'download')
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectSibling = reject;
          }),
      )
      .mockRejectedValueOnce(
        new Error('ARTIFACT_TLS_FAILED: firmware TLS validation failed'),
      );
    const cancel = jest
      .spyOn(firmwareArtifactAdapter, 'cancelDownloads')
      .mockImplementation(async () => {
        rejectSibling(new Error('ARTIFACT_CANCELLED'));
      });

    await expect(
      prepareFirmwareArtifacts(plan, {
        transactionId: 'fwtx:test',
        leaseRef: 'fwlease:test',
        preparePlan: jest.fn(),
      }),
    ).rejects.toThrow('ARTIFACT_TLS_FAILED');
    expect(download).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith('fwtx:test');
  });
});
