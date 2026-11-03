import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  FirmwareArtifactCache,
  getFirmwareModelArtifacts,
} from './FirmwareArtifactCache';
import { getFirmwareManifestSnapshot } from './FirmwareManifestProvider';

import type {
  IFirmwareArtifactAdapter,
  IFirmwareArtifactReceipt,
} from './FirmwareArtifactAdapter.types';
import type { IFirmwareDownloadContext } from './FirmwareArtifactCache';
import type { IFirmwareArtifactCacheState } from '../../dbs/simple/entity/SimpleDbEntityFirmwareArtifactCache';
import type { RemoteConfigResponse } from '@onekeyfe/hd-core';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeIOS: true, isJest: true },
}));
jest.mock('./FirmwareArtifactAdapter', () => ({ firmwareArtifactAdapter: {} }));
jest.mock('./FirmwareManifestProvider', () => ({
  getFirmwareManifestSnapshot: jest.fn(),
}));
jest.mock('../ServiceHardware/HardwareTelemetry', () => ({
  getHardwareTelemetry: jest.fn(),
}));

const hash = 'a'.repeat(64);
const newerHash = 'b'.repeat(64);
const receipt: IFirmwareArtifactReceipt = {
  artifactRef: `fw:${hash}`,
  sha256: hash,
  size: 10,
  expectedSha256Verified: true,
};
const artifact = {
  role: 'firmware' as const,
  container: 'raw' as const,
  url: 'https://data.onekey.so/fw.bin',
  expectedSha256: hash,
  expectedSize: 10,
};
const context: IFirmwareDownloadContext = {
  deviceType: 'pro2',
  firmwareType: 'universal',
  releaseChannel: 'stable',
  source: 'prefetch',
  targetVersion: '3.0.0',
  cacheSlot: 'pro2:stable:firmware:firmware',
};
const manifest = (fingerprint = hash) =>
  ({
    pro2: {
      firmware: [
        {
          version: [3, 0, 0],
          url: artifact.url,
          fingerprint,
          expectedSize: 10,
        },
      ],
    },
  }) as unknown as RemoteConfigResponse;

function setup(initial: IFirmwareArtifactCacheState = { slots: {} }) {
  let state = initial;
  const store = {
    getState: jest.fn(async () => state),
    saveState: jest.fn(async (next: IFirmwareArtifactCacheState) => {
      state = next;
    }),
  };
  let leases = 0;
  const adapter = {
    getCapabilities: jest.fn(),
    download: jest.fn(),
    cancelDownloads: jest.fn(),
    materialize: jest.fn(),
    read: jest.fn(),
    sweepOrphans: jest.fn(),
    createLease: jest.fn(async () => {
      leases += 1;
      return { leaseRef: `lease-${leases}` };
    }),
    retain: jest.fn().mockResolvedValue(undefined),
    releaseLease: jest.fn().mockResolvedValue(undefined),
    open: jest.fn().mockResolvedValue({ readerId: 'reader', size: 10 }),
    close: jest.fn().mockResolvedValue(undefined),
  } satisfies IFirmwareArtifactAdapter;
  const report = jest.fn();
  return {
    cache: new FirmwareArtifactCache(store, adapter, report),
    store,
    adapter,
    report,
  };
}

describe('Firmware model cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(platformEnv, {
      isNative: true,
      isNativeIOS: true,
      isNativeAndroid: false,
      isDesktop: false,
    });
  });

  it('selects the latest release per model/family/channel, without falling back to unhashed packages', () => {
    const config = manifest();
    expect(getFirmwareModelArtifacts(config, 'pro2', 'stable')).toMatchObject([
      {
        slot: context.cacheSlot,
        version: '3.0.0',
        artifact: { expectedSha256: hash },
      },
    ]);
    expect(
      getFirmwareModelArtifacts(manifest('invalid'), 'pro2', 'stable'),
    ).toEqual([]);
    expect(getFirmwareModelArtifacts(config, 'bridge', 'stable')).toEqual([]);
    expect(
      getFirmwareModelArtifacts(config, 'pro2', 'pre-release')[0].slot,
    ).toContain(':pre-release:');
  });

  it('probes validated cached content and pins it before releasing the old latest lease', async () => {
    const { cache, store, adapter, report } = setup({
      slots: {},
      leaseRef: 'previous',
    });
    await expect(
      cache.download(artifact, 'active-upgrade', context, async () => receipt),
    ).resolves.toBe(receipt);
    expect(adapter.open).toHaveBeenCalledWith(receipt.artifactRef);
    expect(adapter.close).toHaveBeenCalledWith('reader');
    expect(
      (await store.getState()).slots[context.cacheSlot ?? ''],
    ).toMatchObject({ sha256: hash });
    expect(store.saveState.mock.invocationCallOrder[0]).toBeLessThan(
      (adapter.releaseLease as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'success', cacheHit: true, bytes: 10 }),
    );
  });

  it('keeps the old latest package when the new download fails and reports cancellation', async () => {
    const previous = {
      artifactRef: `fw:${newerHash}`,
      sha256: newerHash,
      size: 10,
      version: '2.0.0',
    };
    const { cache, store, report } = setup({
      slots: { [context.cacheSlot ?? '']: previous },
      leaseRef: 'previous',
    });
    await expect(
      cache.download(artifact, 'active', context, async () => {
        throw new OneKeyLocalError('ARTIFACT_CANCELLED');
      }),
    ).rejects.toThrow('ARTIFACT_CANCELLED');
    expect((await store.getState()).slots[context.cacheSlot ?? '']).toBe(
      previous,
    );
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'cancelled',
        errorCode: 'ARTIFACT_CANCELLED',
      }),
    );
  });

  it('falls back to downloading on a cache miss and does not let telemetry break it', async () => {
    const { store, adapter } = setup();
    (adapter.open as jest.Mock).mockRejectedValue(new Error('not cached'));
    const cache = new FirmwareArtifactCache(store, adapter, () => {
      throw new OneKeyLocalError('telemetry unavailable');
    });
    const download = jest.fn(async () => receipt);
    await expect(
      cache.download(artifact, 'active', context, download),
    ).resolves.toBe(receipt);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('retains the old cache lease if saving a new latest reference fails', async () => {
    const { cache, store, adapter } = setup({
      slots: {},
      leaseRef: 'previous',
    });
    store.saveState.mockRejectedValue(new Error('disk unavailable'));
    await expect(
      cache.download(artifact, 'active', context, async () => receipt),
    ).resolves.toBe(receipt);
    expect(adapter.releaseLease).not.toHaveBeenCalledWith(
      expect.objectContaining({ leaseRef: 'previous' }),
    );
  });

  it.each(['ios', 'android', 'desktop'])(
    'deduplicates owned models and retries failed prefetches on %s without device identifiers',
    async (platform) => {
      Object.assign(platformEnv, {
        isNative: platform !== 'desktop',
        isNativeIOS: platform === 'ios',
        isNativeAndroid: platform === 'android',
        isDesktop: platform === 'desktop',
      });
      (getFirmwareManifestSnapshot as jest.Mock).mockResolvedValue(manifest());
      const { cache } = setup();
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue(receipt);
      const download = jest.fn(
        (
          input: Parameters<
            Parameters<FirmwareArtifactCache['prefetch']>[2]
          >[0],
        ) =>
          cache.download(
            input.artifact,
            input.leaseRef,
            input.downloadContext ?? context,
            operation,
          ),
      );
      await cache.prefetch(['pro2', 'pro2'], false, download);
      await cache.prefetch(['pro2'], false, download);
      await cache.prefetch(['pro2'], false, download);
      expect(download).toHaveBeenCalledTimes(2);
      expect(download.mock.calls[0][0]).toMatchObject({
        transactionId: `prefetch:pro2:${hash.slice(0, 32)}`,
        downloadContext: context,
      });
      expect(download.mock.calls[0][0]).not.toHaveProperty('connectId');
      expect(download.mock.calls[0][0]).not.toHaveProperty('serialNo');
    },
  );

  it('retries prefetch after a failed pin save and only cools down after pins are persisted', async () => {
    (getFirmwareManifestSnapshot as jest.Mock).mockResolvedValue(manifest());
    const { cache, store } = setup();
    store.saveState.mockRejectedValueOnce(new Error('disk unavailable'));
    const download = jest.fn().mockResolvedValue(receipt);
    const prefetch = () =>
      cache.prefetch(
        ['pro2'],
        false,
        ({ artifact: requestedArtifact, leaseRef, downloadContext }) =>
          cache.download(
            requestedArtifact,
            leaseRef,
            downloadContext ?? context,
            download,
          ),
      );

    await prefetch();
    expect((await store.getState()).slots).toEqual({});
    expect(download).toHaveBeenCalledTimes(1);

    await prefetch();
    expect(download).toHaveBeenCalledTimes(2);
    expect(
      (await store.getState()).slots[context.cacheSlot ?? ''],
    ).toMatchObject({
      artifactRef: receipt.artifactRef,
      sha256: hash,
    });

    await prefetch();
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('restores latest pins when native leases were lost after an app restart', async () => {
    const previous = {
      artifactRef: receipt.artifactRef,
      sha256: hash,
      size: 10,
      version: '3.0.0',
    };
    const { cache, store, adapter } = setup({
      slots: { [context.cacheSlot ?? '']: previous },
      leaseRef: 'lost-native-lease',
    });
    adapter.retain.mockRejectedValueOnce(new Error('lease missing'));
    await cache.restorePins();
    const state = await store.getState();
    expect(state.leaseRef).not.toBe('lost-native-lease');
    expect(state.slots[context.cacheSlot ?? '']).toEqual(previous);
    expect(adapter.retain).toHaveBeenCalledWith({
      leaseRef: state.leaseRef,
      artifactRef: receipt.artifactRef,
    });
  });

  it('downloads on desktop when retaining a nonexistent cached file fails', async () => {
    Object.assign(platformEnv, {
      isNative: false,
      isNativeIOS: false,
      isDesktop: true,
    });
    const { cache, adapter, report } = setup();
    adapter.retain.mockRejectedValueOnce(new Error('ARTIFACT_NOT_FOUND'));
    const download = jest.fn(async () => receipt);
    await expect(
      cache.download(artifact, 'active', context, download),
    ).resolves.toBe(receipt);
    expect(download).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'success', cacheHit: false }),
    );
  });

  it('discards stale cache references when their files were removed between launches', async () => {
    const { cache, adapter, store } = setup({
      slots: {
        [context.cacheSlot ?? '']: {
          artifactRef: receipt.artifactRef,
          sha256: hash,
          size: 10,
          version: '2.0.0',
        },
      },
      leaseRef: 'lost',
    });
    adapter.retain.mockRejectedValueOnce(new Error('lease missing'));
    adapter.open.mockRejectedValueOnce(new Error('file missing'));
    await cache.restorePins();
    expect((await store.getState()).slots).toEqual({});
    await expect(
      cache.download(artifact, 'active', context, async () => receipt),
    ).resolves.toBe(receipt);
    expect(
      (await store.getState()).slots[context.cacheSlot ?? '']?.sha256,
    ).toBe(hash);
  });

  it('does not let an older in-flight download overwrite a newly selected model package', async () => {
    const { cache, store } = setup();
    let finish: ((value: IFirmwareArtifactReceipt) => void) | undefined;
    const pending = cache.download(
      artifact,
      'active',
      context,
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    (getFirmwareManifestSnapshot as jest.Mock).mockResolvedValue(
      manifest(newerHash),
    );
    await cache.prefetch(
      ['pro2'],
      false,
      jest.fn().mockResolvedValue({
        ...receipt,
        artifactRef: `fw:${newerHash}`,
        sha256: newerHash,
      }),
    );
    finish?.(receipt);
    await pending;
    expect(
      (await store.getState()).slots[context.cacheSlot ?? ''],
    ).toBeUndefined();
  });

  it('continues prefetching other models if one model download fails', async () => {
    const config = {
      ...manifest(),
      neo: manifest().pro2,
    } as RemoteConfigResponse;
    (getFirmwareManifestSnapshot as jest.Mock).mockResolvedValue(config);
    const { cache } = setup();
    const download = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(receipt);
    await cache.prefetch(['pro2', 'neo'], false, download);
    expect(download).toHaveBeenCalledTimes(2);
    expect(download.mock.calls[1][0].downloadContext.deviceType).toBe('neo');
  });
});
