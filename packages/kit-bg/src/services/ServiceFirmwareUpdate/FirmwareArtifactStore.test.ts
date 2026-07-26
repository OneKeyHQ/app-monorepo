import { sha256 } from '@noble/hashes/sha256';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  FIRMWARE_ARTIFACT_MAX_READ_BYTES,
  FirmwareArtifactStore,
  getFirmwareArtifactCacheKey,
} from './FirmwareArtifactStore';

import type {
  IFirmwareArtifactAdapterCapabilities,
  IFirmwareArtifactAdapterReceipt,
  IFirmwareArtifactAdapterStatus,
  IFirmwareArtifactStoreAdapter,
} from './FirmwareArtifactStore';
import type {
  IFirmwareArtifactRequirement,
  IFirmwarePreparedPlan,
} from './firmwareUpdateCoordinatorTypes';

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');

const digest = (bytes: Uint8Array): string => bytesToHex(sha256(bytes));

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

const makeBytes = (size: number, seed = 17): Uint8Array =>
  Uint8Array.from({ length: size }, (_, index) => (index * 31 + seed) % 256);

const makeRequirement = ({
  bytes = makeBytes(1024),
  artifactId = 'firmware-main',
  container = { kind: 'raw' } as const,
  role = 'firmware' as const,
  sourceUrls = ['https://common.onekey-asset.com/firmware.bin'],
}: {
  bytes?: Uint8Array;
  artifactId?: string;
  container?: IFirmwareArtifactRequirement['container'];
  role?: IFirmwareArtifactRequirement['role'];
  sourceUrls?: readonly string[];
} = {}): IFirmwareArtifactRequirement => ({
  artifactId,
  role,
  sourceUrls,
  expectedSize: bytes.byteLength,
  expectedSha256: digest(bytes),
  integrity: 'catalog-trusted',
  container,
  target: 'firmware',
  devicePathRule: { kind: 'none' },
  dependsOn: [],
});

const makeReceipt = ({
  requirement,
  artifactRef,
}: {
  requirement: IFirmwareArtifactRequirement;
  artifactRef: string;
}): IFirmwareArtifactAdapterReceipt => ({
  artifactRef,
  size: requirement.expectedSize ?? 0,
  sha256: requirement.expectedSha256 ?? '',
  immutableToken: `token-${artifactRef}`,
});

const createAdapter = () => {
  const bytesByRef = new Map<string, Uint8Array>();
  const readerRefById = new Map<string, string>();
  let readerSequence = 0;

  const adapter: IFirmwareArtifactStoreAdapter = {
    getCapabilities: jest.fn(
      async (): Promise<IFirmwareArtifactAdapterCapabilities> => ({
        firmwareArtifactProtocolVersion: 1,
        supportedRouteTypes: ['domain', 'pinnedIp'],
        supportsArchiveMaterialization: true,
        maxReadBytes: FIRMWARE_ARTIFACT_MAX_READ_BYTES,
      }),
    ),
    downloadArtifact: jest.fn(async () => {
      throw new OneKeyLocalError('downloadArtifact mock not configured');
    }),
    getArtifactStatus: jest.fn(
      async (): Promise<IFirmwareArtifactAdapterStatus> => ({
        state: 'notFound',
        downloadedBytes: 0,
      }),
    ),
    cancelDownload: jest.fn(async () => undefined),
    quarantineArtifact: jest.fn(async ({ artifactRef }) => {
      bytesByRef.delete(artifactRef);
    }),
    openArtifact: jest.fn(async (receipt) => {
      if (!bytesByRef.has(receipt.artifactRef)) {
        throw new OneKeyLocalError('artifact missing');
      }
      readerSequence += 1;
      const readerId = `reader-${readerSequence}`;
      readerRefById.set(readerId, receipt.artifactRef);
      return {
        readerId,
        size: receipt.size,
        immutableToken: receipt.immutableToken,
        maxReadBytes: FIRMWARE_ARTIFACT_MAX_READ_BYTES,
      };
    }),
    readArtifact: jest.fn(async ({ readerId, offset, length }) => {
      const artifactRef = readerRefById.get(readerId);
      const bytes = artifactRef ? bytesByRef.get(artifactRef) : undefined;
      if (!bytes) {
        throw new OneKeyLocalError('reader missing');
      }
      return toArrayBuffer(bytes.slice(offset, offset + length));
    }),
    closeArtifact: jest.fn(async ({ readerId }) => {
      readerRefById.delete(readerId);
    }),
    materializeArchive: jest.fn(async () => ({
      artifacts: [],
    })),
    createLease: jest.fn(async () => ({ leaseRef: 'lease-1' })),
    retainArtifact: jest.fn(async () => undefined),
    releaseLease: jest.fn(async () => undefined),
    reconcileLeases: jest.fn(async () => undefined),
    sweepOrphans: jest.fn(async () => ({
      deletedFiles: 0,
      deletedBytes: 0,
    })),
  };

  return {
    adapter: adapter as jest.Mocked<IFirmwareArtifactStoreAdapter>,
    bytesByRef,
  };
};

describe('FirmwareArtifactStore', () => {
  test('accepts only trusted plan requirements and declared HTTPS URLs', async () => {
    const { adapter } = createAdapter();
    const store = new FirmwareArtifactStore(adapter);
    const requirement = makeRequirement();

    await expect(
      store.downloadArtifact({
        leaseRef: 'lease-1',
        requirement,
        route: {
          type: 'domain',
          url: 'https://attacker.example/firmware.bin',
        },
      }),
    ).rejects.toMatchObject({
      firmwareArtifactStoreCode: 'INVALID_ROUTE',
    });

    await expect(
      store.downloadArtifact({
        leaseRef: 'lease-1',
        requirement: {
          ...requirement,
          integrity: 'legacy-unverified',
        },
        route: {
          type: 'domain',
          url: requirement.sourceUrls[0],
        },
      }),
    ).rejects.toMatchObject({
      firmwareArtifactStoreCode: 'INVALID_REQUIREMENT',
    });

    expect(adapter.downloadArtifact).not.toHaveBeenCalled();
  });

  test('uses digest and size as cache identity and rehashes cache hits in 256KiB chunks', async () => {
    const { adapter, bytesByRef } = createAdapter();
    const bytes = makeBytes(FIRMWARE_ARTIFACT_MAX_READ_BYTES + 19);
    const requirement = makeRequirement({ bytes });
    const receipt = makeReceipt({
      requirement,
      artifactRef: 'cached-artifact',
    });
    bytesByRef.set(receipt.artifactRef, bytes);
    adapter.getArtifactStatus.mockResolvedValue({
      state: 'completed',
      downloadedBytes: bytes.byteLength,
      receipt,
    });
    const store = new FirmwareArtifactStore(adapter);

    const result = await store.downloadArtifact({
      leaseRef: 'lease-1',
      requirement,
      route: {
        type: 'domain',
        url: requirement.sourceUrls[0],
      },
    });

    expect(result.taskId).toBe(getFirmwareArtifactCacheKey(requirement));
    expect(result.preparedReceipt).toMatchObject({
      artifactId: requirement.artifactId,
      artifactRef: receipt.artifactRef,
      leaseId: 'lease-1',
      materialization: { kind: 'raw' },
    });
    expect(adapter.downloadArtifact).not.toHaveBeenCalled();
    expect(adapter.readArtifact).toHaveBeenNthCalledWith(1, {
      readerId: 'reader-1',
      offset: 0,
      length: FIRMWARE_ARTIFACT_MAX_READ_BYTES,
    });
    expect(adapter.readArtifact).toHaveBeenNthCalledWith(2, {
      readerId: 'reader-1',
      offset: FIRMWARE_ARTIFACT_MAX_READ_BYTES,
      length: 19,
    });
  });

  test('quarantines a corrupt cache hit before downloading a replacement', async () => {
    const { adapter, bytesByRef } = createAdapter();
    const expectedBytes = makeBytes(2048);
    const corruptBytes = makeBytes(2048, 99);
    const requirement = makeRequirement({ bytes: expectedBytes });
    const cachedReceipt = makeReceipt({
      requirement,
      artifactRef: 'corrupt-cache',
    });
    const replacementReceipt = makeReceipt({
      requirement,
      artifactRef: 'replacement',
    });
    bytesByRef.set(cachedReceipt.artifactRef, corruptBytes);
    bytesByRef.set(replacementReceipt.artifactRef, expectedBytes);
    adapter.getArtifactStatus.mockResolvedValue({
      state: 'completed',
      downloadedBytes: corruptBytes.byteLength,
      receipt: cachedReceipt,
    });
    adapter.downloadArtifact.mockResolvedValue(replacementReceipt);
    const store = new FirmwareArtifactStore(adapter);

    const result = await store.downloadArtifact({
      leaseRef: 'lease-1',
      requirement,
      route: {
        type: 'pinnedIp',
        url: requirement.sourceUrls[0],
        resolvedIp: '203.0.113.7',
      },
    });

    expect(adapter.quarantineArtifact).toHaveBeenCalledWith({
      artifactRef: cachedReceipt.artifactRef,
    });
    expect(adapter.downloadArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: getFirmwareArtifactCacheKey(requirement),
        taskId: getFirmwareArtifactCacheKey(requirement),
        routeType: 'pinnedIp',
        resolvedIp: '203.0.113.7',
        maxBytes: expectedBytes.byteLength,
      }),
    );
    expect(result.adapterReceipt).toEqual(replacementReceipt);
  });

  test('materializes only declared children of the verified archive', async () => {
    const { adapter, bytesByRef } = createAdapter();
    const archiveBytes = makeBytes(4096);
    const archiveRequirement = makeRequirement({
      bytes: archiveBytes,
      artifactId: 'pro2-bundle',
      container: { kind: 'archive', format: 'zip' },
      role: 'resource-bundle',
    });
    const archiveReceipt = makeReceipt({
      requirement: archiveRequirement,
      artifactRef: 'archive-ref',
    });
    bytesByRef.set(archiveReceipt.artifactRef, archiveBytes);
    const entryBytes = makeBytes(700, 41);
    const entryRequirement = makeRequirement({
      bytes: entryBytes,
      artifactId: 'pro2-resource-entry',
      container: {
        kind: 'archive-entry',
        parentArtifactId: archiveRequirement.artifactId,
        entryId: 'assets/resource.bin',
      },
      role: 'archive-entry',
      sourceUrls: [],
    });
    const entryReceipt = makeReceipt({
      requirement: entryRequirement,
      artifactRef: 'entry-ref',
    });
    bytesByRef.set(entryReceipt.artifactRef, entryBytes);
    adapter.materializeArchive.mockResolvedValue({
      artifacts: [
        {
          archiveName: 'assets/resource.bin',
          artifactId: getFirmwareArtifactCacheKey(entryRequirement),
          receipt: entryReceipt,
        },
      ],
    });
    const store = new FirmwareArtifactStore(adapter);
    const archive = await store.restoreArtifact({
      leaseRef: 'lease-1',
      requirement: archiveRequirement,
      adapterReceipt: archiveReceipt,
    });

    const [entry] = await store.materializeArchive({
      leaseRef: 'lease-1',
      archive,
      entries: [entryRequirement],
    });

    expect(entry.preparedReceipt).toMatchObject({
      artifactId: entryRequirement.artifactId,
      materialization: {
        kind: 'archive-entry',
        parentArtifactId: archiveRequirement.artifactId,
        entryId: 'assets/resource.bin',
      },
    });
    expect(adapter.materializeArchive).toHaveBeenCalledWith({
      leaseRef: 'lease-1',
      archiveArtifactRef: archiveReceipt.artifactRef,
      archiveImmutableToken: archiveReceipt.immutableToken,
      entries: [
        {
          archiveName: 'assets/resource.bin',
          artifactId: getFirmwareArtifactCacheKey(entryRequirement),
          expectedSize: entryBytes.byteLength,
          expectedSha256: digest(entryBytes),
        },
      ],
    });
  });

  test('rejects archive entries that do not belong to the parent', async () => {
    const { adapter, bytesByRef } = createAdapter();
    const archiveBytes = makeBytes(512);
    const archiveRequirement = makeRequirement({
      bytes: archiveBytes,
      artifactId: 'archive',
      container: { kind: 'archive', format: 'zip' },
    });
    const archiveReceipt = makeReceipt({
      requirement: archiveRequirement,
      artifactRef: 'archive-ref',
    });
    bytesByRef.set(archiveReceipt.artifactRef, archiveBytes);
    const store = new FirmwareArtifactStore(adapter);
    const archive = await store.restoreArtifact({
      leaseRef: 'lease-1',
      requirement: archiveRequirement,
      adapterReceipt: archiveReceipt,
    });
    const wrongChild = makeRequirement({
      artifactId: 'wrong-child',
      container: {
        kind: 'archive-entry',
        parentArtifactId: 'another-archive',
        entryId: 'wrong.bin',
      },
      sourceUrls: [],
    });

    await expect(
      store.materializeArchive({
        leaseRef: 'lease-1',
        archive,
        entries: [wrongChild],
      }),
    ).rejects.toMatchObject({
      firmwareArtifactStoreCode: 'ARCHIVE_RELATIONSHIP_INVALID',
    });
    expect(adapter.materializeArchive).not.toHaveBeenCalled();
  });

  test('implements the SDK reader contract without full-artifact JS copies', async () => {
    const { adapter, bytesByRef } = createAdapter();
    const bytes = makeBytes(2048);
    const requirement = makeRequirement({ bytes });
    const receipt = makeReceipt({
      requirement,
      artifactRef: 'reader-artifact',
    });
    bytesByRef.set(receipt.artifactRef, bytes);
    const store = new FirmwareArtifactStore(adapter);
    await store.restoreArtifact({
      leaseRef: 'lease-1',
      requirement,
      adapterReceipt: receipt,
    });
    const reader = store.createArtifactReader();
    const opened = await reader.open({ artifactRef: receipt.artifactRef });

    const result = await reader.read({
      readerId: opened.readerId,
      operationId: 'read-1',
      offset: 1024,
      length: 1024,
    });

    expect(new Uint8Array(result.data)).toEqual(bytes.slice(1024));
    expect(result).toMatchObject({
      bytesRead: 1024,
      eof: true,
    });
    await expect(
      reader.read({
        readerId: opened.readerId,
        operationId: 'too-large',
        offset: 0,
        length: FIRMWARE_ARTIFACT_MAX_READ_BYTES + 1,
      }),
    ).rejects.toMatchObject({
      firmwareArtifactStoreCode: 'ARTIFACT_READER_INVALID',
    });
    await reader.close({ readerId: opened.readerId });
  });

  test('reopens and revalidates prepared receipts after a JS restart', async () => {
    const { adapter, bytesByRef } = createAdapter();
    const bytes = makeBytes(FIRMWARE_ARTIFACT_MAX_READ_BYTES + 9);
    const requirement = makeRequirement({ bytes });
    const receipt = makeReceipt({
      requirement,
      artifactRef: 'prepared-artifact',
    });
    bytesByRef.set(receipt.artifactRef, bytes);
    adapter.getArtifactStatus.mockResolvedValue({
      state: 'completed',
      downloadedBytes: bytes.byteLength,
      receipt,
    });
    const preparedPlan: IFirmwarePreparedPlan = {
      schemaVersion: 1,
      planId: 'plan-1',
      planDigest: 'a'.repeat(64),
      manifestSnapshotDigest: 'b'.repeat(64),
      catalogEpoch: 1,
      networkPolicy: 'forbid',
      device: {
        identity: 'device-1',
        model: 'classic1s',
      },
      artifactReceipts: [
        {
          artifactId: requirement.artifactId,
          role: requirement.role,
          target: requirement.target,
          artifactRef: receipt.artifactRef,
          size: receipt.size,
          sha256: receipt.sha256,
          integrity: requirement.integrity,
          leaseId: 'lease-1',
          materialization: { kind: 'raw' },
        },
      ],
      epochs: [
        {
          epochId: 'install',
          kind: 'component-install',
          artifactIds: [requirement.artifactId],
          dependsOn: [],
          targetIds: [requirement.target],
        },
      ],
      expectedFinalStates: [
        {
          target: requirement.target,
          version: '4.0.0',
        },
      ],
    };
    const store = new FirmwareArtifactStore(adapter);

    await store.restorePreparedPlan(preparedPlan);
    const reader = store.createArtifactReader();
    const opened = await reader.open({ artifactRef: receipt.artifactRef });

    expect(adapter.getArtifactStatus).toHaveBeenCalledWith({
      leaseRef: 'lease-1',
      taskId: getFirmwareArtifactCacheKey(requirement),
    });
    expect(adapter.retainArtifact).toHaveBeenCalledWith({
      leaseRef: 'lease-1',
      artifactRef: receipt.artifactRef,
    });
    expect(opened.size).toBe(bytes.byteLength);
    await reader.close({ readerId: opened.readerId });
  });

  test('tombstones a cancelled bounded native read result', async () => {
    const { adapter, bytesByRef } = createAdapter();
    const bytes = makeBytes(1024);
    const requirement = makeRequirement({ bytes });
    const receipt = makeReceipt({
      requirement,
      artifactRef: 'cancel-artifact',
    });
    bytesByRef.set(receipt.artifactRef, bytes);
    const store = new FirmwareArtifactStore(adapter);
    await store.restoreArtifact({
      leaseRef: 'lease-1',
      requirement,
      adapterReceipt: receipt,
    });
    const reader = store.createArtifactReader();
    const opened = await reader.open({ artifactRef: receipt.artifactRef });
    let resolveRead: ((value: ArrayBuffer) => void) | undefined;
    adapter.readArtifact.mockImplementationOnce(
      () =>
        new Promise<ArrayBuffer>((resolve) => {
          resolveRead = resolve;
        }),
    );

    const reading = reader.read({
      readerId: opened.readerId,
      operationId: 'cancel-me',
      offset: 0,
      length: 128,
    });
    await reader.cancel({ operationId: 'cancel-me' });
    resolveRead?.(toArrayBuffer(bytes.slice(0, 128)));

    await expect(reading).rejects.toMatchObject({
      firmwareArtifactStoreCode: 'ARTIFACT_READ_CANCELLED',
    });
    await reader.close({ readerId: opened.readerId });
  });

  test('delegates lease reconciliation, safe release, and deferred GC', async () => {
    const { adapter } = createAdapter();
    const store = new FirmwareArtifactStore(adapter);

    await expect(store.createLease('transaction-1')).resolves.toBe('lease-1');
    await store.reconcileLeases(['lease-1', 'lease-1', 'lease-2']);
    await store.releaseLease('lease-1', 'safeAbandoned');
    await store.sweepOrphans();

    expect(adapter.reconcileLeases).toHaveBeenCalledWith({
      activeLeaseRefs: ['lease-1', 'lease-2'],
    });
    expect(adapter.releaseLease).toHaveBeenCalledWith({
      leaseRef: 'lease-1',
      disposition: 'safeAbandoned',
    });
    expect(adapter.sweepOrphans).toHaveBeenCalledTimes(1);
  });
});
