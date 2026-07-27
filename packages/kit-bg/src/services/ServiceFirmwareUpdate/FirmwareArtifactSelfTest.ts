import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { firmwareArtifactAdapter } from './FirmwareArtifactAdapter';
import {
  downloadTrustedFirmwareArtifact,
  isFirmwareArtifactCapabilityReadyValue,
} from './FirmwareArtifactPreflight';
import {
  getTrustedFirmwareArtifact,
  getTrustedFirmwareConfig,
} from './trustedFirmwareCatalog';

import type { IFirmwareArtifactAdapter } from './FirmwareArtifactAdapter.types';
import type { ITrustedFirmwareArtifact } from './trustedFirmwareCatalog';

export type IFirmwareArtifactSelfTestScenario =
  | 'pro-firmware'
  | 'pro-resource'
  | 'pro-full-resource';

export type IFirmwareArtifactSelfTestPhase =
  | 'starting'
  | 'downloading'
  | 'reading'
  | 'materializing'
  | 'releasing'
  | 'sweeping'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type IFirmwareArtifactSelfTestStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type IFirmwareArtifactSelfTestDescriptor = {
  scenario: IFirmwareArtifactSelfTestScenario;
  label: string;
  version: string;
  role: ITrustedFirmwareArtifact['role'];
  container: ITrustedFirmwareArtifact['container'];
  expectedSize: number;
};

export type IFirmwareArtifactSelfTestProgress = {
  phase: Exclude<
    IFirmwareArtifactSelfTestPhase,
    'starting' | 'completed' | 'failed' | 'cancelled'
  >;
  progress: number;
  bytesRead?: number;
  chunkCount?: number;
  materializedEntryCount?: number;
};

export type IFirmwareArtifactSelfTestResult = {
  bytesRead: number;
  chunkCount: number;
  materializedEntryCount: number;
  deletedFiles: number;
  deletedBytes: number;
};

export type IFirmwareArtifactSelfTestState = {
  runId: string;
  descriptor: IFirmwareArtifactSelfTestDescriptor;
  platform: 'ios' | 'android' | 'desktop';
  status: IFirmwareArtifactSelfTestStatus;
  phase: IFirmwareArtifactSelfTestPhase;
  progress: number;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  bytesRead: number;
  chunkCount: number;
  materializedEntryCount: number;
  deletedFiles: number;
  deletedBytes: number;
  errorCode?: string;
};

type IFirmwareArtifactSelfTestDependencies = {
  adapter: IFirmwareArtifactAdapter;
  download: typeof downloadTrustedFirmwareArtifact;
};

const PRO_FIRMWARE_VERSION = '4.21.0';
const READER_CHUNK_BYTES = 256 * 1024;

const getProRelease = () => {
  const release = getTrustedFirmwareConfig({ preRelease: false }).pro[
    'firmware-v8'
  ]?.find((item) => item.version.join('.') === PRO_FIRMWARE_VERSION);
  if (!release) {
    throw new OneKeyLocalError(
      `Trusted Pro firmware ${PRO_FIRMWARE_VERSION} is unavailable`,
    );
  }
  return release;
};

export const getFirmwareArtifactSelfTestArtifact = (
  scenario: IFirmwareArtifactSelfTestScenario,
): {
  descriptor: IFirmwareArtifactSelfTestDescriptor;
  artifact: ITrustedFirmwareArtifact;
  artifactId: string;
} => {
  const release = getProRelease();
  let url: string | undefined;
  let label: string;
  let artifactId: string;
  if (scenario === 'pro-firmware') {
    url = release.url;
    label = 'Pro firmware';
    artifactId = 'gallery-pro-firmware';
  } else if (scenario === 'pro-resource') {
    url = release.resource;
    label = 'Pro incremental resource';
    artifactId = 'gallery-pro-resource';
  } else {
    url = release.fullResource;
    label = 'Pro full resource';
    artifactId = 'gallery-pro-full-resource';
  }
  if (!url) {
    throw new OneKeyLocalError(`${label} URL is unavailable`);
  }
  const artifact = getTrustedFirmwareArtifact(url);
  return {
    artifact,
    artifactId,
    descriptor: {
      scenario,
      label,
      version: PRO_FIRMWARE_VERSION,
      role: artifact.role,
      container: artifact.container,
      expectedSize: artifact.expectedSize,
    },
  };
};

export const getFirmwareArtifactSelfTestPlatform = ():
  | 'ios'
  | 'android'
  | 'desktop' => {
  if (platformEnv.isNativeIOS) return 'ios';
  if (platformEnv.isNativeAndroid) return 'android';
  if (platformEnv.isDesktop) return 'desktop';
  throw new OneKeyLocalError(
    'Firmware artifact self-test requires iOS, Android, or Desktop',
  );
};

export const getFirmwareArtifactSelfTestErrorCode = (
  error: unknown,
): string => {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(ARTIFACT_[A-Z0-9_]+)\b/u.exec(message)?.[1] ?? 'SELF_TEST_FAILED';
};

const normalizeFirmwareArtifactSelfTestError = (
  error: unknown,
  fallbackCode: string,
): unknown =>
  getFirmwareArtifactSelfTestErrorCode(error) === 'SELF_TEST_FAILED'
    ? new OneKeyLocalError(fallbackCode)
    : error;

export const executeFirmwareArtifactSelfTest = async ({
  scenario,
  transactionId,
  leaseRef: existingLeaseRef,
  onProgress,
  dependencies = {
    adapter: firmwareArtifactAdapter,
    download: downloadTrustedFirmwareArtifact,
  },
}: {
  scenario: IFirmwareArtifactSelfTestScenario;
  transactionId: string;
  leaseRef?: string;
  onProgress: (progress: IFirmwareArtifactSelfTestProgress) => void;
  dependencies?: IFirmwareArtifactSelfTestDependencies;
}): Promise<IFirmwareArtifactSelfTestResult> => {
  const { adapter, download } = dependencies;
  let capabilities: Awaited<
    ReturnType<IFirmwareArtifactAdapter['getCapabilities']>
  >;
  try {
    capabilities = await adapter.getCapabilities();
  } catch (error) {
    throw normalizeFirmwareArtifactSelfTestError(
      error,
      'ARTIFACT_CAPABILITY_UNAVAILABLE',
    );
  }
  if (!isFirmwareArtifactCapabilityReadyValue(capabilities)) {
    throw new OneKeyLocalError('ARTIFACT_CAPABILITY_MISMATCH');
  }
  const { artifact, artifactId } =
    getFirmwareArtifactSelfTestArtifact(scenario);
  let leaseRef = existingLeaseRef;
  if (!leaseRef) {
    try {
      leaseRef = (await adapter.createLease(transactionId)).leaseRef;
    } catch (error) {
      throw normalizeFirmwareArtifactSelfTestError(
        error,
        'ARTIFACT_LEASE_CREATE_FAILED',
      );
    }
  }
  let disposition: 'completed' | 'safeCancelled' | 'safeAbandoned' =
    'completed';
  let failure: unknown;
  let readerId: string | undefined;
  let bytesRead = 0;
  let chunkCount = 0;
  let materializedEntryCount = 0;
  let deletedFiles = 0;
  let deletedBytes = 0;

  try {
    onProgress({ phase: 'downloading', progress: 10 });
    const receipt = await download({
      artifact,
      artifactId,
      transactionId,
      leaseRef,
      deadlineAt: Date.now() + 30 * 60 * 1000,
    });

    onProgress({ phase: 'reading', progress: 65 });
    const reader = await adapter.open(receipt.artifactRef);
    readerId = reader.readerId;
    if (reader.size !== artifact.expectedSize) {
      throw new OneKeyLocalError(
        'Firmware artifact reader size does not match the catalog',
      );
    }
    while (bytesRead < reader.size) {
      const length = Math.min(READER_CHUNK_BYTES, reader.size - bytesRead);
      const chunk = await adapter.read({
        readerId,
        offset: bytesRead,
        length,
      });
      if (chunk.byteLength !== length) {
        throw new OneKeyLocalError(
          'Firmware artifact reader returned an incomplete chunk',
        );
      }
      bytesRead += chunk.byteLength;
      chunkCount += 1;
      onProgress({
        phase: 'reading',
        progress: 65 + Math.floor((bytesRead / reader.size) * 20),
        bytesRead,
        chunkCount,
      });
    }
    await adapter.close(readerId);
    readerId = undefined;

    if (artifact.container === 'zip') {
      if (!artifact.expectedEntries?.length) {
        throw new OneKeyLocalError(
          'Trusted firmware archive has no exact entry allow-list',
        );
      }
      onProgress({
        phase: 'materializing',
        progress: 88,
        bytesRead,
        chunkCount,
      });
      const entries = await adapter.materialize({
        leaseRef,
        archiveArtifactRef: receipt.artifactRef,
        expectedEntries: artifact.expectedEntries,
      });
      materializedEntryCount = entries.length;
      if (materializedEntryCount !== artifact.expectedEntries.length) {
        throw new OneKeyLocalError(
          'Firmware archive materialization is incomplete',
        );
      }
    }
  } catch (error) {
    failure = error;
    disposition =
      getFirmwareArtifactSelfTestErrorCode(error) === 'ARTIFACT_CANCELLED'
        ? 'safeCancelled'
        : 'safeAbandoned';
  }

  if (readerId) {
    try {
      await adapter.close(readerId);
    } catch (error) {
      failure ??= error;
      disposition = 'safeAbandoned';
    }
  }

  onProgress({
    phase: 'releasing',
    progress: 94,
    bytesRead,
    chunkCount,
    materializedEntryCount,
  });
  try {
    await adapter.releaseLease({ leaseRef, disposition });
  } catch (error) {
    failure ??= error;
  }

  onProgress({
    phase: 'sweeping',
    progress: 97,
    bytesRead,
    chunkCount,
    materializedEntryCount,
  });
  try {
    const sweep = await adapter.sweepOrphans();
    deletedFiles = sweep.deletedFiles;
    deletedBytes = sweep.deletedBytes;
  } catch (error) {
    failure ??= error;
  }

  if (failure) {
    throw failure instanceof Error
      ? failure
      : new OneKeyLocalError(String(failure));
  }
  return {
    bytesRead,
    chunkCount,
    materializedEntryCount,
    deletedFiles,
    deletedBytes,
  };
};
