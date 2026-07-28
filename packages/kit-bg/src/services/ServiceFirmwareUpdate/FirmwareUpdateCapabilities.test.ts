import { EFirmwareType } from '@onekeyfe/hd-shared';

import type { IIpTableConfigWithRuntime } from '@onekeyhq/shared/src/request/types/ipTable';

import { firmwareArtifactAdapter } from './FirmwareArtifactAdapter';
import {
  cancelFirmwareArtifactPreparations,
  downloadTrustedFirmwareArtifact,
  getBridgeFirmwareV3BinaryParams,
  getBridgeFirmwareV4BinaryParams,
  isExternalFirmwareCapabilityReady,
  isFirmwareArtifactCapabilityReadyValue,
  orderFirmwareArtifactRoutes,
  prepareBridgeFirmwareBinaries,
  prepareFirmwareArtifacts,
} from './FirmwareArtifactPreflight';
import { getTrustedFirmwareArtifact } from './trustedFirmwareCatalog';

import type { FirmwareUpdatePlan } from '@onekeyfe/hd-core';

jest.mock('@onekeyhq/shared/src/request/helpers/sniRequest', () => ({
  isProxyActiveForUrl: jest.fn().mockResolvedValue(false),
}));
jest.mock('@onekeyhq/shared/src/request/requestHelper', () => ({
  __esModule: true,
  default: {
    getIpTableConfig: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockGetIpTableConfig = jest.requireMock(
  '@onekeyhq/shared/src/request/requestHelper',
).default.getIpTableConfig as jest.Mock;

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
        supportedRouteTypes: ['domain', 'domain'],
      }),
    ).toBe(false);
  });
});

describe('orderFirmwareArtifactRoutes', () => {
  const configWithRuntime: IIpTableConfigWithRuntime = {
    config: {
      version: 1,
      ttl_sec: 3600,
      generated_at: '2026-07-27T00:00:00.000Z',
      signature: 'test',
      domains: {
        'web.onekey-asset.com': {
          endpoints: [
            { ip: '1.1.1.1', provider: 'a', region: 'CN', weight: 100 },
            { ip: '2.2.2.2', provider: 'b', region: 'CN', weight: 90 },
          ],
        },
      },
    },
    runtime: {
      enabled: true,
      lastUpdated: 1,
      lastRegionCheck: 1,
      selections: {},
      lastBestIp: { 'web.onekey-asset.com': '2.2.2.2' },
    },
  };

  afterEach(() => {
    jest.restoreAllMocks();
    mockGetIpTableConfig.mockResolvedValue(undefined);
  });

  test('keeps proxy and unknown proxy state on the domain route', () => {
    expect(
      orderFirmwareArtifactRoutes({
        hostname: 'web.onekey-asset.com',
        configWithRuntime,
        proxyActive: true,
      }),
    ).toEqual([{ routeType: 'domain' }]);
    expect(
      orderFirmwareArtifactRoutes({
        hostname: 'web.onekey-asset.com',
        configWithRuntime,
        proxyActive: null,
      }),
    ).toEqual([{ routeType: 'domain' }]);
  });

  test('uses domain first until an endorsed runtime selection exists', () => {
    expect(
      orderFirmwareArtifactRoutes({
        hostname: 'web.onekey-asset.com',
        configWithRuntime,
        proxyActive: false,
      }),
    ).toEqual([
      { routeType: 'domain' },
      { routeType: 'pinnedIp', resolvedIp: '2.2.2.2' },
      { routeType: 'pinnedIp', resolvedIp: '1.1.1.1' },
    ]);
  });

  test('prioritizes the selected exact-host IP and preserves fallback order', () => {
    expect(
      orderFirmwareArtifactRoutes({
        hostname: 'web.onekey-asset.com',
        configWithRuntime: {
          ...configWithRuntime,
          runtime: {
            ...configWithRuntime.runtime!,
            selections: { 'web.onekey-asset.com': '1.1.1.1' },
          },
        },
        proxyActive: false,
      }),
    ).toEqual([
      { routeType: 'pinnedIp', resolvedIp: '1.1.1.1' },
      { routeType: 'pinnedIp', resolvedIp: '2.2.2.2' },
      { routeType: 'domain' },
    ]);
  });

  test('fails closed on TLS errors without trying another route', async () => {
    const artifact = getTrustedFirmwareArtifact(
      'https://common.onekey-asset.com/hw/legacy/bootloader/classic/2.0.0/classic-boot.2.0.0-0510-6d616dc.signed.bin',
    );
    mockGetIpTableConfig.mockResolvedValue({
      ...configWithRuntime,
      config: {
        ...configWithRuntime.config,
        domains: {
          'common.onekey-asset.com': {
            endpoints: [
              { ip: '1.1.1.1', provider: 'a', region: 'CN', weight: 100 },
            ],
          },
        },
      },
      runtime: {
        ...configWithRuntime.runtime!,
        selections: { 'common.onekey-asset.com': '1.1.1.1' },
      },
    });
    const download = jest
      .spyOn(firmwareArtifactAdapter, 'download')
      .mockRejectedValue(
        new Error('ARTIFACT_TLS_FAILED: firmware TLS validation failed'),
      );

    await expect(
      downloadTrustedFirmwareArtifact({
        artifact,
        artifactId: 'bootloader',
        transactionId: 'fwtx:test',
        leaseRef: 'fwlease:test',
        deadlineAt: Date.now() + 10_000,
      }),
    ).rejects.toThrow('ARTIFACT_TLS_FAILED');
    expect(download).toHaveBeenCalledTimes(1);
  });
});

describe('Desktop Bridge firmware binaries', () => {
  const createBridgePlan = () => {
    const url =
      'https://common.onekey-asset.com/hw/legacy/bootloader/classic/2.0.0/classic-boot.2.0.0-0510-6d616dc.signed.bin';
    const trusted = getTrustedFirmwareArtifact(url);
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
    const { plan, trusted } = createBridgePlan();
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

  test('cancels an active preparation without trying another route', async () => {
    const { plan } = createBridgePlan();
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
    const trusted = getTrustedFirmwareArtifact(url);
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
