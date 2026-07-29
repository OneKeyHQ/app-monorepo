import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { firmwareArtifactAdapter } from './FirmwareArtifactAdapter';
import {
  type ITrustedFirmwareArtifact,
  getTrustedFirmwareArtifact,
} from './trustedFirmwareCatalog';

import type { IFirmwareArtifactReceipt } from './FirmwareArtifactAdapter.types';
import type {
  CoreApi,
  FirmwareArtifactReader,
  FirmwareArtifactReference,
  FirmwareUpdateCapabilities,
  FirmwareUpdatePlan,
  FirmwareUpdatePlanTarget,
  FirmwareUpdatePreparedPlan,
  FirmwareUpdateV4Target,
} from '@onekeyfe/hd-core';

const MAX_READ_BYTES = 256 * 1024;
const MAX_BRIDGE_BINARY_BYTES = 4 * 1024 * 1024;
const TOTAL_DEADLINE_MS = 30 * 60 * 1000;
const activeArtifactDownloadCounts = new Map<string, number>();
const FIRMWARE_CAPABILITY_KEYS = [
  'planSchemaVersion',
  'preparedPlanSchemaVersion',
  'hostBindingProtocolVersion',
  'manifestModes',
  'supportsArtifactReader',
] as const;

export const isExternalFirmwareCapabilityReady = (
  value: unknown,
): value is FirmwareUpdateCapabilities => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== FIRMWARE_CAPABILITY_KEYS.length ||
    FIRMWARE_CAPABILITY_KEYS.some(
      (key) => !Object.prototype.hasOwnProperty.call(value, key),
    )
  ) {
    return false;
  }
  const capabilities = value as Record<string, unknown>;
  if (
    capabilities.planSchemaVersion !== 2 ||
    capabilities.preparedPlanSchemaVersion !== 2 ||
    capabilities.hostBindingProtocolVersion !== 2 ||
    capabilities.supportsArtifactReader !== true ||
    !Array.isArray(capabilities.manifestModes) ||
    capabilities.manifestModes.length !== 2
  ) {
    return false;
  }
  const modes = new Set(capabilities.manifestModes);
  return (
    modes.size === 2 && modes.has('external-only') && modes.has('sdk-managed')
  );
};

export type IFirmwareArtifactReference = FirmwareArtifactReference;
type IFirmwareArtifactReader = FirmwareArtifactReader;

export type IPreparedFirmwareArtifacts = {
  transactionId: string;
  leaseRef: string;
  plan: FirmwareUpdatePlan;
  preparedPlan: FirmwareUpdatePreparedPlan;
  artifactsById: Readonly<Record<string, IFirmwareArtifactReference>>;
  selected: {
    firmware?: IFirmwareArtifactReference;
    ble?: IFirmwareArtifactReference;
    bootloader?: IFirmwareArtifactReference;
    resourceEntries?: {
      entryName: string;
      artifact: IFirmwareArtifactReference;
    }[];
    componentArtifacts: Partial<
      Record<
        Exclude<FirmwareUpdateV4Target, 'resource'>,
        IFirmwareArtifactReference
      >
    >;
    resourceBundleArtifacts: {
      name: string;
      artifact: IFirmwareArtifactReference;
    }[];
  };
  artifactReader: IFirmwareArtifactReader;
};

type IBridgeBinaryTarget = Exclude<FirmwareUpdatePlanTarget, 'resource'>;

export type IBridgeFirmwareBinaries = {
  transactionId: string;
  executor: FirmwareUpdatePlan['executor'];
  planDigest: string;
  targetBinaries: Partial<Record<IBridgeBinaryTarget, ArrayBuffer>>;
};

const assertReceipt = (
  receipt: IFirmwareArtifactReceipt,
  artifact: ITrustedFirmwareArtifact,
): IFirmwareArtifactReference => {
  if (
    receipt.size !== artifact.expectedSize ||
    receipt.sha256.toLowerCase() !== artifact.expectedSha256.toLowerCase() ||
    !receipt.artifactRef
  ) {
    throw new OneKeyLocalError(
      'Firmware artifact receipt does not match the bundled catalog',
    );
  }
  return receipt;
};

const trackArtifactDownload = async <T>(
  transactionId: string,
  operation: () => Promise<T>,
): Promise<T> => {
  activeArtifactDownloadCounts.set(
    transactionId,
    (activeArtifactDownloadCounts.get(transactionId) ?? 0) + 1,
  );
  try {
    return await operation();
  } finally {
    const remaining =
      (activeArtifactDownloadCounts.get(transactionId) ?? 1) - 1;
    if (remaining > 0) {
      activeArtifactDownloadCounts.set(transactionId, remaining);
    } else {
      activeArtifactDownloadCounts.delete(transactionId);
    }
  }
};

export const downloadTrustedFirmwareArtifact = async ({
  artifact,
  artifactId,
  transactionId,
  leaseRef,
  deadlineAt,
}: {
  artifact: ITrustedFirmwareArtifact;
  artifactId: string;
  transactionId: string;
  leaseRef: string;
  deadlineAt: number;
}): Promise<IFirmwareArtifactReference> =>
  trackArtifactDownload(transactionId, async () => {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) {
      throw new OneKeyLocalError(
        'Firmware artifact preparation exceeded its deadline',
      );
    }
    const receipt = await firmwareArtifactAdapter.download({
      taskId: `fw-${artifact.expectedSha256.slice(0, 24)}`,
      transactionId,
      leaseRef,
      artifactId,
      url: artifact.url,
      route: { routeType: 'domain' },
      expectedSize: artifact.expectedSize,
      expectedSha256: artifact.expectedSha256,
      maxBytes: artifact.expectedSize,
      overallDeadlineSeconds: remainingMs / 1000,
    });
    return assertReceipt(receipt, artifact);
  });

export const cancelFirmwareArtifactPreparations = async (): Promise<void> => {
  await Promise.all(
    [...activeArtifactDownloadCounts.keys()].map((transactionId) =>
      firmwareArtifactAdapter.cancelDownloads(transactionId),
    ),
  );
};

const createArtifactReader = (): IFirmwareArtifactReader => {
  const sizesByReaderId = new Map<string, number>();
  return {
    async open({ artifactRef }) {
      const opened = await firmwareArtifactAdapter.open(artifactRef);
      sizesByReaderId.set(opened.readerId, opened.size);
      return opened;
    },
    async read({ readerId, offset, length }) {
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        !Number.isSafeInteger(length) ||
        length <= 0 ||
        length > MAX_READ_BYTES
      ) {
        throw new OneKeyLocalError('Invalid firmware artifact reader request');
      }
      const size = sizesByReaderId.get(readerId);
      if (size === undefined || offset + length > size) {
        throw new OneKeyLocalError('Firmware artifact reader is out of bounds');
      }
      const data = await firmwareArtifactAdapter.read({
        readerId,
        offset,
        length,
      });
      return {
        data,
        bytesRead: data.byteLength,
        eof: offset + data.byteLength === size,
      };
    },
    async close({ readerId }) {
      sizesByReaderId.delete(readerId);
      await firmwareArtifactAdapter.close(readerId);
    },
  };
};

const assertPlanArtifactMatchesCatalog = ({
  planArtifact,
  trustedArtifact,
}: {
  planArtifact: FirmwareUpdatePlan['artifacts'][number];
  trustedArtifact: ITrustedFirmwareArtifact;
}) => {
  const roleMatches =
    planArtifact.role === trustedArtifact.role ||
    (planArtifact.role === 'resource' &&
      trustedArtifact.role === 'fullResource');
  if (
    !roleMatches ||
    planArtifact.container !== trustedArtifact.container ||
    planArtifact.logicalName !== trustedArtifact.logicalName ||
    (planArtifact.expectedSize !== undefined &&
      planArtifact.expectedSize !== trustedArtifact.expectedSize) ||
    (planArtifact.expectedSha256 !== undefined &&
      planArtifact.expectedSha256.toLowerCase() !==
        trustedArtifact.expectedSha256.toLowerCase())
  ) {
    throw new OneKeyLocalError(
      'Firmware update plan does not match the bundled catalog',
    );
  }
};

const readFirmwareArtifact = async (
  artifact: IFirmwareArtifactReference,
): Promise<ArrayBuffer> => {
  if (
    !Number.isSafeInteger(artifact.size) ||
    artifact.size <= 0 ||
    artifact.size > MAX_BRIDGE_BINARY_BYTES
  ) {
    throw new OneKeyLocalError(
      'Desktop Bridge firmware binary exceeds the in-memory limit',
    );
  }
  const opened = await firmwareArtifactAdapter.open(artifact.artifactRef);
  try {
    if (opened.size !== artifact.size) {
      throw new OneKeyLocalError(
        'Desktop Bridge firmware binary size is invalid',
      );
    }
    const result = new Uint8Array(artifact.size);
    let offset = 0;
    while (offset < artifact.size) {
      const length = Math.min(MAX_READ_BYTES, artifact.size - offset);
      const chunk = await firmwareArtifactAdapter.read({
        readerId: opened.readerId,
        offset,
        length,
      });
      if (chunk.byteLength !== length) {
        throw new OneKeyLocalError(
          'Desktop Bridge firmware binary read is incomplete',
        );
      }
      result.set(new Uint8Array(chunk), offset);
      offset += length;
    }
    return result.buffer;
  } finally {
    await firmwareArtifactAdapter.close(opened.readerId);
  }
};

const getBridgeBinaryPlanArtifacts = (
  plan: FirmwareUpdatePlan,
): FirmwareUpdatePlan['artifacts'] => {
  if (plan.executor === 'v4') {
    const components = plan.artifacts.filter(
      (artifact) => artifact.role === 'component',
    );
    return components.length > 0 &&
      components.every((artifact) => artifact.container === 'raw')
      ? components
      : [];
  }
  return plan.artifacts.filter(
    (artifact) =>
      (artifact.role === 'firmware' ||
        artifact.role === 'ble' ||
        artifact.role === 'bootloader') &&
      artifact.container === 'raw',
  );
};

export async function prepareBridgeFirmwareBinaries(
  plan: FirmwareUpdatePlan,
  requestedTransactionId?: string,
): Promise<IBridgeFirmwareBinaries | undefined> {
  if (!(await isFirmwareArtifactCapabilityReady())) {
    throw new OneKeyLocalError(
      'Installed firmware artifact module is incompatible',
    );
  }
  const planArtifacts = getBridgeBinaryPlanArtifacts(plan);
  if (!planArtifacts.length) return undefined;

  const transactionId =
    requestedTransactionId ??
    `bridge:${plan.planDigest.slice(0, 32)}:${Date.now()}`;
  const { leaseRef } = await firmwareArtifactAdapter.createLease(transactionId);
  let completed = false;
  try {
    const targetBinaries: IBridgeFirmwareBinaries['targetBinaries'] = {};
    const deadlineAt = Date.now() + TOTAL_DEADLINE_MS;
    for (const planArtifact of planArtifacts) {
      const trustedArtifact = await getTrustedFirmwareArtifact(
        planArtifact.url,
      );
      assertPlanArtifactMatchesCatalog({ planArtifact, trustedArtifact });
      const receipt = await downloadTrustedFirmwareArtifact({
        artifact: trustedArtifact,
        artifactId: planArtifact.artifactId,
        transactionId,
        leaseRef,
        deadlineAt,
      });
      if (planArtifact.target === 'resource') {
        throw new OneKeyLocalError(
          'Desktop Bridge resource binaries are not in the small artifact scope',
        );
      }
      targetBinaries[planArtifact.target] = await readFirmwareArtifact(receipt);
    }
    completed = true;
    return {
      transactionId,
      executor: plan.executor,
      planDigest: plan.planDigest,
      targetBinaries,
    };
  } finally {
    await firmwareArtifactAdapter.releaseLease({
      leaseRef,
      disposition: completed ? 'completed' : 'safeCancelled',
    });
  }
}

export const getBridgeFirmwareV3BinaryParams = (
  binaries: IBridgeFirmwareBinaries | undefined,
) => ({
  ...(binaries?.targetBinaries.firmware
    ? { firmwareBinary: binaries.targetBinaries.firmware }
    : {}),
  ...(binaries?.targetBinaries.ble
    ? { bleBinary: binaries.targetBinaries.ble }
    : {}),
  ...(binaries?.targetBinaries.bootloader
    ? { bootloaderBinary: binaries.targetBinaries.bootloader }
    : {}),
});

export const getBridgeFirmwareV4BinaryParams = (
  binaries: IBridgeFirmwareBinaries | undefined,
) => ({
  ...(binaries?.targetBinaries.boot
    ? { bootloaderBinary: binaries.targetBinaries.boot }
    : {}),
  ...(binaries?.targetBinaries.app_v1
    ? { applicationP1Binary: binaries.targetBinaries.app_v1 }
    : {}),
  ...(binaries?.targetBinaries.app_v2
    ? { applicationP2Binary: binaries.targetBinaries.app_v2 }
    : {}),
  ...(binaries?.targetBinaries.coprocessor
    ? { coprocessorBinary: binaries.targetBinaries.coprocessor }
    : {}),
  ...(binaries?.targetBinaries.se01
    ? { se01Binary: binaries.targetBinaries.se01 }
    : {}),
  ...(binaries?.targetBinaries.se02
    ? { se02Binary: binaries.targetBinaries.se02 }
    : {}),
  ...(binaries?.targetBinaries.se03
    ? { se03Binary: binaries.targetBinaries.se03 }
    : {}),
  ...(binaries?.targetBinaries.se04
    ? { se04Binary: binaries.targetBinaries.se04 }
    : {}),
});

export async function prepareFirmwareArtifacts(
  plan: FirmwareUpdatePlan,
  {
    transactionId,
    leaseRef: existingLeaseRef,
    preparePlan,
  }: {
    transactionId: string;
    leaseRef?: string;
    preparePlan: CoreApi['prepareFirmwareUpdatePlan'];
  },
): Promise<IPreparedFirmwareArtifacts> {
  if (!(await isFirmwareArtifactCapabilityReady())) {
    throw new OneKeyLocalError(
      'Installed firmware artifact module is incompatible',
    );
  }

  const leaseRef =
    existingLeaseRef ??
    (await firmwareArtifactAdapter.createLease(transactionId)).leaseRef;
  const deadlineAt = Date.now() + TOTAL_DEADLINE_MS;
  const artifactsById: Record<string, IFirmwareArtifactReference> = {};
  const resourceEntriesByArtifactId: Record<
    string,
    {
      entryName: string;
      artifact: IFirmwareArtifactReference;
    }[]
  > = {};

  let cancellationRequested = false;
  let preparationFailure: { reason: unknown } | undefined;
  await Promise.allSettled(
    plan.artifacts.map(async (planArtifact) => {
      try {
        const trustedArtifact = await getTrustedFirmwareArtifact(
          planArtifact.url,
        );
        assertPlanArtifactMatchesCatalog({ planArtifact, trustedArtifact });
        const receipt = await downloadTrustedFirmwareArtifact({
          artifact: trustedArtifact,
          artifactId: planArtifact.artifactId,
          transactionId,
          leaseRef,
          deadlineAt,
        });
        artifactsById[planArtifact.artifactId] = receipt;
        if (planArtifact.container === 'zip') {
          if (!trustedArtifact.expectedEntries?.length) {
            throw new OneKeyLocalError(
              'Trusted firmware archive has no exact entry allow-list',
            );
          }
          const entries = await firmwareArtifactAdapter.materialize({
            leaseRef,
            archiveArtifactRef: receipt.artifactRef,
            expectedEntries: trustedArtifact.expectedEntries,
          });
          resourceEntriesByArtifactId[planArtifact.artifactId] = entries.map(
            (entry) => ({
              entryName: entry.entryName,
              artifact: entry.receipt,
            }),
          );
        }
      } catch (error) {
        if (!cancellationRequested) {
          cancellationRequested = true;
          preparationFailure = { reason: error };
          await firmwareArtifactAdapter
            .cancelDownloads(transactionId)
            .catch(() => undefined);
        }
        throw error;
      }
    }),
  );
  if (preparationFailure) {
    throw preparationFailure.reason;
  }

  const componentArtifacts: IPreparedFirmwareArtifacts['selected']['componentArtifacts'] =
    {};
  const resourceBundleArtifacts: IPreparedFirmwareArtifacts['selected']['resourceBundleArtifacts'] =
    [];
  for (const planArtifact of plan.artifacts) {
    const artifact = artifactsById[planArtifact.artifactId];
    if (!artifact) {
      throw new OneKeyLocalError('Firmware artifact preparation is incomplete');
    }
    if (planArtifact.role === 'component') {
      const target = planArtifact.target;
      if (
        target === 'firmware' ||
        target === 'ble' ||
        target === 'bootloader' ||
        target === 'resource'
      ) {
        throw new OneKeyLocalError('Firmware component target is invalid');
      }
      componentArtifacts[target] = artifact;
    }
    if (planArtifact.role === 'resourceBundle') {
      if (!planArtifact.logicalName) {
        throw new OneKeyLocalError(
          'Firmware resource bundle has no logical name',
        );
      }
      resourceBundleArtifacts.push({
        name: planArtifact.logicalName,
        artifact,
      });
    }
  }
  const preparedPlan = preparePlan({
    plan,
    leaseRef,
    artifacts: plan.artifacts.map((planArtifact) => {
      const artifact = artifactsById[planArtifact.artifactId];
      if (!artifact) {
        throw new OneKeyLocalError(
          'Firmware artifact preparation is incomplete',
        );
      }
      const materializedEntries =
        resourceEntriesByArtifactId[planArtifact.artifactId];
      return {
        artifactId: planArtifact.artifactId,
        artifact,
        ...(materializedEntries?.length ? { materializedEntries } : {}),
      };
    }),
  });

  return {
    transactionId,
    leaseRef,
    plan,
    preparedPlan,
    artifactsById,
    selected: {
      firmware: artifactsById.firmware,
      ble: artifactsById.ble,
      bootloader: artifactsById.bootloader,
      resourceEntries: resourceEntriesByArtifactId.resource,
      componentArtifacts,
      resourceBundleArtifacts,
    },
    artifactReader: createArtifactReader(),
  };
}

export const isFirmwareArtifactCapabilityReadyValue = (
  capabilities: unknown,
): boolean => {
  if (
    !capabilities ||
    typeof capabilities !== 'object' ||
    Array.isArray(capabilities)
  ) {
    return false;
  }
  const value = capabilities as Record<string, unknown>;
  const routeTypes = value.supportedRouteTypes;
  return (
    value.firmwareArtifactProtocolVersion === 2 &&
    value.maxReadBytes === MAX_READ_BYTES &&
    value.supportsArchiveMaterialization === true &&
    Array.isArray(routeTypes) &&
    routeTypes.includes('domain')
  );
};

export async function isFirmwareArtifactCapabilityReady(): Promise<boolean> {
  try {
    return isFirmwareArtifactCapabilityReadyValue(
      await firmwareArtifactAdapter.getCapabilities(),
    );
  } catch {
    return false;
  }
}
