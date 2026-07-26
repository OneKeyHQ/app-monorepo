import { sha256 } from '@noble/hashes/sha256';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  IFirmwareArtifactReader,
  IFirmwareArtifactRequirement,
  IFirmwarePreparedPlan,
} from './firmwareUpdateCoordinatorTypes';

export const FIRMWARE_ARTIFACT_MAX_READ_BYTES = 256 * 1024;
export const FIRMWARE_ARTIFACT_PROTOCOL_VERSION = 1;

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

export type IFirmwareArtifactRoute =
  | {
      type: 'domain';
      url: string;
    }
  | {
      type: 'pinnedIp';
      url: string;
      resolvedIp: string;
    };

export type IFirmwareArtifactAdapterReceipt = {
  artifactRef: string;
  size: number;
  sha256: string;
  immutableToken: string;
};

export type IFirmwareArtifactAdapterStatus = {
  state:
    | 'notFound'
    | 'queued'
    | 'downloading'
    | 'verifying'
    | 'completed'
    | 'cancelled'
    | 'failed';
  downloadedBytes: number;
  expectedSize?: number;
  receipt?: IFirmwareArtifactAdapterReceipt;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
};

export type IFirmwareArtifactAdapterCapabilities = {
  firmwareArtifactProtocolVersion: number;
  supportedRouteTypes: Array<'domain' | 'pinnedIp'>;
  supportsArchiveMaterialization: boolean;
  maxReadBytes: number;
};

export type IFirmwareArtifactLeaseDisposition =
  | 'completed'
  | 'safeCancelled'
  | 'safeAbandoned';

export type IFirmwareArchiveMaterializeEntry = {
  archiveName: string;
  artifactId: string;
  expectedSize: number;
  expectedSha256: string;
};

export type IFirmwareArchiveMaterializedArtifact = {
  archiveName: string;
  artifactId: string;
  receipt: IFirmwareArtifactAdapterReceipt;
};

export type IFirmwareArtifactStoreAdapter = {
  getCapabilities: () => Promise<IFirmwareArtifactAdapterCapabilities>;
  downloadArtifact: (input: {
    taskId: string;
    leaseRef: string;
    artifactId: string;
    url: string;
    routeType: 'domain' | 'pinnedIp';
    resolvedIp?: string;
    expectedSize: number;
    expectedSha256: string;
    maxBytes: number;
    segmentCount?: number;
    overallDeadlineSeconds?: number;
  }) => Promise<IFirmwareArtifactAdapterReceipt>;
  getArtifactStatus: (input: {
    leaseRef: string;
    taskId: string;
  }) => Promise<IFirmwareArtifactAdapterStatus>;
  cancelDownload: (input: {
    leaseRef: string;
    taskId: string;
  }) => Promise<void>;
  quarantineArtifact: (input: { artifactRef: string }) => Promise<void>;
  openArtifact: (input: IFirmwareArtifactAdapterReceipt) => Promise<{
    readerId: string;
    size: number;
    immutableToken: string;
    maxReadBytes: number;
  }>;
  readArtifact: (input: {
    readerId: string;
    offset: number;
    length: number;
  }) => Promise<ArrayBuffer>;
  closeArtifact: (input: { readerId: string }) => Promise<void>;
  materializeArchive: (input: {
    leaseRef: string;
    archiveArtifactRef: string;
    archiveImmutableToken: string;
    entries: IFirmwareArchiveMaterializeEntry[];
  }) => Promise<{
    artifacts: IFirmwareArchiveMaterializedArtifact[];
  }>;
  createLease: (input: {
    transactionId: string;
  }) => Promise<{ leaseRef: string }>;
  retainArtifact: (input: {
    leaseRef: string;
    artifactRef: string;
  }) => Promise<void>;
  releaseLease: (input: {
    leaseRef: string;
    disposition: IFirmwareArtifactLeaseDisposition;
  }) => Promise<void>;
  reconcileLeases: (input: { activeLeaseRefs: string[] }) => Promise<void>;
  sweepOrphans: () => Promise<{
    deletedFiles: number;
    deletedBytes: number;
  }>;
};

export type IFirmwarePreparedArtifactReceipt = {
  artifactId: string;
  role: IFirmwareArtifactRequirement['role'];
  target: IFirmwareArtifactRequirement['target'];
  logicalName?: string;
  artifactRef: string;
  size: number;
  sha256: string;
  integrity: IFirmwareArtifactRequirement['integrity'];
  leaseId: string;
  materialization:
    | {
        kind: 'raw';
      }
    | {
        kind: 'archive-entry';
        parentArtifactId: string;
        entryId: string;
      };
};

export type IFirmwareStoredArtifact = {
  taskId: string;
  requirement: IFirmwareArtifactRequirement;
  adapterReceipt: IFirmwareArtifactAdapterReceipt;
  preparedReceipt: IFirmwarePreparedArtifactReceipt;
  acquisition?: {
    routeType: IFirmwareArtifactRoute['type'];
    bytesReused: number;
    resumeKind: 'none' | 'range' | 'segments';
    resumeCount: number;
  };
};

export type EFirmwareArtifactStoreErrorCode =
  | 'ADAPTER_CAPABILITY_MISMATCH'
  | 'INVALID_REQUIREMENT'
  | 'INVALID_ROUTE'
  | 'INVALID_RECEIPT'
  | 'ARTIFACT_INTEGRITY_MISMATCH'
  | 'ARTIFACT_QUARANTINE_FAILED'
  | 'ARTIFACT_READER_INVALID'
  | 'ARTIFACT_READ_CANCELLED'
  | 'ARTIFACT_RESTORE_UNAVAILABLE'
  | 'ARCHIVE_RELATIONSHIP_INVALID'
  | 'RUNTIME_NOT_SUPPORTED';

export type IFirmwareArtifactStoreError = OneKeyLocalError & {
  firmwareArtifactStoreCode: EFirmwareArtifactStoreErrorCode;
};

type IActiveReader = {
  artifactRef: string;
  size: number;
  activeOperationId?: string;
  closed: boolean;
};

const createStoreError = (
  code: EFirmwareArtifactStoreErrorCode,
  message: string,
): IFirmwareArtifactStoreError =>
  Object.assign(new OneKeyLocalError(message), {
    firmwareArtifactStoreCode: code,
  });

const fail = (
  code: EFirmwareArtifactStoreErrorCode,
  message: string,
): never => {
  throw createStoreError(code, message);
};

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');

const assertOpaqueRef = (value: string, field: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    return fail(
      'INVALID_RECEIPT',
      `${field} must be a non-empty opaque reference`,
    );
  }
  return value;
};

const assertBackgroundRuntime = () => {
  if (
    !platformEnv.isJest &&
    (platformEnv.isWeb ||
      platformEnv.isExtension ||
      (platformEnv.isNative && platformEnv.isNativeMainThread))
  ) {
    fail(
      'RUNTIME_NOT_SUPPORTED',
      'FirmwareArtifactStore is available only in Desktop standalone or Native background runtime',
    );
  }
};

const normalizeRequirement = (
  requirement: IFirmwareArtifactRequirement,
): {
  expectedSize: number;
  expectedSha256: string;
} => {
  const expectedSize = requirement?.expectedSize;
  const expectedSha256 = requirement?.expectedSha256;
  if (
    !requirement ||
    typeof requirement.artifactId !== 'string' ||
    requirement.artifactId.length === 0 ||
    !Array.isArray(requirement.sourceUrls) ||
    typeof expectedSize !== 'number' ||
    !Number.isSafeInteger(expectedSize) ||
    expectedSize <= 0 ||
    typeof expectedSha256 !== 'string' ||
    !SHA256_PATTERN.test(expectedSha256) ||
    requirement.integrity === 'legacy-unverified'
  ) {
    return fail(
      'INVALID_REQUIREMENT',
      'Firmware artifact requirement must have trusted SHA-256 and size metadata',
    );
  }
  return {
    expectedSize,
    expectedSha256: expectedSha256.toLowerCase(),
  };
};

export const getFirmwareArtifactCacheKey = (
  requirement: IFirmwareArtifactRequirement,
): string => {
  const { expectedSize, expectedSha256 } = normalizeRequirement(requirement);
  return `fw-${expectedSha256}-${expectedSize}`;
};

const assertDownloadableRequirement = (
  requirement: IFirmwareArtifactRequirement,
) => {
  normalizeRequirement(requirement);
  if (requirement.container.kind === 'archive-entry') {
    fail(
      'INVALID_REQUIREMENT',
      `Archive entry ${requirement.artifactId} must be materialized from its parent`,
    );
  }
};

const assertRoute = (
  requirement: IFirmwareArtifactRequirement,
  route: IFirmwareArtifactRoute,
) => {
  if (!requirement.sourceUrls.includes(route.url)) {
    fail(
      'INVALID_ROUTE',
      `Route URL is not declared by artifact ${requirement.artifactId}`,
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(route.url);
  } catch {
    return fail('INVALID_ROUTE', 'Firmware artifact route URL is invalid');
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    fail(
      'INVALID_ROUTE',
      'Firmware artifact routes require HTTPS without credentials or fragments',
    );
  }
  if (
    route.type === 'pinnedIp' &&
    (typeof route.resolvedIp !== 'string' || route.resolvedIp.length === 0)
  ) {
    fail('INVALID_ROUTE', 'Pinned firmware artifact route requires an IP');
  }
};

const assertReceiptShape = (
  receipt: IFirmwareArtifactAdapterReceipt,
  requirement: IFirmwareArtifactRequirement,
) => {
  const { expectedSize, expectedSha256 } = normalizeRequirement(requirement);
  assertOpaqueRef(receipt.artifactRef, 'artifactRef');
  assertOpaqueRef(receipt.immutableToken, 'immutableToken');
  if (
    receipt.size !== expectedSize ||
    typeof receipt.sha256 !== 'string' ||
    receipt.sha256.toLowerCase() !== expectedSha256
  ) {
    fail(
      'INVALID_RECEIPT',
      `Artifact receipt does not match requirement ${requirement.artifactId}`,
    );
  }
};

const toPreparedReceipt = ({
  requirement,
  leaseRef,
  adapterReceipt,
}: {
  requirement: IFirmwareArtifactRequirement;
  leaseRef: string;
  adapterReceipt: IFirmwareArtifactAdapterReceipt;
}): IFirmwarePreparedArtifactReceipt => {
  const materialization: IFirmwarePreparedArtifactReceipt['materialization'] =
    requirement.container.kind === 'archive-entry'
      ? {
          kind: 'archive-entry',
          parentArtifactId: requirement.container.parentArtifactId,
          entryId: requirement.container.entryId,
        }
      : { kind: 'raw' };
  return {
    artifactId: requirement.artifactId,
    role: requirement.role,
    target: requirement.target,
    ...(requirement.devicePathRule.kind === 'sdk-generated'
      ? { logicalName: requirement.devicePathRule.logicalName }
      : {}),
    artifactRef: adapterReceipt.artifactRef,
    size: adapterReceipt.size,
    sha256: adapterReceipt.sha256.toLowerCase(),
    integrity: requirement.integrity,
    leaseId: leaseRef,
    materialization,
  };
};

export class FirmwareArtifactStore {
  private capabilitiesPromise:
    | Promise<IFirmwareArtifactAdapterCapabilities>
    | undefined;

  private readonly receiptsByRef = new Map<
    string,
    IFirmwareArtifactAdapterReceipt
  >();

  private readonly readersById = new Map<string, IActiveReader>();

  private readonly readerIdByOperationId = new Map<string, string>();

  private readonly cancelledOperationIds = new Set<string>();

  constructor(private readonly adapter: IFirmwareArtifactStoreAdapter) {
    assertBackgroundRuntime();
  }

  private async getCapabilities() {
    this.capabilitiesPromise ??= this.adapter
      .getCapabilities()
      .then((value) => {
        if (
          value.firmwareArtifactProtocolVersion !==
            FIRMWARE_ARTIFACT_PROTOCOL_VERSION ||
          value.maxReadBytes < FIRMWARE_ARTIFACT_MAX_READ_BYTES ||
          !value.supportedRouteTypes.includes('domain') ||
          !value.supportedRouteTypes.includes('pinnedIp')
        ) {
          fail(
            'ADAPTER_CAPABILITY_MISMATCH',
            'Firmware artifact adapter does not satisfy protocol v1',
          );
        }
        return value;
      });
    return this.capabilitiesPromise;
  }

  async getCapabilitySnapshot(): Promise<IFirmwareArtifactAdapterCapabilities> {
    return this.getCapabilities();
  }

  async createLease(transactionId: string): Promise<string> {
    await this.getCapabilities();
    if (
      typeof transactionId !== 'string' ||
      transactionId.length === 0 ||
      new TextEncoder().encode(transactionId).byteLength > 256
    ) {
      fail(
        'INVALID_REQUIREMENT',
        'Firmware transactionId must be 1-256 UTF-8 bytes',
      );
    }
    const { leaseRef } = await this.adapter.createLease({ transactionId });
    return assertOpaqueRef(leaseRef, 'leaseRef');
  }

  async reconcileLeases(activeLeaseRefs: readonly string[]): Promise<void> {
    await this.getCapabilities();
    activeLeaseRefs.forEach((leaseRef) =>
      assertOpaqueRef(leaseRef, 'leaseRef'),
    );
    await this.adapter.reconcileLeases({
      activeLeaseRefs: [...new Set(activeLeaseRefs)],
    });
  }

  async releaseLease(
    leaseRef: string,
    disposition: IFirmwareArtifactLeaseDisposition,
  ): Promise<void> {
    await this.getCapabilities();
    assertOpaqueRef(leaseRef, 'leaseRef');
    await this.adapter.releaseLease({ leaseRef, disposition });
  }

  async sweepOrphans() {
    await this.getCapabilities();
    return this.adapter.sweepOrphans();
  }

  async cancelDownload(
    leaseRef: string,
    requirement: IFirmwareArtifactRequirement,
  ): Promise<void> {
    await this.getCapabilities();
    assertOpaqueRef(leaseRef, 'leaseRef');
    await this.adapter.cancelDownload({
      leaseRef,
      taskId: getFirmwareArtifactCacheKey(requirement),
    });
  }

  private async quarantineArtifact(artifactRef: string): Promise<void> {
    this.receiptsByRef.delete(artifactRef);
    try {
      await this.adapter.quarantineArtifact({ artifactRef });
    } catch {
      fail(
        'ARTIFACT_QUARANTINE_FAILED',
        `Failed to quarantine firmware artifact ${artifactRef}`,
      );
    }
  }

  private async verifyReceiptBytes({
    receipt,
    artifactId,
    expectedSize,
    expectedSha256,
  }: {
    receipt: IFirmwareArtifactAdapterReceipt;
    artifactId: string;
    expectedSize: number;
    expectedSha256: string;
  }): Promise<void> {
    let readerId: string | undefined;
    try {
      const opened = await this.adapter.openArtifact(receipt);
      readerId = assertOpaqueRef(opened.readerId, 'readerId');
      if (
        opened.size !== expectedSize ||
        opened.immutableToken !== receipt.immutableToken ||
        opened.maxReadBytes < FIRMWARE_ARTIFACT_MAX_READ_BYTES
      ) {
        fail(
          'ARTIFACT_INTEGRITY_MISMATCH',
          `Artifact ${artifactId} changed before verification`,
        );
      }
      const hash = sha256.create();
      let offset = 0;
      while (offset < expectedSize) {
        const length = Math.min(
          FIRMWARE_ARTIFACT_MAX_READ_BYTES,
          expectedSize - offset,
        );
        const data = await this.adapter.readArtifact({
          readerId,
          offset,
          length,
        });
        if (!(data instanceof ArrayBuffer) || data.byteLength !== length) {
          fail(
            'ARTIFACT_INTEGRITY_MISMATCH',
            `Artifact ${artifactId} returned a short verification read`,
          );
        }
        hash.update(new Uint8Array(data));
        offset += data.byteLength;
      }
      if (bytesToHex(hash.digest()) !== expectedSha256) {
        fail(
          'ARTIFACT_INTEGRITY_MISMATCH',
          `Artifact ${artifactId} failed streamed SHA-256 verification`,
        );
      }
    } catch (error) {
      if (
        error instanceof OneKeyLocalError &&
        'firmwareArtifactStoreCode' in error
      ) {
        throw error;
      }
      fail(
        'ARTIFACT_INTEGRITY_MISMATCH',
        `Artifact ${artifactId} could not be verified`,
      );
    } finally {
      if (readerId) {
        await this.adapter.closeArtifact({ readerId }).catch(() => undefined);
      }
    }
  }

  private async verifyAndRegister({
    leaseRef,
    requirement,
    receipt,
  }: {
    leaseRef: string;
    requirement: IFirmwareArtifactRequirement;
    receipt: IFirmwareArtifactAdapterReceipt;
  }): Promise<IFirmwareStoredArtifact> {
    const { expectedSize, expectedSha256 } = normalizeRequirement(requirement);
    try {
      assertReceiptShape(receipt, requirement);
      await this.verifyReceiptBytes({
        receipt,
        artifactId: requirement.artifactId,
        expectedSize,
        expectedSha256,
      });
    } catch (error) {
      await this.quarantineArtifact(receipt.artifactRef);
      throw error;
    }
    this.receiptsByRef.set(receipt.artifactRef, receipt);
    return {
      taskId: getFirmwareArtifactCacheKey(requirement),
      requirement,
      adapterReceipt: receipt,
      preparedReceipt: toPreparedReceipt({
        requirement,
        leaseRef,
        adapterReceipt: receipt,
      }),
    };
  }

  async restorePreparedPlan(
    preparedPlan: IFirmwarePreparedPlan,
  ): Promise<void> {
    await this.getCapabilities();
    for (const preparedReceipt of preparedPlan.artifactReceipts) {
      const leaseRef = assertOpaqueRef(preparedReceipt.leaseId, 'leaseId');
      const artifactRef = assertOpaqueRef(
        preparedReceipt.artifactRef,
        'artifactRef',
      );
      if (
        !Number.isSafeInteger(preparedReceipt.size) ||
        preparedReceipt.size <= 0 ||
        !SHA256_PATTERN.test(preparedReceipt.sha256)
      ) {
        fail(
          'INVALID_RECEIPT',
          `Prepared artifact ${preparedReceipt.artifactId} has invalid integrity metadata`,
        );
      }
      const expectedSha256 = preparedReceipt.sha256.toLowerCase();
      const status = await this.adapter.getArtifactStatus({
        leaseRef,
        taskId: `fw-${expectedSha256}-${preparedReceipt.size}`,
      });
      const receipt =
        status.receipt ??
        fail(
          'ARTIFACT_RESTORE_UNAVAILABLE',
          `Prepared artifact ${preparedReceipt.artifactId} is unavailable for recovery`,
        );
      if (
        status.state !== 'completed' ||
        receipt.artifactRef !== artifactRef ||
        receipt.size !== preparedReceipt.size ||
        receipt.sha256.toLowerCase() !== expectedSha256
      ) {
        fail(
          'ARTIFACT_RESTORE_UNAVAILABLE',
          `Prepared artifact ${preparedReceipt.artifactId} is unavailable for recovery`,
        );
      }
      await this.adapter.retainArtifact({ leaseRef, artifactRef });
      try {
        assertOpaqueRef(receipt.immutableToken, 'immutableToken');
        await this.verifyReceiptBytes({
          receipt,
          artifactId: preparedReceipt.artifactId,
          expectedSize: preparedReceipt.size,
          expectedSha256,
        });
      } catch (error) {
        await this.quarantineArtifact(artifactRef);
        throw error;
      }
      this.receiptsByRef.set(artifactRef, receipt);
    }
  }

  async restoreArtifact({
    leaseRef,
    requirement,
    adapterReceipt,
  }: {
    leaseRef: string;
    requirement: IFirmwareArtifactRequirement;
    adapterReceipt: IFirmwareArtifactAdapterReceipt;
  }): Promise<IFirmwareStoredArtifact> {
    await this.getCapabilities();
    assertOpaqueRef(leaseRef, 'leaseRef');
    await this.adapter.retainArtifact({
      leaseRef,
      artifactRef: adapterReceipt.artifactRef,
    });
    return this.verifyAndRegister({
      leaseRef,
      requirement,
      receipt: adapterReceipt,
    });
  }

  async downloadArtifact({
    leaseRef,
    requirement,
    route,
    segmentCount,
    overallDeadlineSeconds,
  }: {
    leaseRef: string;
    requirement: IFirmwareArtifactRequirement;
    route: IFirmwareArtifactRoute;
    segmentCount?: number;
    overallDeadlineSeconds?: number;
  }): Promise<IFirmwareStoredArtifact> {
    await this.getCapabilities();
    assertOpaqueRef(leaseRef, 'leaseRef');
    assertDownloadableRequirement(requirement);
    assertRoute(requirement, route);
    const { expectedSize, expectedSha256 } = normalizeRequirement(requirement);
    const taskId = getFirmwareArtifactCacheKey(requirement);
    const status = await this.adapter.getArtifactStatus({ leaseRef, taskId });
    if (status.state === 'completed' && status.receipt) {
      try {
        const stored = await this.verifyAndRegister({
          leaseRef,
          requirement,
          receipt: status.receipt,
        });
        return {
          ...stored,
          acquisition: {
            routeType: route.type,
            bytesReused: status.receipt.size,
            resumeKind: 'segments',
            resumeCount: 1,
          },
        };
      } catch (error) {
        if (
          !(
            error instanceof OneKeyLocalError &&
            'firmwareArtifactStoreCode' in error &&
            error.firmwareArtifactStoreCode === 'ARTIFACT_QUARANTINE_FAILED'
          )
        ) {
          // A successfully quarantined cache entry is replaced below.
        } else {
          throw error;
        }
      }
    }
    const receipt = await this.adapter.downloadArtifact({
      taskId,
      leaseRef,
      artifactId: taskId,
      url: route.url,
      routeType: route.type,
      ...(route.type === 'pinnedIp' ? { resolvedIp: route.resolvedIp } : {}),
      expectedSize,
      expectedSha256,
      maxBytes: expectedSize,
      ...(segmentCount === undefined ? {} : { segmentCount }),
      ...(overallDeadlineSeconds === undefined
        ? {}
        : { overallDeadlineSeconds }),
    });
    const stored = await this.verifyAndRegister({
      leaseRef,
      requirement,
      receipt,
    });
    const bytesReused = Math.min(
      Math.max(0, status.downloadedBytes),
      receipt.size,
    );
    return {
      ...stored,
      acquisition: {
        routeType: route.type,
        bytesReused,
        resumeKind: bytesReused > 0 ? 'segments' : 'none',
        resumeCount: bytesReused > 0 ? 1 : 0,
      },
    };
  }

  async materializeArchive({
    leaseRef,
    archive,
    entries,
  }: {
    leaseRef: string;
    archive: IFirmwareStoredArtifact;
    entries: readonly IFirmwareArtifactRequirement[];
  }): Promise<IFirmwareStoredArtifact[]> {
    const capabilities = await this.getCapabilities();
    if (!capabilities.supportsArchiveMaterialization) {
      fail(
        'ADAPTER_CAPABILITY_MISMATCH',
        'Firmware artifact adapter cannot materialize archives',
      );
    }
    assertOpaqueRef(leaseRef, 'leaseRef');
    if (archive.requirement.container.kind !== 'archive') {
      fail(
        'ARCHIVE_RELATIONSHIP_INVALID',
        `${archive.requirement.artifactId} is not an archive`,
      );
    }
    const requestedEntries = entries.map((requirement) => {
      const { expectedSize, expectedSha256 } =
        normalizeRequirement(requirement);
      const { container } = requirement;
      const entryContainer =
        container.kind === 'archive-entry'
          ? container
          : fail(
              'ARCHIVE_RELATIONSHIP_INVALID',
              `Artifact ${requirement.artifactId} is not an archive entry`,
            );
      if (entryContainer.parentArtifactId !== archive.requirement.artifactId) {
        fail(
          'ARCHIVE_RELATIONSHIP_INVALID',
          `Artifact ${requirement.artifactId} does not belong to archive ${archive.requirement.artifactId}`,
        );
      }
      return {
        requirement,
        nativeEntry: {
          archiveName: entryContainer.entryId,
          artifactId: getFirmwareArtifactCacheKey(requirement),
          expectedSize,
          expectedSha256,
        },
      };
    });
    const result = await this.adapter.materializeArchive({
      leaseRef,
      archiveArtifactRef: archive.adapterReceipt.artifactRef,
      archiveImmutableToken: archive.adapterReceipt.immutableToken,
      entries: requestedEntries.map(({ nativeEntry }) => nativeEntry),
    });
    if (result.artifacts.length !== requestedEntries.length) {
      fail(
        'INVALID_RECEIPT',
        'Archive API returned an unexpected artifact count',
      );
    }
    const resultByKey = new Map(
      result.artifacts.map((artifact) => [
        `${artifact.artifactId}\u0000${artifact.archiveName}`,
        artifact,
      ]),
    );
    const stored: IFirmwareStoredArtifact[] = [];
    for (const { requirement, nativeEntry } of requestedEntries) {
      const materialized = resultByKey.get(
        `${nativeEntry.artifactId}\u0000${nativeEntry.archiveName}`,
      );
      const materializedReceipt =
        materialized?.receipt ??
        fail(
          'INVALID_RECEIPT',
          `Archive API omitted ${requirement.artifactId}`,
        );
      stored.push({
        ...(await this.verifyAndRegister({
          leaseRef,
          requirement,
          receipt: materializedReceipt,
        })),
        ...(archive.acquisition ? { acquisition: archive.acquisition } : {}),
      });
    }
    return stored;
  }

  createArtifactReader(): IFirmwareArtifactReader {
    return {
      open: async ({ artifactRef }) => {
        await this.getCapabilities();
        const receipt = this.receiptsByRef.get(artifactRef);
        if (!receipt) {
          return fail(
            'ARTIFACT_READER_INVALID',
            `Firmware artifact ${artifactRef} is not registered`,
          );
        }
        const opened = await this.adapter.openArtifact(receipt);
        if (
          opened.size !== receipt.size ||
          opened.immutableToken !== receipt.immutableToken ||
          opened.maxReadBytes < FIRMWARE_ARTIFACT_MAX_READ_BYTES
        ) {
          await this.adapter
            .closeArtifact({ readerId: opened.readerId })
            .catch(() => undefined);
          return fail(
            'ARTIFACT_READER_INVALID',
            `Firmware artifact ${artifactRef} changed before open`,
          );
        }
        this.readersById.set(opened.readerId, {
          artifactRef,
          size: opened.size,
          closed: false,
        });
        return {
          readerId: opened.readerId,
          size: opened.size,
        };
      },
      read: async ({ readerId, operationId, offset, length }) => {
        const reader = this.readersById.get(readerId);
        if (!reader || reader.closed) {
          return fail(
            'ARTIFACT_READER_INVALID',
            `Firmware artifact reader ${readerId} is not open`,
          );
        }
        if (
          typeof operationId !== 'string' ||
          operationId.length === 0 ||
          !Number.isSafeInteger(offset) ||
          offset < 0 ||
          offset >= reader.size ||
          !Number.isSafeInteger(length) ||
          length <= 0 ||
          length > FIRMWARE_ARTIFACT_MAX_READ_BYTES ||
          offset + length > reader.size ||
          reader.activeOperationId ||
          this.readerIdByOperationId.has(operationId)
        ) {
          return fail(
            'ARTIFACT_READER_INVALID',
            'Firmware artifact read request is invalid',
          );
        }
        reader.activeOperationId = operationId;
        this.readerIdByOperationId.set(operationId, readerId);
        try {
          const data = await this.adapter.readArtifact({
            readerId,
            offset,
            length,
          });
          if (this.cancelledOperationIds.has(operationId)) {
            return fail(
              'ARTIFACT_READ_CANCELLED',
              `Firmware artifact operation ${operationId} was cancelled`,
            );
          }
          if (!(data instanceof ArrayBuffer) || data.byteLength !== length) {
            return fail(
              'ARTIFACT_READER_INVALID',
              'Firmware artifact reader returned an invalid byte count',
            );
          }
          return {
            data,
            bytesRead: data.byteLength,
            eof: offset + data.byteLength === reader.size,
          };
        } finally {
          reader.activeOperationId = undefined;
          this.readerIdByOperationId.delete(operationId);
          this.cancelledOperationIds.delete(operationId);
        }
      },
      close: async ({ readerId }) => {
        const reader = this.readersById.get(readerId);
        if (!reader || reader.closed) {
          return;
        }
        reader.closed = true;
        this.readersById.delete(readerId);
        if (reader.activeOperationId) {
          this.cancelledOperationIds.add(reader.activeOperationId);
        }
        await this.adapter.closeArtifact({ readerId });
      },
      cancel: async ({ operationId }) => {
        const readerId = this.readerIdByOperationId.get(operationId);
        if (!readerId) {
          return fail(
            'ARTIFACT_READER_INVALID',
            `Firmware artifact operation ${operationId} is not active`,
          );
        }
        this.cancelledOperationIds.add(operationId);
      },
    };
  }
}
