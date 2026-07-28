import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { isProxyActiveForUrl } from '@onekeyhq/shared/src/request/helpers/sniRequest';
import requestHelper from '@onekeyhq/shared/src/request/requestHelper';
import type { IIpTableConfigWithRuntime } from '@onekeyhq/shared/src/request/types/ipTable';
import { getOrderedIpTableCandidates } from '@onekeyhq/shared/src/utils/ipTableUtils';

import { firmwareArtifactAdapter } from './FirmwareArtifactAdapter';
import {
  type ITrustedFirmwareArtifact,
  getTrustedFirmwareArtifact,
  getTrustedFirmwareArtifactByIntegrity,
} from './trustedFirmwareCatalog';

import type {
  IFirmwareArtifactReceipt,
  IFirmwareArtifactRoute,
} from './FirmwareArtifactAdapter.types';
import type { IFirmwareUpdateJournalPrepared } from './FirmwareUpdateJournal';
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
const MAX_PINNED_CANDIDATES = 3;
const activeArtifactDownloadCounts = new Map<string, number>();
const FIRMWARE_CAPABILITY_KEYS = [
  'planSchemaVersion',
  'preparedPlanSchemaVersion',
  'hostBindingProtocolVersion',
  'checkpointSchemaVersion',
  'manifestModes',
  'supportsArtifactReader',
  'supportsAwaitableCheckpoint',
  'supportsResume',
  'supportsReconciliation',
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
    capabilities.planSchemaVersion !== 1 ||
    capabilities.preparedPlanSchemaVersion !== 1 ||
    capabilities.hostBindingProtocolVersion !== 1 ||
    capabilities.checkpointSchemaVersion !== 1 ||
    capabilities.supportsArtifactReader !== true ||
    capabilities.supportsAwaitableCheckpoint !== true ||
    capabilities.supportsResume !== true ||
    capabilities.supportsReconciliation !== true ||
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
export type IFirmwareArtifactReader = FirmwareArtifactReader;

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
  planDigest: string;
  targetBinaries: Partial<Record<IBridgeBinaryTarget, ArrayBuffer>>;
};

const isRetryableRouteError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('ARTIFACT_NETWORK_FAILED')) return true;
  const status = /\bARTIFACT_HTTP_(\d{3})\b/u.exec(message)?.[1];
  if (!status) return false;
  const code = Number(status);
  return (
    code === 408 || code === 416 || code === 429 || (code >= 500 && code <= 599)
  );
};

export const orderFirmwareArtifactRoutes = ({
  hostname,
  configWithRuntime,
  proxyActive,
}: {
  hostname: string;
  configWithRuntime: IIpTableConfigWithRuntime | undefined;
  proxyActive: boolean | null;
}): IFirmwareArtifactRoute[] => {
  const domainRoute = { routeType: 'domain' } as const;
  if (proxyActive !== false || !configWithRuntime) {
    return [domainRoute];
  }
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/u, '');
  const pinnedRoutes = getOrderedIpTableCandidates({
    hostname: normalizedHostname,
    configWithRuntime,
    exactHostOnly: true,
    maxCandidates: MAX_PINNED_CANDIDATES,
  }).map((resolvedIp) => ({ routeType: 'pinnedIp', resolvedIp }) as const);
  const selectedIp =
    configWithRuntime.runtime?.selections?.[normalizedHostname];
  const hasEndorsedSelection =
    typeof selectedIp === 'string' &&
    selectedIp.length > 0 &&
    pinnedRoutes[0]?.resolvedIp === selectedIp;
  return hasEndorsedSelection
    ? [...pinnedRoutes, domainRoute]
    : [domainRoute, ...pinnedRoutes];
};

const getRoutes = async (
  artifact: ITrustedFirmwareArtifact,
): Promise<IFirmwareArtifactRoute[]> => {
  const parsed = new URL(artifact.url);
  const proxyActive = await isProxyActiveForUrl(artifact.url).catch(() => null);
  const configWithRuntime =
    proxyActive === false
      ? ((await requestHelper.getIpTableConfig().catch(() => undefined)) ??
        undefined)
      : undefined;
  return orderFirmwareArtifactRoutes({
    hostname: parsed.hostname,
    configWithRuntime,
    proxyActive,
  });
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
    let lastError: unknown;
    const routes = await getRoutes(artifact);
    for (const [candidateIndex, route] of routes.entries()) {
      const remainingMs = deadlineAt - Date.now();
      if (remainingMs <= 0) {
        throw new OneKeyLocalError(
          'Firmware artifact preparation exceeded its deadline',
        );
      }
      const attemptStartedAt = Date.now();
      try {
        const receipt = await firmwareArtifactAdapter.download({
          taskId: `fw-${artifact.expectedSha256.slice(0, 24)}`,
          transactionId,
          leaseRef,
          artifactId,
          url: artifact.url,
          route,
          expectedSize: artifact.expectedSize,
          expectedSha256: artifact.expectedSha256,
          maxBytes: artifact.expectedSize,
          overallDeadlineSeconds: remainingMs / 1000,
        });
        defaultLogger.ipTable.request.info({
          info: `firmware_artifact route=${route.routeType} outcome=success candidateIndex=${candidateIndex} durationMs=${
            Date.now() - attemptStartedAt
          } bytes=${receipt.size} retry=${candidateIndex}`,
        });
        return assertReceipt(receipt, artifact);
      } catch (error) {
        defaultLogger.ipTable.request.info({
          info: `firmware_artifact route=${route.routeType} outcome=failure candidateIndex=${candidateIndex} durationMs=${
            Date.now() - attemptStartedAt
          } bytes=0 retry=${candidateIndex}`,
        });
        if (!isRetryableRouteError(error)) throw error;
        lastError = error;
      }
    }
    throw new OneKeyLocalError(
      `Firmware artifact routes were exhausted: ${
        lastError instanceof Error ? lastError.message : 'unknown error'
      }`,
    );
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
    planArtifact.expectedSize !== trustedArtifact.expectedSize ||
    planArtifact.expectedSha256?.toLowerCase() !==
      trustedArtifact.expectedSha256.toLowerCase()
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
      components.every(
        (artifact) =>
          artifact.container === 'raw' &&
          Number.isSafeInteger(artifact.expectedSize) &&
          (artifact.expectedSize ?? 0) > 0 &&
          (artifact.expectedSize ?? 0) <= MAX_BRIDGE_BINARY_BYTES,
      )
      ? components
      : [];
  }
  return plan.artifacts.filter(
    (artifact) =>
      (artifact.role === 'firmware' ||
        artifact.role === 'ble' ||
        artifact.role === 'bootloader') &&
      artifact.container === 'raw' &&
      Number.isSafeInteger(artifact.expectedSize) &&
      (artifact.expectedSize ?? 0) > 0 &&
      (artifact.expectedSize ?? 0) <= MAX_BRIDGE_BINARY_BYTES,
  );
};

export async function prepareBridgeFirmwareBinaries(
  plan: FirmwareUpdatePlan,
): Promise<IBridgeFirmwareBinaries | undefined> {
  if (!(await isFirmwareArtifactCapabilityReady())) {
    throw new OneKeyLocalError(
      'Installed firmware artifact module is incompatible',
    );
  }
  const planArtifacts = getBridgeBinaryPlanArtifacts(plan);
  if (!planArtifacts.length) return undefined;

  const transactionId = `bridge:${plan.planDigest.slice(0, 32)}:${Date.now()}`;
  const { leaseRef } = await firmwareArtifactAdapter.createLease(transactionId);
  let completed = false;
  try {
    const targetBinaries: IBridgeFirmwareBinaries['targetBinaries'] = {};
    const deadlineAt = Date.now() + TOTAL_DEADLINE_MS;
    for (const planArtifact of planArtifacts) {
      const trustedArtifact = getTrustedFirmwareArtifact(planArtifact.url);
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
    return { planDigest: plan.planDigest, targetBinaries };
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
        const trustedArtifact = getTrustedFirmwareArtifact(planArtifact.url);
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
    value.firmwareArtifactProtocolVersion === 1 &&
    value.maxReadBytes === MAX_READ_BYTES &&
    value.supportsArchiveMaterialization === true &&
    Array.isArray(routeTypes) &&
    routeTypes.length === 2 &&
    new Set(routeTypes).size === 2 &&
    routeTypes.includes('domain') &&
    routeTypes.includes('pinnedIp')
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

export function restoreFirmwareUpdatePlanFromPrepared(
  prepared: FirmwareUpdatePreparedPlan,
): FirmwareUpdatePlan {
  const artifacts = prepared.artifacts.map((preparedArtifact) => {
    const trustedArtifact = getTrustedFirmwareArtifactByIntegrity({
      expectedSha256: preparedArtifact.artifact.sha256,
      expectedSize: preparedArtifact.artifact.size,
      role: preparedArtifact.role,
      container: preparedArtifact.container,
      logicalName: preparedArtifact.logicalName,
    });
    return {
      artifactId: preparedArtifact.artifactId,
      role: preparedArtifact.role,
      target: preparedArtifact.target,
      url: trustedArtifact.url,
      container: preparedArtifact.container,
      ...(preparedArtifact.logicalName
        ? { logicalName: preparedArtifact.logicalName }
        : {}),
      expectedSize: preparedArtifact.artifact.size,
      expectedSha256: preparedArtifact.artifact.sha256,
      ...(preparedArtifact.targetVersion
        ? { targetVersion: preparedArtifact.targetVersion }
        : {}),
    };
  });
  const plan: FirmwareUpdatePlan = {
    schemaVersion: 1,
    planDigest: prepared.planDigest,
    executor: prepared.executor,
    deviceIdentity: prepared.deviceIdentity,
    deviceModel: prepared.deviceModel,
    firmwareType: prepared.firmwareType,
    platform: prepared.platform,
    artifacts,
    epochs: prepared.epochs.map((epoch) => ({
      ...epoch,
      artifactIds: [...epoch.artifactIds],
      targets: [...epoch.targets],
    })),
    targetsToUpdate: [...prepared.targetsToUpdate],
  };
  return plan;
}

export async function restorePreparedFirmwareArtifacts({
  plan,
  transactionId,
  leaseRef,
  prepared,
  preparePlan,
  validatePreparedPlan,
}: {
  plan: FirmwareUpdatePlan;
  transactionId: string;
  leaseRef: string;
  prepared: IFirmwareUpdateJournalPrepared;
  preparePlan: CoreApi['prepareFirmwareUpdatePlan'];
  validatePreparedPlan: CoreApi['validateFirmwareUpdatePreparedPlan'];
}): Promise<IPreparedFirmwareArtifacts> {
  const persistedPreparedPlan = validatePreparedPlan(prepared);
  if (
    persistedPreparedPlan.planDigest !== plan.planDigest ||
    persistedPreparedPlan.leaseRef !== leaseRef
  ) {
    throw new OneKeyLocalError(
      'Prepared firmware plan is not bound to this transaction',
    );
  }
  const preparedPlan = preparePlan({
    plan,
    leaseRef,
    artifacts: persistedPreparedPlan.artifacts.map((artifact) => ({
      artifactId: artifact.artifactId,
      artifact: artifact.artifact,
      ...(artifact.materializedEntries
        ? { materializedEntries: artifact.materializedEntries }
        : {}),
    })),
  });
  if (
    preparedPlan.preparedPlanDigest !== persistedPreparedPlan.preparedPlanDigest
  ) {
    throw new OneKeyLocalError(
      'Prepared firmware plan does not match the update plan',
    );
  }
  const artifactsById: Record<string, IFirmwareArtifactReference> = {};
  if (preparedPlan.artifacts.length !== plan.artifacts.length) {
    throw new OneKeyLocalError(
      'Prepared firmware artifact set does not match the plan',
    );
  }
  for (const planArtifact of plan.artifacts) {
    const preparedArtifact = preparedPlan.artifacts.find(
      (artifact) => artifact.artifactId === planArtifact.artifactId,
    );
    const journalArtifact = preparedArtifact?.artifact;
    if (
      !journalArtifact ||
      journalArtifact.size !== planArtifact.expectedSize ||
      journalArtifact.sha256.toLowerCase() !==
        planArtifact.expectedSha256?.toLowerCase() ||
      journalArtifact.artifactRef !==
        `fw:${planArtifact.expectedSha256?.toLowerCase()}`
    ) {
      throw new OneKeyLocalError(
        'Prepared firmware artifact integrity does not match the plan',
      );
    }
    await firmwareArtifactAdapter.retain({
      leaseRef,
      artifactRef: journalArtifact.artifactRef,
    });
    const opened = await firmwareArtifactAdapter.open(
      journalArtifact.artifactRef,
    );
    try {
      if (opened.size !== journalArtifact.size) {
        throw new OneKeyLocalError(
          'Prepared firmware artifact size is invalid',
        );
      }
    } finally {
      await firmwareArtifactAdapter.close(opened.readerId);
    }
    artifactsById[planArtifact.artifactId] = journalArtifact;
  }

  const resourceEntries: {
    entryName: string;
    artifact: IFirmwareArtifactReference;
  }[] = [];
  const archivePlanArtifact = plan.artifacts.find(
    (artifact) => artifact.container === 'zip',
  );
  if (archivePlanArtifact) {
    const archivePreparedArtifact = preparedPlan.artifacts.find(
      (artifact) => artifact.artifactId === archivePlanArtifact.artifactId,
    );
    const preparedEntries = archivePreparedArtifact?.materializedEntries ?? [];
    const trustedArchive = getTrustedFirmwareArtifact(archivePlanArtifact.url);
    const expectedEntries = trustedArchive.expectedEntries ?? [];
    if (preparedEntries.length !== expectedEntries.length) {
      throw new OneKeyLocalError(
        'Prepared firmware archive entry set is incomplete',
      );
    }
    for (const expectedEntry of expectedEntries) {
      const journalEntry = preparedEntries.find(
        (entry) => entry.entryName === expectedEntry.entryName,
      );
      const journalArtifact = journalEntry?.artifact;
      if (
        !journalArtifact ||
        journalArtifact.size !== expectedEntry.expectedSize ||
        journalArtifact.sha256 !== expectedEntry.expectedSha256.toLowerCase() ||
        journalArtifact.artifactRef !==
          `fw:${expectedEntry.expectedSha256.toLowerCase()}`
      ) {
        throw new OneKeyLocalError(
          'Prepared firmware archive entry integrity is invalid',
        );
      }
      await firmwareArtifactAdapter.retain({
        leaseRef,
        artifactRef: journalArtifact.artifactRef,
      });
      resourceEntries.push({
        entryName: expectedEntry.entryName,
        artifact: journalArtifact,
      });
    }
  } else if (
    preparedPlan.artifacts.some(
      (artifact) => artifact.materializedEntries?.length,
    )
  ) {
    throw new OneKeyLocalError(
      'Prepared firmware journal has unexpected archive entries',
    );
  }

  const componentArtifacts: IPreparedFirmwareArtifacts['selected']['componentArtifacts'] =
    {};
  const resourceBundleArtifacts: IPreparedFirmwareArtifacts['selected']['resourceBundleArtifacts'] =
    [];
  for (const planArtifact of plan.artifacts) {
    const artifact = artifactsById[planArtifact.artifactId];
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
      resourceEntries: resourceEntries.length ? resourceEntries : undefined,
      componentArtifacts,
      resourceBundleArtifacts,
    },
    artifactReader: createArtifactReader(),
  };
}
