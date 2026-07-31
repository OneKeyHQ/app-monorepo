import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';

import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { isExternalFirmwareCapabilityReady } from './FirmwareArtifactPreflight';
import { executePreparedFirmwareUpdateV3 } from './FirmwarePreparedExecution';
import { firmwareUpdateTrace } from './FirmwareUpdateTrace';
import {
  getTrustedFirmwareArtifact,
  getTrustedFirmwareConfig,
} from './trustedFirmwareCatalog';

import type { IPreparedFirmwareArtifacts } from './FirmwareArtifactPreflight';
import type {
  FirmwarePreparedArtifactController,
  IFirmwarePreparedArtifactReleaseResult,
} from './FirmwarePreparedArtifactController';
import type { ITrustedFirmwareArtifact } from './trustedFirmwareCatalog';
import type { CoreApi, FirmwareUpdatePlan } from '@onekeyfe/hd-core';

export type IFirmwareArtifactSelfTestScenario =
  | 'pro-firmware'
  | 'pro-resource'
  | 'pro-full-resource';

export type IFirmwareArtifactSelfTestPhase =
  | 'starting'
  | 'preflight'
  | 'reading'
  | 'sdk-handoff'
  | 'device-boundary'
  | 'cache-stress'
  | 'failure-cleanup'
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
  preflightCompletedIterations?: number;
};

export type IFirmwareArtifactSelfTestResult = {
  bytesRead: number;
  chunkCount: number;
  materializedEntryCount: number;
  preflightCompletedIterations: number;
  preparedPlanValidated: boolean;
  sdkHandoffValidated: boolean;
  cleanupValidated: boolean;
  failureCleanupValidated: boolean;
  sdkBoundaryCode: string;
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
  preflightCompletedIterations: number;
  preparedPlanValidated: boolean;
  sdkHandoffValidated: boolean;
  cleanupValidated: boolean;
  failureCleanupValidated: boolean;
  sdkBoundaryCode?: string;
  deletedFiles: number;
  deletedBytes: number;
  errorCode?: string;
};

type IFirmwareArtifactSelfTestHost = Pick<
  FirmwarePreparedArtifactController,
  | 'getExecutionArtifacts'
  | 'sweepOrphanedArtifacts'
  | 'withPreparedPlanArtifacts'
>;

const PRO_FIRMWARE_VERSION = '4.21.0';
const READER_CHUNK_BYTES = 256 * 1024;
const PREFLIGHT_STRESS_READ_BYTES = 4 * 1024;
const PREFLIGHT_STRESS_ITERATIONS = 50;
const SDK_SELF_TEST_CONNECT_ID = '__firmware_sdk_self_test_no_device__';
const CONTROLLED_FAILURE_CODE = 'EXPECTED_FAILURE_CLEANUP_PROBE';

type IFirmwareArtifactSdkFailure = {
  code?: string | number;
  error: string;
};

const getProRelease = async () => {
  const config = await getTrustedFirmwareConfig({ preRelease: false });
  const release = config.pro['firmware-v8']?.find(
    (item) => item.version.join('.') === PRO_FIRMWARE_VERSION,
  );
  if (!release) {
    throw new OneKeyLocalError(
      `Trusted Pro firmware ${PRO_FIRMWARE_VERSION} is unavailable`,
    );
  }
  return release;
};

export const getFirmwareArtifactSelfTestArtifact = async (
  scenario: IFirmwareArtifactSelfTestScenario,
): Promise<{
  descriptor: IFirmwareArtifactSelfTestDescriptor;
  artifact: ITrustedFirmwareArtifact;
  artifactId: 'firmware' | 'resource';
}> => {
  const release = await getProRelease();
  let url: string | undefined;
  let label: string;
  let artifactId: 'firmware' | 'resource';
  if (scenario === 'pro-firmware') {
    url = release.url;
    label = 'Pro firmware';
    artifactId = 'firmware';
  } else if (scenario === 'pro-resource') {
    url = release.resource;
    label = 'Pro incremental resource';
    artifactId = 'resource';
  } else {
    url = release.fullResource;
    label = 'Pro full resource';
    artifactId = 'resource';
  }
  if (!url) {
    throw new OneKeyLocalError(`${label} URL is unavailable`);
  }
  const artifact = await getTrustedFirmwareArtifact(url);
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

const getSdkPlanPlatform = (): FirmwareUpdatePlan['platform'] =>
  platformEnv.isDesktop ? 'desktop' : 'native';

const digestFirmwareSelfTestPlan = async (
  plan: Omit<FirmwareUpdatePlan, 'planDigest'>,
): Promise<string> =>
  bufferUtils.bytesToHex(
    await appCrypto.hash.sha256(
      bufferUtils.toBuffer(stringUtils.stableStringify(plan), 'utf8'),
    ),
  );

const buildFirmwareSelfTestPlan = async ({
  artifact,
  artifactId,
  scenario,
}: {
  artifact: ITrustedFirmwareArtifact;
  artifactId: 'firmware' | 'resource';
  scenario: IFirmwareArtifactSelfTestScenario;
}): Promise<FirmwareUpdatePlan> => {
  const target = scenario === 'pro-firmware' ? 'firmware' : 'resource';
  const planWithoutDigest = {
    schemaVersion: 2,
    executor: 'v3',
    deviceIdentity: 'firmware-self-test-pro',
    deviceModel: String(EDeviceType.Pro),
    firmwareType: EFirmwareType.Universal,
    platform: getSdkPlanPlatform(),
    artifacts: [
      {
        artifactId,
        role: target,
        target,
        url: artifact.url,
        container: artifact.container,
        ...(artifact.logicalName ? { logicalName: artifact.logicalName } : {}),
        expectedSize: artifact.expectedSize,
        expectedSha256: artifact.expectedSha256.toLowerCase(),
        targetVersion: PRO_FIRMWARE_VERSION,
      },
    ],
    targetsToUpdate: [target],
  } as unknown as Omit<FirmwareUpdatePlan, 'planDigest'>;
  return {
    ...planWithoutDigest,
    planDigest: await digestFirmwareSelfTestPlan(planWithoutDigest),
  };
};

const readPreparedArtifact = async ({
  prepared,
  artifactId,
  expectedSize,
  maxBytes,
  onProgress,
}: {
  prepared: IPreparedFirmwareArtifacts;
  artifactId: 'firmware' | 'resource';
  expectedSize: number;
  maxBytes?: number;
  onProgress?: (bytesRead: number, chunkCount: number) => void;
}): Promise<{ bytesRead: number; chunkCount: number }> => {
  const artifact = prepared.artifactsById[artifactId];
  if (!artifact) {
    throw new OneKeyLocalError('ARTIFACT_PREPARED_REFERENCE_MISSING');
  }
  const reader = await prepared.artifactReader.open({
    artifactRef: artifact.artifactRef,
  });
  if (reader.size !== expectedSize || artifact.size !== expectedSize) {
    await prepared.artifactReader.close({ readerId: reader.readerId });
    throw new OneKeyLocalError('ARTIFACT_READER_SIZE_MISMATCH');
  }

  const totalBytes = Math.min(maxBytes ?? reader.size, reader.size);
  let bytesRead = 0;
  let chunkCount = 0;
  try {
    while (bytesRead < totalBytes) {
      const length = Math.min(READER_CHUNK_BYTES, totalBytes - bytesRead);
      const chunk = await prepared.artifactReader.read({
        readerId: reader.readerId,
        offset: bytesRead,
        length,
      });
      if (
        chunk.bytesRead !== length ||
        chunk.data.byteLength !== length ||
        chunk.eof !== (bytesRead + length === reader.size)
      ) {
        throw new OneKeyLocalError('ARTIFACT_READER_CHUNK_INVALID');
      }
      bytesRead += chunk.bytesRead;
      chunkCount += 1;
      onProgress?.(bytesRead, chunkCount);
    }
  } finally {
    await prepared.artifactReader.close({ readerId: reader.readerId });
  }
  return { bytesRead, chunkCount };
};

const getSdkFailure = async (
  operation: () => ReturnType<CoreApi['firmwareUpdateV3']>,
): Promise<IFirmwareArtifactSdkFailure> => {
  let result: Awaited<ReturnType<CoreApi['firmwareUpdateV3']>>;
  try {
    result = await operation();
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
  if (result.success) {
    throw new OneKeyLocalError(
      'SDK self-test unexpectedly reached device execution',
    );
  }
  return {
    code: result.payload.code,
    error: result.payload.error,
  };
};

const executeSdkDeviceBoundary = async ({
  controller,
  sdk,
  prepared,
}: {
  controller: IFirmwareArtifactSelfTestHost;
  sdk: CoreApi;
  prepared: IPreparedFirmwareArtifacts;
}): Promise<string> => {
  const executionArtifacts = controller.getExecutionArtifacts(
    prepared,
    'firmwareUpdateV3',
  );
  const targetVersion = prepared.plan.artifacts[0]?.targetVersion
    ?.split('.')
    .map((value) => Number.parseInt(value, 10));
  const failure = await getSdkFailure(() =>
    executePreparedFirmwareUpdateV3({
      sdk,
      connectId: SDK_SELF_TEST_CONNECT_ID,
      ...executionArtifacts,
      platform: prepared.plan.platform,
      firmwareType: prepared.plan.firmwareType,
      bleVersion: undefined,
      firmwareVersion:
        prepared.plan.targetsToUpdate.includes('firmware') &&
        targetVersion?.every(Number.isSafeInteger)
          ? targetVersion
          : undefined,
      bootloaderVersion: undefined,
    }),
  );
  if (
    /prepared plan|artifact binding|host binding|artifact reader/iu.test(
      failure.error,
    )
  ) {
    throw new OneKeyLocalError(
      `ARTIFACT_SDK_HANDOFF_REJECTED: ${failure.error}`,
    );
  }
  const boundaryCode = String(failure.code ?? 'DEVICE_BOUNDARY_REACHED');
  firmwareUpdateTrace({
    transactionId: prepared.transactionId,
    stage: 'device-boundary',
    executor: prepared.plan.executor,
    inputMode: 'artifact-reader',
    boundaryCode,
  });
  return boundaryCode;
};

const assertCleanup = (
  cleanup: IFirmwarePreparedArtifactReleaseResult | undefined,
  code: string,
): void => {
  if (!cleanup?.hostBindingReleased || !cleanup.leaseReleased) {
    throw new OneKeyLocalError(`ARTIFACT_${code}_FAILED`);
  }
};

export const executeFirmwareArtifactSelfTest = async ({
  scenario,
  transactionId,
  sdk,
  controller,
  onProgress,
}: {
  scenario: IFirmwareArtifactSelfTestScenario;
  transactionId: string;
  sdk: CoreApi;
  controller: IFirmwareArtifactSelfTestHost;
  onProgress: (progress: IFirmwareArtifactSelfTestProgress) => void;
}): Promise<IFirmwareArtifactSelfTestResult> => {
  if (!isExternalFirmwareCapabilityReady(sdk.getFirmwareUpdateCapabilities())) {
    throw new OneKeyLocalError('ARTIFACT_SDK_CAPABILITY_MISMATCH');
  }
  const { artifact, artifactId } =
    await getFirmwareArtifactSelfTestArtifact(scenario);
  const plan = await buildFirmwareSelfTestPlan({
    artifact,
    artifactId,
    scenario,
  });

  let mainCleanup: IFirmwarePreparedArtifactReleaseResult | undefined;
  onProgress({ phase: 'preflight', progress: 5 });
  const mainResult = await controller.withPreparedPlanArtifacts(
    { plan, sdk, transactionId },
    async (prepared) => {
      onProgress({ phase: 'reading', progress: 65 });
      const readerResult = await readPreparedArtifact({
        prepared,
        artifactId,
        expectedSize: artifact.expectedSize,
        onProgress: (bytesRead, chunkCount) => {
          onProgress({
            phase: 'reading',
            progress: 65 + Math.floor((bytesRead / artifact.expectedSize) * 20),
            bytesRead,
            chunkCount,
          });
        },
      });
      firmwareUpdateTrace({
        transactionId: prepared.transactionId,
        stage: 'reader-complete',
        executor: prepared.plan.executor,
        inputMode: 'artifact-reader',
        readerBytes: readerResult.bytesRead,
        readerChunks: readerResult.chunkCount,
      });
      onProgress({
        phase: 'sdk-handoff',
        progress: 88,
        ...readerResult,
        materializedEntryCount: prepared.selected.resourceEntries?.length ?? 0,
      });
      const sdkBoundaryCode = await executeSdkDeviceBoundary({
        controller,
        sdk,
        prepared,
      });
      onProgress({
        phase: 'device-boundary',
        progress: 90,
        ...readerResult,
        materializedEntryCount: prepared.selected.resourceEntries?.length ?? 0,
      });
      return {
        ...readerResult,
        materializedEntryCount: prepared.selected.resourceEntries?.length ?? 0,
        sdkBoundaryCode,
      };
    },
    (cleanup) => {
      mainCleanup = cleanup;
    },
  );
  assertCleanup(mainCleanup, 'MAIN_CLEANUP');

  let preflightCompletedIterations = 0;
  if (scenario === 'pro-firmware') {
    for (let index = 0; index < PREFLIGHT_STRESS_ITERATIONS; index += 1) {
      let iterationCleanup: IFirmwarePreparedArtifactReleaseResult | undefined;
      await controller.withPreparedPlanArtifacts(
        {
          plan,
          sdk,
          transactionId: `${transactionId}:stress:${index + 1}`,
        },
        async (prepared) => {
          await readPreparedArtifact({
            prepared,
            artifactId,
            expectedSize: artifact.expectedSize,
            maxBytes: PREFLIGHT_STRESS_READ_BYTES,
          });
        },
        (cleanup) => {
          iterationCleanup = cleanup;
        },
      );
      assertCleanup(iterationCleanup, 'CACHE_STRESS_CLEANUP');
      preflightCompletedIterations += 1;
      onProgress({
        phase: 'cache-stress',
        progress:
          91 +
          Math.floor(
            (preflightCompletedIterations / PREFLIGHT_STRESS_ITERATIONS) * 5,
          ),
        preflightCompletedIterations,
        bytesRead: mainResult.bytesRead,
        chunkCount: mainResult.chunkCount,
        materializedEntryCount: mainResult.materializedEntryCount,
      });
    }
  }

  let failureCleanup: IFirmwarePreparedArtifactReleaseResult | undefined;
  try {
    await controller.withPreparedPlanArtifacts(
      {
        plan,
        sdk,
        transactionId: `${transactionId}:failure-cleanup`,
      },
      async () => {
        throw new OneKeyLocalError(CONTROLLED_FAILURE_CODE);
      },
      (cleanup) => {
        failureCleanup = cleanup;
      },
    );
    throw new OneKeyLocalError('ARTIFACT_FAILURE_CLEANUP_NOT_TRIGGERED');
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== CONTROLLED_FAILURE_CODE
    ) {
      throw error;
    }
  }
  assertCleanup(failureCleanup, 'FAILURE_CLEANUP');
  onProgress({
    phase: 'failure-cleanup',
    progress: 97,
    bytesRead: mainResult.bytesRead,
    chunkCount: mainResult.chunkCount,
    materializedEntryCount: mainResult.materializedEntryCount,
    preflightCompletedIterations,
  });

  onProgress({
    phase: 'sweeping',
    progress: 99,
    bytesRead: mainResult.bytesRead,
    chunkCount: mainResult.chunkCount,
    materializedEntryCount: mainResult.materializedEntryCount,
    preflightCompletedIterations,
  });
  const sweep = await controller.sweepOrphanedArtifacts();
  return {
    ...mainResult,
    preflightCompletedIterations,
    preparedPlanValidated: true,
    sdkHandoffValidated: true,
    cleanupValidated: true,
    failureCleanupValidated: true,
    deletedFiles: sweep.deletedFiles,
    deletedBytes: sweep.deletedBytes,
  };
};
