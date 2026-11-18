import { Mutex } from 'async-mutex';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IFirmwareArtifactDownloadTelemetry } from '@onekeyhq/shared/src/logger/scopes/update/scenes/firmware';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { getHardwareTelemetry } from '../ServiceHardware/HardwareTelemetry';

import { firmwareArtifactAdapter } from './FirmwareArtifactAdapter';
import { getFirmwareManifestSnapshot } from './FirmwareManifestProvider';

import type {
  IFirmwareArtifactAdapter,
  IFirmwareArtifactReceipt,
} from './FirmwareArtifactAdapter.types';
import type { IFirmwareDownloadArtifact } from './FirmwareArtifactPreflight';
import type {
  IFirmwareCacheEntry,
  SimpleDbEntityFirmwareArtifactCache,
} from '../../dbs/simple/entity/SimpleDbEntityFirmwareArtifactCache';
import type { RemoteConfigResponse } from '@onekeyfe/hd-core';

export type IFirmwareDownloadContext = Pick<
  IFirmwareArtifactDownloadTelemetry,
  'deviceType' | 'firmwareType' | 'releaseChannel' | 'source' | 'targetVersion'
> & { cacheSlot?: string };

type ICatalogArtifact = {
  slot: string;
  version: string;
  artifact: IFirmwareDownloadArtifact;
  firmwareType: string;
};

type ICacheStore = Pick<
  SimpleDbEntityFirmwareArtifactCache,
  'getState' | 'saveState'
>;
type IDownload = (input: {
  artifact: IFirmwareDownloadArtifact;
  artifactId: string;
  taskId: string;
  transactionId: string;
  leaseRef: string;
  deadlineAt: number;
  downloadContext?: IFirmwareDownloadContext;
}) => Promise<IFirmwareArtifactReceipt>;

const isSha256 = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/iu.test(value);

function compareVersions(a: string, b: string): number {
  const first = a.split('.').map(Number);
  const second = b.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const diff = first[index] - second[index];
    if (diff) return diff;
  }
  return 0;
}

function artifactPlatform(): string {
  if (platformEnv.isNativeIOS) return 'ios';
  if (platformEnv.isNativeAndroid) return 'android';
  return 'desktop';
}

// Only complete hashes from the reviewed manifest become persistent cache pins.
// The index selects downloads; it is never accepted as a device execution plan.
export function getFirmwareModelArtifacts(
  config: RemoteConfigResponse,
  deviceType: string,
  channel: IFirmwareDownloadContext['releaseChannel'],
): ICatalogArtifact[] {
  if (
    !Object.prototype.hasOwnProperty.call(config, deviceType) ||
    deviceType === 'bridge'
  )
    return [];
  const model =
    config[deviceType as Exclude<keyof RemoteConfigResponse, 'bridge'>];
  if (!model) return [];
  const results: ICatalogArtifact[] = [];
  const add = (
    family: string,
    name: string,
    version: string,
    role: IFirmwareDownloadArtifact['role'],
    url: string | undefined,
    hash: string | undefined,
    size: number | undefined,
    container: IFirmwareDownloadArtifact['container'] = 'raw',
  ) => {
    if (!url || !isSha256(hash)) return;
    if (
      size !== undefined &&
      (!Number.isSafeInteger(size) || size <= 0 || size > 512 * 1024 * 1024)
    )
      return;
    const firmwareType = family.includes('btc') ? 'bitcoinonly' : 'universal';
    results.push({
      slot: `${deviceType}:${channel}:${family}:${name}`,
      version,
      firmwareType,
      artifact: {
        url,
        role,
        container,
        logicalName: name,
        expectedSha256: hash.toLowerCase(),
        ...(size !== undefined ? { expectedSize: size } : {}),
      },
    });
  };
  const fields = [
    'firmware',
    'firmware-v1',
    'firmware-v2',
    'firmware-v8',
    'firmware-btc-v8',
  ] as const;
  fields.forEach((family) => {
    const releases = model[family];
    if (!Array.isArray(releases)) return;
    const release = [...releases]
      .filter(
        (entry) =>
          Array.isArray(entry.version) &&
          entry.version.length === 3 &&
          entry.version.every((v) => Number.isSafeInteger(v) && v >= 0),
      )
      .toSorted((a, b) =>
        compareVersions(b.version.join('.'), a.version.join('.')),
      )[0];
    if (!release) return;
    const version = release.version.join('.');
    add(
      family,
      'firmware',
      version,
      'firmware',
      release.url,
      release.fingerprint,
      release.expectedSize,
    );
    add(
      family,
      'bootloader',
      (release.bootloaderVersion ?? release.version).join('.'),
      'bootloader',
      release.bootloaderResource,
      release.bootloaderFingerprint,
      release.bootloaderExpectedSize,
    );
    add(
      family,
      'resource',
      version,
      'resource',
      release.resource,
      release.resourceFingerprint,
      release.resourceExpectedSize,
      'zip',
    );
    add(
      family,
      'full-resource',
      version,
      'resource',
      release.fullResource,
      release.fullResourceFingerprint,
      release.fullResourceExpectedSize,
      'zip',
    );
    Object.entries(release.components ?? {}).forEach(([name, component]) => {
      if (component.target === 'ROMLOADER') return;
      if (deviceType === 'neo' && ['SE03', 'SE04'].includes(component.target))
        return;
      add(
        family,
        name,
        (component.version ?? release.version).join('.'),
        'component',
        component.url,
        component.fingerprint,
        component.expectedSize,
      );
    });
    const resource = release.resources?.source;
    if (resource)
      add(
        family,
        'protocol-v2-resource-archive',
        version,
        'resource',
        resource.archiveUrl,
        resource.archiveSha256,
        resource.archiveSize,
        'zip',
      );
  });
  if ('ble' in model) {
    const release = [...(model.ble ?? [])]
      .filter(
        (entry) =>
          Array.isArray(entry.version) &&
          entry.version.length === 3 &&
          entry.version.every((v) => Number.isSafeInteger(v) && v >= 0),
      )
      .toSorted((a, b) =>
        compareVersions(b.version.join('.'), a.version.join('.')),
      )[0];
    if (release) {
      const version = release.version.join('.');
      add(
        'ble',
        'dfu',
        version,
        'ble',
        release.url,
        release.fingerprint,
        release.expectedSize,
      );
      add(
        'ble',
        'web',
        version,
        'ble',
        release.webUpdate,
        release.fingerprintWeb,
        undefined,
      );
    }
  }
  return results;
}

export class FirmwareArtifactCache {
  private readonly mutex = new Mutex();

  private pendingModels = new Map<string, Promise<void>>();

  private wantedSlots = new Map<string, string>();

  private lastPrefetch = new Map<string, number>();

  private restored = false;

  constructor(
    private store?: ICacheStore,
    private readonly adapter: IFirmwareArtifactAdapter = firmwareArtifactAdapter,
    private readonly report = (params: IFirmwareArtifactDownloadTelemetry) =>
      getHardwareTelemetry().report({ kind: 'download', params }),
  ) {}

  private async getStore(): Promise<ICacheStore> {
    this.store ??= (
      await import('../../dbs/simple/simpleDb')
    ).default.firmwareArtifactCache;
    return this.store;
  }

  private emit(params: IFirmwareArtifactDownloadTelemetry): void {
    try {
      this.report(params);
    } catch {
      // Diagnostics must never interrupt firmware downloads.
    }
  }

  private async savePins(
    slots: Record<string, IFirmwareCacheEntry>,
  ): Promise<void> {
    const store = await this.getStore();
    const old = await store.getState();
    const { leaseRef } = await this.adapter.createLease(
      `firmware-cache:${generateUUID()}`,
    );
    try {
      for (const artifactRef of new Set(
        Object.values(slots).map((entry) => entry.artifactRef),
      )) {
        await this.adapter.retain({ leaseRef, artifactRef });
      }
      await store.saveState({ slots, leaseRef });
    } catch (error) {
      await this.adapter
        .releaseLease({ leaseRef, disposition: 'safeCancelled' })
        .catch(() => undefined);
      throw error;
    }
    if (old.leaseRef && old.leaseRef !== leaseRef) {
      await this.adapter
        .releaseLease({ leaseRef: old.leaseRef, disposition: 'completed' })
        .catch(() => undefined);
    }
  }

  async restorePins(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      if (this.restored) return;
      const state = await (await this.getStore()).getState();
      if (state.leaseRef) {
        try {
          for (const entry of Object.values(state.slots)) {
            await this.adapter.retain({
              leaseRef: state.leaseRef,
              artifactRef: entry.artifactRef,
            });
          }
          this.restored = true;
          return;
        } catch {
          // Native leases survive a bg reload, but not a complete app restart.
        }
      }
      if (Object.keys(state.slots).length) {
        const available: Record<string, IFirmwareCacheEntry> = {};
        for (const [slot, entry] of Object.entries(state.slots)) {
          try {
            const reader = await this.adapter.open(entry.artifactRef);
            try {
              if (reader.size === entry.size) available[slot] = entry;
            } finally {
              await this.adapter.close(reader.readerId);
            }
          } catch {
            // Missing/corrupt files must not prevent refreshing the model cache.
          }
        }
        await this.savePins(available);
      }
      this.restored = true;
    });
  }

  private async remember(
    context: IFirmwareDownloadContext,
    artifact: IFirmwareDownloadArtifact,
    receipt: IFirmwareArtifactReceipt,
  ): Promise<void> {
    let slot = context.cacheSlot;
    let version = context.targetVersion;
    if (!slot) {
      const config = await getFirmwareManifestSnapshot({
        preRelease: context.releaseChannel === 'pre-release',
      });
      const match = getFirmwareModelArtifacts(
        config,
        context.deviceType,
        context.releaseChannel,
      ).find(
        (entry) =>
          entry.artifact.expectedSha256 === receipt.sha256 &&
          (entry.firmwareType === context.firmwareType ||
            entry.artifact.role === 'ble'),
      );
      slot = match?.slot;
      version = match?.version;
    }
    if (
      !slot ||
      !version ||
      artifact.expectedSha256?.toLowerCase() !== receipt.sha256
    )
      return;
    const cacheSlot = slot;
    const targetVersion = version;
    await this.mutex.runExclusive(async () => {
      if (
        this.wantedSlots.has(cacheSlot) &&
        this.wantedSlots.get(cacheSlot) !== receipt.sha256
      )
        return;
      const state = await (await this.getStore()).getState();
      const previous = state.slots[cacheSlot];
      if (previous && compareVersions(targetVersion, previous.version) < 0)
        return;
      if (previous?.sha256 === receipt.sha256) return;
      await this.savePins({
        ...state.slots,
        [cacheSlot]: {
          artifactRef: receipt.artifactRef,
          sha256: receipt.sha256,
          size: receipt.size,
          version: targetVersion,
        },
      });
    });
  }

  async download(
    artifact: IFirmwareDownloadArtifact,
    leaseRef: string,
    context: IFirmwareDownloadContext,
    operation: () => Promise<IFirmwareArtifactReceipt>,
  ): Promise<IFirmwareArtifactReceipt> {
    const startedAt = Date.now();
    const params = {
      deviceType: context.deviceType,
      firmwareType: context.firmwareType,
      releaseChannel: context.releaseChannel,
      source: context.source,
      artifactRole: artifact.role,
      targetVersion: context.targetVersion,
      sha256: artifact.expectedSha256,
      platform: artifactPlatform(),
    };
    this.emit({ ...params, phase: 'started' });
    let cacheHit = false;
    try {
      await this.restorePins().catch(() => {
        console.warn(
          '[FirmwareArtifactCache] Unable to restore latest artifact pins',
        );
      });
      if (isSha256(artifact.expectedSha256)) {
        const artifactRef = `fw:${artifact.expectedSha256.toLowerCase()}`;
        try {
          await this.adapter.retain({ leaseRef, artifactRef });
          const reader = await this.adapter.open(artifactRef);
          try {
            cacheHit =
              artifact.expectedSize === undefined ||
              artifact.expectedSize === reader.size;
          } finally {
            await this.adapter.close(reader.readerId);
          }
        } catch {
          cacheHit = false;
        }
      }
      const receipt = await operation();
      await this.remember(context, artifact, receipt).catch(() => {
        console.warn(
          '[FirmwareArtifactCache] Latest artifact pin could not be persisted',
        );
      });
      this.emit({
        ...params,
        phase: 'finished',
        status: 'success',
        cacheHit,
        durationMs: Date.now() - startedAt,
        bytes: receipt.size,
      });
      return receipt;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const errorCode =
        /\b(ARTIFACT_[A-Z0-9_]+)\b/u.exec(message)?.[1] ??
        'ARTIFACT_DOWNLOAD_FAILED';
      this.emit({
        ...params,
        phase: 'finished',
        status: errorCode === 'ARTIFACT_CANCELLED' ? 'cancelled' : 'failed',
        cacheHit,
        durationMs: Date.now() - startedAt,
        errorCode,
      });
      throw error;
    }
  }

  async prefetch(
    deviceTypes: readonly string[],
    preRelease: boolean,
    download: IDownload,
  ): Promise<void> {
    if (!(platformEnv.isNative || platformEnv.isDesktop)) return;
    const releaseChannel = preRelease ? 'pre-release' : 'stable';
    let config: RemoteConfigResponse;
    try {
      await this.restorePins();
      config = await getFirmwareManifestSnapshot({ preRelease });
    } catch {
      for (const deviceType of new Set(deviceTypes)) {
        this.emit({
          deviceType,
          firmwareType: 'unknown',
          releaseChannel,
          source: 'prefetch',
          artifactRole: 'manifest',
          phase: 'finished',
          status: 'failed',
          errorCode: 'ARTIFACT_PREFETCH_INITIALIZATION_FAILED',
          platform: artifactPlatform(),
        });
      }
      return;
    }
    for (const deviceType of new Set(deviceTypes)) {
      const artifacts = getFirmwareModelArtifacts(
        config,
        deviceType,
        releaseChannel,
      );
      for (const entry of artifacts)
        this.wantedSlots.set(entry.slot, entry.artifact.expectedSha256 ?? '');
      const key = artifacts
        .map((entry) => `${entry.slot}:${entry.artifact.expectedSha256}`)
        .join('|');
      const last = this.lastPrefetch.get(key);
      if (
        key &&
        (last === undefined || Date.now() - last >= 3 * 60 * 60 * 1000)
      ) {
        const pending = this.pendingModels.get(key);
        if (pending) {
          await pending.catch(() => undefined);
        } else {
          const operation = this.prefetchModel(
            deviceType,
            releaseChannel,
            artifacts,
            download,
          )
            .then(() => {
              this.lastPrefetch.set(key, Date.now());
            })
            .finally(() => this.pendingModels.delete(key));
          this.pendingModels.set(key, operation);
          await operation.catch(() => undefined);
        }
      }
    }
  }

  private async prefetchModel(
    deviceType: string,
    releaseChannel: IFirmwareDownloadContext['releaseChannel'],
    artifacts: ICatalogArtifact[],
    download: IDownload,
  ): Promise<void> {
    let failed = false;
    for (const entry of artifacts) {
      const hash = entry.artifact.expectedSha256;
      if (!hash)
        throw new OneKeyLocalError(
          'Prefetch artifact integrity metadata is unavailable',
        );
      const transactionId = `prefetch:${deviceType}:${hash.slice(0, 32)}`;
      let leaseRef: string | undefined;
      let completed = false;
      try {
        ({ leaseRef } = await this.adapter.createLease(transactionId));
        await download({
          artifact: entry.artifact,
          artifactId: entry.artifact.logicalName ?? entry.artifact.role,
          taskId: `prefetch-${hash.slice(0, 24)}`,
          transactionId,
          leaseRef,
          deadlineAt: Date.now() + 30 * 60 * 1000,
          downloadContext: {
            deviceType,
            firmwareType: entry.firmwareType,
            releaseChannel,
            source: 'prefetch',
            targetVersion: entry.version,
            cacheSlot: entry.slot,
          },
        });
        completed = true;
      } catch {
        failed = true;
        if (!leaseRef)
          this.emit({
            deviceType,
            firmwareType: entry.firmwareType,
            releaseChannel,
            source: 'prefetch',
            artifactRole: entry.artifact.role,
            targetVersion: entry.version,
            sha256: hash,
            phase: 'finished',
            status: 'failed',
            errorCode: 'ARTIFACT_LEASE_CREATE_FAILED',
            platform: artifactPlatform(),
          });
      } finally {
        if (leaseRef)
          await this.adapter
            .releaseLease({
              leaseRef,
              disposition: completed ? 'completed' : 'safeCancelled',
            })
            .catch(() => undefined);
      }
    }
    if (failed)
      throw new OneKeyLocalError('Firmware prefetch did not complete');
    // Removed manifest roles stop pinning files only after the new set is ready.
    await this.mutex.runExclusive(async () => {
      const state = await (await this.getStore()).getState();
      if (
        !artifacts.every(
          (entry) =>
            state.slots[entry.slot]?.sha256 === entry.artifact.expectedSha256,
        )
      )
        throw new OneKeyLocalError(
          'Firmware prefetch cache pins are incomplete',
        );
      const slots = { ...state.slots };
      const desired = new Set(artifacts.map((entry) => entry.slot));
      const prefix = `${deviceType}:${releaseChannel}:`;
      for (const slot of Object.keys(slots)) {
        if (slot.startsWith(prefix) && !desired.has(slot)) delete slots[slot];
      }
      if (Object.keys(slots).length !== Object.keys(state.slots).length)
        await this.savePins(slots);
    });
  }
}

let cache: FirmwareArtifactCache | undefined;

export function getFirmwareArtifactCache(): FirmwareArtifactCache {
  if (platformEnv.isNativeMainThread && !platformEnv.isJest)
    throw new OneKeyLocalError(
      'Firmware artifact cache must run in background',
    );
  cache ??= new FirmwareArtifactCache();
  return cache;
}
