import { EFirmwareType } from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import loggerUtils from '@onekeyhq/shared/src/logger/utils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import { firmwareArtifactAdapter } from './FirmwareArtifactAdapter';
import {
  cancelFirmwareArtifactPreparations,
  downloadFirmwareArtifact,
  getBridgeFirmwareV3BinaryParams,
  getBridgeFirmwareV4BinaryParams,
  isExternalFirmwareCapabilityReady,
  isFirmwareArtifactCapabilityReadyValue,
  prepareBridgeFirmwareBinaries,
  prepareFirmwareArtifacts,
  withFirmwareArtifactStageTimeout,
} from './FirmwareArtifactPreflight';
import { FirmwarePreparedArtifactController } from './FirmwarePreparedArtifactController';
import {
  executePreparedFirmwareUpdateV2,
  executePreparedFirmwareUpdateV3,
} from './FirmwarePreparedExecution';

import type { IPreparedFirmwareArtifacts } from './FirmwareArtifactPreflight';
import type { IFirmwarePreparedArtifactReleaseResult } from './FirmwarePreparedArtifactController';
import type {
  CoreApi,
  FirmwareUpdatePlan,
  FirmwareUpdatePreparedPlan,
} from '@onekeyfe/hd-core';

const ready = {
  planSchemaVersion: 2,
  preparedPlanSchemaVersion: 2,
  hostBindingProtocolVersion: 2,
  manifestModes: ['external-only', 'sdk-managed'],
  supportsArtifactReader: true,
};

const testFirmwareArtifact = {
  url: 'https://firmware.example/bootloader.bin',
  role: 'bootloader' as const,
  expectedSize: 1024,
  expectedSha256: '1'.repeat(64),
  container: 'raw' as const,
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
      firmwareArtifactProtocolVersion: 3,
      maxReadBytes: 256 * 1024,
      supportsArchiveMaterialization: true,
      supportedRouteTypes: ['domain'],
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
        supportedRouteTypes: [],
      }),
    ).toBe(false);
  });
});

describe('firmware artifact stage watchdog', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('fails a hung synchronous native bridge stage without retrying it', async () => {
    jest.useFakeTimers();
    const operation = jest.fn(() => new Promise<never>(() => undefined));
    const pending = withFirmwareArtifactStageTimeout(
      'LEASE_CREATE',
      operation(),
    );

    jest.advanceTimersByTime(15_000);

    await expect(pending).rejects.toThrow('ARTIFACT_LEASE_CREATE_TIMEOUT');
    expect(operation).toHaveBeenCalledTimes(1);
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
      plan: {
        deviceIdentity: 'device',
        artifacts: [],
        targetsToUpdate: [],
      },
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
      .mockResolvedValue({
        hostBindingReleased: true,
        leaseReleased: true,
      });
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

  test('derives prepared V2 resource mode from the immutable Plan', async () => {
    const firmwareUpdateV2 = jest.fn();
    const sdk = { firmwareUpdateV2 } as unknown as CoreApi;
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
    const baseParams = {
      sdk,
      connectId: 'device',
      updateType: 'firmware' as const,
      platform: 'native' as const,
      firmwareType: EFirmwareType.Universal,
      version: [1, 0, 0],
      hostBindingGeneration: 1,
    };
    const preparedWithResource = createPreparedArtifacts({
      firmware,
      resourceEntries: [{ entryName: 'resource.bin', artifact: resource }],
    });
    preparedWithResource.plan.targetsToUpdate = ['firmware', 'resource'];

    await executePreparedFirmwareUpdateV2({
      ...baseParams,
      preparedArtifacts: preparedWithResource,
      forcedUpdateRes: false,
    });

    const preparedWithoutResource = createPreparedArtifacts({ firmware });
    preparedWithoutResource.plan.targetsToUpdate = ['firmware'];
    await executePreparedFirmwareUpdateV2({
      ...baseParams,
      preparedArtifacts: preparedWithoutResource,
      forcedUpdateRes: true,
    });
    await executePreparedFirmwareUpdateV2({
      ...baseParams,
      forcedUpdateRes: true,
    });

    expect(firmwareUpdateV2).toHaveBeenNthCalledWith(
      1,
      'device',
      expect.objectContaining({ forcedUpdateRes: true }),
    );
    expect(firmwareUpdateV2).toHaveBeenNthCalledWith(
      2,
      'device',
      expect.objectContaining({ forcedUpdateRes: false }),
    );
    expect(firmwareUpdateV2).toHaveBeenNthCalledWith(
      3,
      'device',
      expect.objectContaining({ forcedUpdateRes: true }),
    );
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

  test('uses artifact capability to enable non-empty Desktop Bridge plan caching', async () => {
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
        firmwareArtifactProtocolVersion: 3,
        maxReadBytes: 256 * 1024,
        supportsArchiveMaterialization: true,
        supportedRouteTypes: ['domain'],
      });
      const controller = createController();
      const plan = {
        planDigest: 'a'.repeat(64),
        deviceIdentity: 'device',
        deviceModel: 'pro',
        platform: 'desktop',
        artifacts: [
          {
            artifactId: 'firmware',
            role: 'firmware',
            target: 'firmware',
            url: testFirmwareArtifact.url,
            container: 'raw',
            expectedSize: testFirmwareArtifact.expectedSize,
            expectedSha256: testFirmwareArtifact.expectedSha256,
          },
        ],
        targetsToUpdate: ['firmware'],
      } as unknown as FirmwareUpdatePlan;

      await expect(
        controller.cachePlanIfPreparedSupported({
          plan,
          connectId: 'device',
          transportType: EHardwareTransportType.Bridge,
          expectedTargets: ['firmware'],
        }),
      ).resolves.toBe(true);
    } finally {
      Object.assign(platformEnv, previousPlatform);
    }
  });

  test('keeps a config Plan App-managed when integrity fields are absent', async () => {
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
      jest.spyOn(firmwareArtifactAdapter, 'getCapabilities').mockReturnValue({
        firmwareArtifactProtocolVersion: 3,
        maxReadBytes: 256 * 1024,
        supportsArchiveMaterialization: true,
        supportedRouteTypes: ['domain'],
      });
      const controller = createController();
      const plan = {
        planDigest: 'c'.repeat(64),
        deviceIdentity: 'device',
        deviceModel: 'pro',
        platform: 'desktop',
        artifacts: [
          {
            artifactId: 'firmware',
            role: 'firmware',
            target: 'firmware',
            url: 'https://firmware.example/pro.bin',
            container: 'raw',
          },
        ],
        targetsToUpdate: ['firmware'],
      } as unknown as FirmwareUpdatePlan;

      await expect(
        controller.cachePlanDigestIfPreparedSupported({
          hasUpgrade: true,
          plan,
          connectId: 'device',
          transportType: EHardwareTransportType.Bridge,
          expectedTargets: ['firmware'],
        }),
      ).resolves.toBe(plan.planDigest);
    } finally {
      Object.assign(platformEnv, previousPlatform);
    }
  });

  test('rejects empty and partial Desktop Bridge plans before preparation', async () => {
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
        firmwareArtifactProtocolVersion: 3,
        maxReadBytes: 256 * 1024,
        supportsArchiveMaterialization: true,
        supportedRouteTypes: ['domain'],
      });
      const download = jest.spyOn(firmwareArtifactAdapter, 'download');
      const controller = createController();
      const emptyPlan = {
        planDigest: 'a'.repeat(64),
        deviceIdentity: 'device',
        deviceModel: 'pro',
        platform: 'desktop',
        artifacts: [],
        targetsToUpdate: [],
      } as unknown as FirmwareUpdatePlan;
      const firmwareOnlyPlan = {
        ...emptyPlan,
        planDigest: 'b'.repeat(64),
        artifacts: [
          {
            artifactId: 'firmware',
            role: 'firmware',
            target: 'firmware',
            url: 'https://common.onekey-asset.com/firmware.bin',
            container: 'raw',
          },
        ],
        targetsToUpdate: ['firmware'],
      } as unknown as FirmwareUpdatePlan;

      await expect(
        controller.cachePlanDigestIfPreparedSupported({
          hasUpgrade: true,
          plan: emptyPlan,
          connectId: 'device',
          transportType: EHardwareTransportType.Bridge,
          expectedTargets: ['firmware'],
        }),
      ).rejects.toThrow('Firmware update plan has no executable artifacts');
      await expect(
        controller.cachePlanDigestIfPreparedSupported({
          hasUpgrade: true,
          plan: firmwareOnlyPlan,
          connectId: 'device',
          transportType: EHardwareTransportType.Bridge,
          expectedTargets: ['firmware', 'ble'],
        }),
      ).rejects.toThrow(
        'Firmware update plan does not cover every selected target',
      );
      expect(download).not.toHaveBeenCalled();
    } finally {
      Object.assign(platformEnv, previousPlatform);
    }
  });
});

describe('downloadFirmwareArtifact', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses the canonical domain route with the remaining deadline', async () => {
    const trace = jest
      .spyOn(loggerUtils, 'consoleFunc')
      .mockImplementation(() => undefined);
    const artifact = testFirmwareArtifact;
    const download = jest
      .spyOn(firmwareArtifactAdapter, 'download')
      .mockResolvedValue({
        artifactRef: `fw:${artifact.expectedSha256}`,
        size: artifact.expectedSize,
        sha256: artifact.expectedSha256,
      });
    const deadlineAt = Date.now() + 20 * 60 * 1000;

    await expect(
      downloadFirmwareArtifact({
        artifact,
        artifactId: 'bootloader',
        taskId: 'bootloader-download',
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
    expect(trace).toHaveBeenCalledWith(
      expect.stringContaining('"stage":"artifact-download-start"'),
    );
    expect(trace).toHaveBeenCalledWith(
      expect.stringContaining('"stage":"artifact-download-complete"'),
    );
  });

  test('records a bounded error code when the native download fails', async () => {
    const trace = jest
      .spyOn(loggerUtils, 'consoleFunc')
      .mockImplementation(() => undefined);
    const artifact = testFirmwareArtifact;
    jest
      .spyOn(firmwareArtifactAdapter, 'download')
      .mockRejectedValue(new Error('ARTIFACT_NETWORK_FAILED: request failed'));

    await expect(
      downloadFirmwareArtifact({
        artifact,
        artifactId: 'bootloader',
        taskId: 'bootloader-download',
        transactionId: 'fwtx:trace-failure',
        leaseRef: 'fwlease:trace-failure',
        deadlineAt: Date.now() + 20 * 60 * 1000,
      }),
    ).rejects.toThrow('ARTIFACT_NETWORK_FAILED');

    expect(trace).toHaveBeenCalledWith(
      expect.stringContaining(
        '"stage":"artifact-download-failed","artifactId":"bootloader"',
      ),
    );
    expect(trace).toHaveBeenCalledWith(
      expect.stringContaining('"errorCode":"ARTIFACT_NETWORK_FAILED"'),
    );
  });

  test('does not start a download after the preparation deadline', async () => {
    const artifact = testFirmwareArtifact;
    const download = jest.spyOn(firmwareArtifactAdapter, 'download');
    await expect(
      downloadFirmwareArtifact({
        artifact,
        artifactId: 'bootloader',
        taskId: 'bootloader-download',
        transactionId: 'fwtx:test',
        leaseRef: 'fwlease:test',
        deadlineAt: Date.now() - 1,
      }),
    ).rejects.toThrow('Firmware artifact preparation exceeded its deadline');
    expect(download).not.toHaveBeenCalled();
  });
});

describe('Desktop Bridge firmware binaries', () => {
  const createBridgePlan = () => {
    const artifact = testFirmwareArtifact;
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
          url: artifact.url,
          container: 'raw',
          expectedSize: artifact.expectedSize,
          expectedSha256: artifact.expectedSha256,
        },
      ],
      targetsToUpdate: ['bootloader'],
    } as unknown as FirmwareUpdatePlan;
    return { artifact, plan };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('downloads and reads a small admitted artifact before releasing its lease', async () => {
    const { artifact, plan } = createBridgePlan();
    jest.spyOn(firmwareArtifactAdapter, 'getCapabilities').mockReturnValue({
      firmwareArtifactProtocolVersion: 3,
      maxReadBytes: 256 * 1024,
      supportsArchiveMaterialization: true,
      supportedRouteTypes: ['domain'],
    });
    jest
      .spyOn(firmwareArtifactAdapter, 'createLease')
      .mockResolvedValue({ leaseRef: 'fwlease:test' });
    jest.spyOn(firmwareArtifactAdapter, 'download').mockResolvedValue({
      artifactRef: `fw:${artifact.expectedSha256}`,
      size: artifact.expectedSize,
      sha256: artifact.expectedSha256,
    });
    jest.spyOn(firmwareArtifactAdapter, 'open').mockResolvedValue({
      readerId: 'reader',
      size: artifact.expectedSize,
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
      artifact.expectedSize,
    );
    expect(read.mock.calls.every(([input]) => input.length <= 256 * 1024)).toBe(
      true,
    );
    expect(release).toHaveBeenCalledWith({
      leaseRef: 'fwlease:test',
      disposition: 'completed',
    });
  });

  test('downloads a remote plan URL without requiring an App-bundled catalog', async () => {
    const { plan } = createBridgePlan();
    delete plan.artifacts[0].expectedSize;
    delete plan.artifacts[0].expectedSha256;
    jest.spyOn(firmwareArtifactAdapter, 'getCapabilities').mockReturnValue({
      firmwareArtifactProtocolVersion: 3,
      maxReadBytes: 256 * 1024,
      supportsArchiveMaterialization: true,
      supportedRouteTypes: ['domain'],
    });
    jest
      .spyOn(firmwareArtifactAdapter, 'createLease')
      .mockResolvedValue({ leaseRef: 'fwlease:catalog' });
    const actualSha256 = '2'.repeat(64);
    const download = jest
      .spyOn(firmwareArtifactAdapter, 'download')
      .mockResolvedValue({
        artifactRef: `fw:${actualSha256}`,
        size: testFirmwareArtifact.expectedSize,
        sha256: actualSha256,
      });
    jest.spyOn(firmwareArtifactAdapter, 'open').mockResolvedValue({
      readerId: 'reader',
      size: testFirmwareArtifact.expectedSize,
    });
    jest
      .spyOn(firmwareArtifactAdapter, 'read')
      .mockImplementation(async ({ length }) => new ArrayBuffer(length));
    jest.spyOn(firmwareArtifactAdapter, 'close').mockResolvedValue();
    jest.spyOn(firmwareArtifactAdapter, 'releaseLease').mockResolvedValue();

    await expect(prepareBridgeFirmwareBinaries(plan)).resolves.toMatchObject({
      targetBinaries: {
        bootloader: expect.any(ArrayBuffer),
      },
    });
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: 'bootloader',
        url: plan.artifacts[0].url,
        maxBytes: 512 * 1024 * 1024,
      }),
    );
    expect(download.mock.calls[0][0]).not.toHaveProperty('expectedSize');
    expect(download.mock.calls[0][0]).not.toHaveProperty('expectedSha256');
  });

  test('cancels an active preparation after a download failure', async () => {
    const { plan } = createBridgePlan();
    jest.spyOn(firmwareArtifactAdapter, 'getCapabilities').mockReturnValue({
      firmwareArtifactProtocolVersion: 3,
      maxReadBytes: 256 * 1024,
      supportsArchiveMaterialization: true,
      supportedRouteTypes: ['domain'],
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
    const artifact = {
      artifactId: 'bootloader',
      role: 'bootloader' as const,
      target: 'bootloader' as const,
      url: testFirmwareArtifact.url,
      container: 'raw' as const,
      expectedSize: testFirmwareArtifact.expectedSize,
      expectedSha256: testFirmwareArtifact.expectedSha256,
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
      firmwareArtifactProtocolVersion: 3,
      maxReadBytes: 256 * 1024,
      supportsArchiveMaterialization: true,
      supportedRouteTypes: ['domain'],
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

  test('materializes a ZIP without remote entry metadata and passes actual receipts to the SDK', async () => {
    const plan = {
      schemaVersion: 2,
      planDigest: 'd'.repeat(64),
      executor: 'v2',
      deviceIdentity: 'device',
      deviceModel: 'classic',
      firmwareType: EFirmwareType.Universal,
      platform: 'native',
      artifacts: [
        {
          artifactId: 'resource',
          role: 'resource',
          target: 'resource',
          url: 'https://firmware.example/resources.zip',
          container: 'zip',
        },
      ],
      targetsToUpdate: ['resource'],
    } as unknown as FirmwareUpdatePlan;
    const archiveSha256 = '3'.repeat(64);
    const entrySha256 = '4'.repeat(64);
    const preparePlan = jest.fn(() => ({
      preparedPlanDigest: 'e'.repeat(64),
      planDigest: plan.planDigest,
    })) as unknown as CoreApi['prepareFirmwareUpdatePlan'];
    jest.spyOn(firmwareArtifactAdapter, 'getCapabilities').mockReturnValue({
      firmwareArtifactProtocolVersion: 3,
      maxReadBytes: 256 * 1024,
      supportsArchiveMaterialization: true,
      supportedRouteTypes: ['domain'],
    });
    const download = jest
      .spyOn(firmwareArtifactAdapter, 'download')
      .mockResolvedValue({
        artifactRef: `fw:${archiveSha256}`,
        size: 2048,
        sha256: archiveSha256,
      });
    const materialize = jest
      .spyOn(firmwareArtifactAdapter, 'materialize')
      .mockResolvedValue([
        {
          entryName: 'resource.bin',
          receipt: {
            artifactRef: `fw:${entrySha256}`,
            size: 1024,
            sha256: entrySha256,
          },
        },
      ]);

    await expect(
      prepareFirmwareArtifacts(plan, {
        transactionId: 'fwtx:zip-without-catalog',
        leaseRef: 'fwlease:zip-without-catalog',
        preparePlan,
      }),
    ).resolves.toMatchObject({
      selected: {
        resourceEntries: [
          {
            entryName: 'resource.bin',
            artifact: { sha256: entrySha256 },
          },
        ],
      },
    });
    expect(download.mock.calls[0][0]).toMatchObject({
      maxBytes: 512 * 1024 * 1024,
    });
    expect(download.mock.calls[0][0]).not.toHaveProperty('expectedSize');
    expect(download.mock.calls[0][0]).not.toHaveProperty('expectedSha256');
    expect(materialize).toHaveBeenCalledWith({
      leaseRef: 'fwlease:zip-without-catalog',
      archiveArtifactRef: `fw:${archiveSha256}`,
    });
    expect(preparePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        artifacts: [
          expect.objectContaining({
            artifactId: 'resource',
            materializedEntries: [
              {
                entryName: 'resource.bin',
                artifact: {
                  artifactRef: `fw:${entrySha256}`,
                  size: 1024,
                  sha256: entrySha256,
                },
              },
            ],
          }),
        ],
      }),
    );
  });

  test('uses one production session for plan validation, host binding, and release', async () => {
    const plan = {
      schemaVersion: 2,
      planDigest: 'a'.repeat(64),
      executor: 'v2',
      deviceIdentity: 'device',
      deviceModel: 'classic',
      firmwareType: EFirmwareType.Universal,
      platform: 'native',
      artifacts: [
        {
          artifactId: 'bootloader',
          role: 'bootloader',
          target: 'bootloader',
          url: testFirmwareArtifact.url,
          container: 'raw',
          expectedSize: testFirmwareArtifact.expectedSize,
          expectedSha256: testFirmwareArtifact.expectedSha256,
        },
      ],
      targetsToUpdate: ['bootloader'],
    } as unknown as FirmwareUpdatePlan;
    const preparedPlan = {
      preparedPlanDigest: 'b'.repeat(64),
      planDigest: plan.planDigest,
    } as FirmwareUpdatePreparedPlan;
    const validateFirmwareUpdatePreparedPlan = jest.fn(() => preparedPlan);
    const unregisterFirmwareUpdateHostBinding = jest.fn(() => true);
    const sdk = {
      prepareFirmwareUpdatePlan: jest.fn(() => preparedPlan),
      validateFirmwareUpdatePreparedPlan,
      registerFirmwareUpdateHostBinding: jest.fn(() => 9),
      unregisterFirmwareUpdateHostBinding,
    } as unknown as CoreApi;
    jest.spyOn(loggerUtils, 'consoleFunc').mockImplementation(() => undefined);
    jest.spyOn(firmwareArtifactAdapter, 'getCapabilities').mockReturnValue({
      firmwareArtifactProtocolVersion: 3,
      maxReadBytes: 256 * 1024,
      supportsArchiveMaterialization: true,
      supportedRouteTypes: ['domain'],
    });
    jest
      .spyOn(firmwareArtifactAdapter, 'createLease')
      .mockResolvedValue({ leaseRef: 'fwlease:session' });
    jest.spyOn(firmwareArtifactAdapter, 'download').mockResolvedValue({
      artifactRef: `fw:${testFirmwareArtifact.expectedSha256}`,
      size: testFirmwareArtifact.expectedSize,
      sha256: testFirmwareArtifact.expectedSha256,
    });
    const releaseLease = jest
      .spyOn(firmwareArtifactAdapter, 'releaseLease')
      .mockResolvedValue();
    const controller = new FirmwarePreparedArtifactController({
      getHardwareTransportType: async () => EHardwareTransportType.Bridge,
      getSDKInstance: async () => sdk,
    });
    let cleanup: IFirmwarePreparedArtifactReleaseResult | undefined;

    await controller.withPreparedPlanArtifacts(
      { plan, sdk, transactionId: 'fwtx:session' },
      async (prepared) => {
        expect(prepared.selected.bootloader).toMatchObject({
          size: testFirmwareArtifact.expectedSize,
        });
      },
      (result) => {
        cleanup = result;
      },
    );

    expect(validateFirmwareUpdatePreparedPlan).toHaveBeenCalledWith(
      preparedPlan,
    );
    expect(unregisterFirmwareUpdateHostBinding).toHaveBeenCalledWith(9);
    expect(releaseLease).toHaveBeenCalledWith({
      leaseRef: 'fwlease:session',
      disposition: 'completed',
    });
    expect(cleanup).toEqual({
      hostBindingReleased: true,
      leaseReleased: true,
    });
  });
});
