import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';

import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { firmwareArtifactAdapter } from './FirmwareArtifactAdapter';
import {
  downloadTrustedFirmwareArtifact,
  isExternalFirmwareCapabilityReady,
  isFirmwareArtifactCapabilityReadyValue,
} from './FirmwareArtifactPreflight';
import {
  getTrustedFirmwareArtifact,
  getTrustedFirmwareConfig,
} from './trustedFirmwareCatalog';

import type { IFirmwareArtifactAdapter } from './FirmwareArtifactAdapter.types';
import type { ITrustedFirmwareArtifact } from './trustedFirmwareCatalog';
import type {
  CoreApi,
  FirmwareArtifactReader,
  FirmwareArtifactReference,
  FirmwareUpdatePlan,
} from '@onekeyfe/hd-core';

export type IFirmwareArtifactSelfTestScenario =
  | 'pro-firmware'
  | 'pro-resource'
  | 'pro-full-resource';

export type IFirmwareArtifactSelfTestPhase =
  | 'starting'
  | 'downloading'
  | 'reading'
  | 'materializing'
  | 'sdk-contract'
  | 'bridge-stress'
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
  stressCompletedIterations?: number;
};

export type IFirmwareArtifactSelfTestResult = {
  bytesRead: number;
  chunkCount: number;
  materializedEntryCount: number;
  stressCompletedIterations: number;
  sdkEntryValidated: boolean;
  sdkIntegrityRejected: boolean;
  sdkBindingReleased: boolean;
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
  stressCompletedIterations: number;
  sdkEntryValidated: boolean;
  sdkIntegrityRejected: boolean;
  sdkBindingReleased: boolean;
  sdkBoundaryCode?: string;
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
const BRIDGE_STRESS_READ_BYTES = 4 * 1024;
const BRIDGE_STRESS_ITERATIONS = 50;
const SDK_SELF_TEST_CONNECT_ID = '__firmware_sdk_self_test_no_device__';

type IFirmwareArtifactSelfTestSdk = Pick<
  CoreApi,
  | 'firmwareUpdateV3'
  | 'getFirmwareUpdateCapabilities'
  | 'prepareFirmwareUpdatePlan'
  | 'validateFirmwareUpdatePreparedPlan'
  | 'registerFirmwareUpdateHostBinding'
  | 'unregisterFirmwareUpdateHostBinding'
>;

type IFirmwareArtifactSdkProbeResult = Pick<
  IFirmwareArtifactSelfTestResult,
  | 'sdkEntryValidated'
  | 'sdkIntegrityRejected'
  | 'sdkBindingReleased'
  | 'sdkBoundaryCode'
>;

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
  artifactId: string;
}> => {
  const release = await getProRelease();
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

const normalizeFirmwareArtifactSelfTestError = (
  error: unknown,
  fallbackCode: string,
): unknown =>
  getFirmwareArtifactSelfTestErrorCode(error) === 'SELF_TEST_FAILED'
    ? new OneKeyLocalError(fallbackCode)
    : error;

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
  artifactId: string;
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

const getSdkFailure = async (
  operation: () => ReturnType<CoreApi['firmwareUpdateV3']>,
): Promise<IFirmwareArtifactSdkFailure> => {
  let result: Awaited<ReturnType<CoreApi['firmwareUpdateV3']>>;
  try {
    result = await operation();
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: String(error) };
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

const assertSdkFailure = ({
  failure,
  expected,
  fallbackCode,
}: {
  failure: IFirmwareArtifactSdkFailure;
  expected: RegExp;
  fallbackCode: string;
}) => {
  if (!expected.test(failure.error)) {
    throw new OneKeyLocalError(
      `${fallbackCode}: ${failure.error || 'SDK returned no error'}`,
    );
  }
};

const executeFirmwareArtifactSdkProbe = async ({
  sdk,
  adapter,
  artifact,
  artifactId,
  scenario,
  leaseRef,
  receipt,
  materializedEntries,
}: {
  sdk: IFirmwareArtifactSelfTestSdk;
  adapter: IFirmwareArtifactAdapter;
  artifact: ITrustedFirmwareArtifact;
  artifactId: string;
  scenario: IFirmwareArtifactSelfTestScenario;
  leaseRef: string;
  receipt: FirmwareArtifactReference;
  materializedEntries: {
    entryName: string;
    artifact: FirmwareArtifactReference;
  }[];
}): Promise<IFirmwareArtifactSdkProbeResult> => {
  if (!isExternalFirmwareCapabilityReady(sdk.getFirmwareUpdateCapabilities())) {
    throw new OneKeyLocalError('SDK_FIRMWARE_CAPABILITY_MISMATCH');
  }
  const plan = await buildFirmwareSelfTestPlan({
    artifact,
    artifactId,
    scenario,
  });
  const preparedPlan = sdk.prepareFirmwareUpdatePlan({
    plan,
    leaseRef,
    artifacts: [
      {
        artifactId,
        artifact: receipt,
        ...(materializedEntries.length ? { materializedEntries } : {}),
      },
    ],
  });
  const validatedPreparedPlan =
    sdk.validateFirmwareUpdatePreparedPlan(preparedPlan);
  if (
    validatedPreparedPlan.preparedPlanDigest !== preparedPlan.preparedPlanDigest
  ) {
    throw new OneKeyLocalError('SDK_PREPARED_PLAN_ROUND_TRIP_FAILED');
  }

  const readerSizes = new Map<string, number>();
  const generation = (
    sdk.registerFirmwareUpdateHostBinding as unknown as (binding: {
      artifactReader: FirmwareArtifactReader;
    }) => number
  )({
    artifactReader: {
      async open({ artifactRef }) {
        const opened = await adapter.open(artifactRef);
        readerSizes.set(opened.readerId, opened.size);
        return opened;
      },
      async read({ readerId, offset, length }) {
        const size = readerSizes.get(readerId);
        if (size === undefined) {
          throw new OneKeyLocalError('SDK self-test reader is not open');
        }
        const data = await adapter.read({ readerId, offset, length });
        return {
          data,
          bytesRead: data.byteLength,
          eof: offset + data.byteLength === size,
        };
      },
      async close({ readerId }) {
        readerSizes.delete(readerId);
        await adapter.close(readerId);
      },
    },
  });
  if (!Number.isSafeInteger(generation) || generation <= 0) {
    throw new OneKeyLocalError('SDK_HOST_BINDING_REGISTRATION_FAILED');
  }

  const target = scenario === 'pro-firmware' ? 'firmware' : 'resource';
  const artifacts =
    target === 'firmware'
      ? { firmware: receipt }
      : { resourceEntries: materializedEntries };
  const createParams = (
    nextArtifacts: typeof artifacts,
  ): Parameters<CoreApi['firmwareUpdateV3']>[1] =>
    ({
      preparedPlan,
      platform: plan.platform,
      firmwareVersion: target === 'firmware' ? [4, 21, 0] : undefined,
      firmwareType: EFirmwareType.Universal,
      artifacts: nextArtifacts,
      hostBindingGeneration: generation,
      retryCount: 0,
      pollIntervalTime: 10,
      timeout: 500,
      skipWebDevicePrompt: true,
    }) as Parameters<CoreApi['firmwareUpdateV3']>[1];

  let bindingReleased = false;
  try {
    const validFailure = await getSdkFailure(() =>
      sdk.firmwareUpdateV3(SDK_SELF_TEST_CONNECT_ID, createParams(artifacts)),
    );
    if (
      /prepared plan|artifact binding|host binding|artifact reader/iu.test(
        validFailure.error,
      )
    ) {
      throw new OneKeyLocalError(
        `SDK_VALID_ENTRY_REJECTED: ${validFailure.error}`,
      );
    }

    const tamperedReference = {
      ...receipt,
      sha256:
        receipt.sha256 === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64),
    };
    const tamperedArtifacts =
      target === 'firmware'
        ? { firmware: tamperedReference }
        : {
            resourceEntries: materializedEntries.map((entry, index) =>
              index === 0 ? { ...entry, artifact: tamperedReference } : entry,
            ),
          };
    const integrityFailure = await getSdkFailure(() =>
      sdk.firmwareUpdateV3(
        SDK_SELF_TEST_CONNECT_ID,
        createParams(tamperedArtifacts),
      ),
    );
    assertSdkFailure({
      failure: integrityFailure,
      expected: /prepared plan artifact binding is invalid/iu,
      fallbackCode: 'SDK_INTEGRITY_CONTRACT_NOT_ENFORCED',
    });

    bindingReleased = sdk.unregisterFirmwareUpdateHostBinding(generation);
    if (!bindingReleased) {
      throw new OneKeyLocalError('SDK_HOST_BINDING_RELEASE_FAILED');
    }
    const releasedBindingFailure = await getSdkFailure(() =>
      sdk.firmwareUpdateV3(SDK_SELF_TEST_CONNECT_ID, createParams(artifacts)),
    );
    assertSdkFailure({
      failure: releasedBindingFailure,
      expected: /host binding generation .* is stale/iu,
      fallbackCode: 'SDK_RELEASE_CONTRACT_NOT_ENFORCED',
    });

    return {
      sdkEntryValidated: true,
      sdkIntegrityRejected: true,
      sdkBindingReleased: true,
      sdkBoundaryCode: String(validFailure.code ?? 'DEVICE_BOUNDARY_REACHED'),
    };
  } finally {
    if (!bindingReleased) {
      sdk.unregisterFirmwareUpdateHostBinding(generation);
    }
  }
};

const executeFirmwareArtifactBridgeStress = async ({
  adapter,
  download,
  artifact,
  artifactId,
  transactionId,
  onProgress,
}: {
  adapter: IFirmwareArtifactAdapter;
  download: typeof downloadTrustedFirmwareArtifact;
  artifact: ITrustedFirmwareArtifact;
  artifactId: string;
  transactionId: string;
  onProgress: (progress: IFirmwareArtifactSelfTestProgress) => void;
}): Promise<number> => {
  let completedIterations = 0;
  for (let index = 0; index < BRIDGE_STRESS_ITERATIONS; index += 1) {
    const stressTransactionId = `${transactionId}:stress:${index + 1}`;
    let leaseRef: string | undefined;
    let readerId: string | undefined;
    let failure: unknown;
    try {
      leaseRef = (await adapter.createLease(stressTransactionId)).leaseRef;
      const receipt = await download({
        artifact,
        artifactId,
        transactionId: stressTransactionId,
        leaseRef,
        deadlineAt: Date.now() + 5 * 60 * 1000,
      });
      const reader = await adapter.open(receipt.artifactRef);
      readerId = reader.readerId;
      if (reader.size !== artifact.expectedSize) {
        throw new OneKeyLocalError(
          'Firmware artifact stress reader size does not match the catalog',
        );
      }
      const length = Math.min(BRIDGE_STRESS_READ_BYTES, reader.size);
      const chunk = await adapter.read({
        readerId,
        offset: 0,
        length,
      });
      if (chunk.byteLength !== length) {
        throw new OneKeyLocalError(
          'Firmware artifact stress reader returned an incomplete chunk',
        );
      }
      await adapter.close(readerId);
      readerId = undefined;
    } catch (error) {
      failure = error;
    }

    if (readerId) {
      try {
        await adapter.close(readerId);
      } catch (error) {
        failure ??= error;
      }
    }
    if (leaseRef) {
      try {
        await adapter.releaseLease({
          leaseRef,
          disposition: failure ? 'safeAbandoned' : 'completed',
        });
      } catch (error) {
        failure ??= error;
      }
    }
    if (failure) {
      const message =
        failure instanceof Error ? failure.message : String(failure);
      throw new OneKeyLocalError(
        `ARTIFACT_BRIDGE_STRESS_FAILED: iteration ${index + 1}: ${message}`,
      );
    }

    completedIterations += 1;
    onProgress({
      phase: 'bridge-stress',
      progress:
        92 + Math.floor((completedIterations / BRIDGE_STRESS_ITERATIONS) * 2),
      stressCompletedIterations: completedIterations,
    });
  }
  return completedIterations;
};

export const executeFirmwareArtifactSelfTest = async ({
  scenario,
  transactionId,
  leaseRef: existingLeaseRef,
  sdk,
  onProgress,
  dependencies = {
    adapter: firmwareArtifactAdapter,
    download: downloadTrustedFirmwareArtifact,
  },
}: {
  scenario: IFirmwareArtifactSelfTestScenario;
  transactionId: string;
  leaseRef?: string;
  sdk: IFirmwareArtifactSelfTestSdk;
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
    await getFirmwareArtifactSelfTestArtifact(scenario);
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
  let stressCompletedIterations = 0;
  let sdkEntryValidated = false;
  let sdkIntegrityRejected = false;
  let sdkBindingReleased = false;
  let sdkBoundaryCode = '';
  let deletedFiles = 0;
  let deletedBytes = 0;
  let receipt: FirmwareArtifactReference | undefined;
  let materializedEntries: {
    entryName: string;
    artifact: FirmwareArtifactReference;
  }[] = [];

  try {
    onProgress({ phase: 'downloading', progress: 10 });
    receipt = await download({
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
      materializedEntries = entries.map((entry) => ({
        entryName: entry.entryName,
        artifact: entry.receipt,
      }));
      if (materializedEntryCount !== artifact.expectedEntries.length) {
        throw new OneKeyLocalError(
          'Firmware archive materialization is incomplete',
        );
      }
    }
    onProgress({
      phase: 'sdk-contract',
      progress: 91,
      bytesRead,
      chunkCount,
      materializedEntryCount,
    });
    const sdkResult = await executeFirmwareArtifactSdkProbe({
      sdk,
      adapter,
      artifact,
      artifactId,
      scenario,
      leaseRef,
      receipt,
      materializedEntries,
    });
    sdkEntryValidated = sdkResult.sdkEntryValidated;
    sdkIntegrityRejected = sdkResult.sdkIntegrityRejected;
    sdkBindingReleased = sdkResult.sdkBindingReleased;
    sdkBoundaryCode = sdkResult.sdkBoundaryCode;
    if (scenario === 'pro-firmware') {
      stressCompletedIterations = await executeFirmwareArtifactBridgeStress({
        adapter,
        download,
        artifact,
        artifactId,
        transactionId,
        onProgress,
      });
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
    stressCompletedIterations,
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
    stressCompletedIterations,
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
    stressCompletedIterations,
    sdkEntryValidated,
    sdkIntegrityRejected,
    sdkBindingReleased,
    sdkBoundaryCode,
    deletedFiles,
    deletedBytes,
  };
};
