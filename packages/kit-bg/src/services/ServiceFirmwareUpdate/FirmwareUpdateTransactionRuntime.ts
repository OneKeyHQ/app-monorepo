import { EDeviceType, type EFirmwareType } from '@onekeyfe/hd-shared';
import semver from 'semver';

import {
  FirmwareUpdateBatteryTooLow,
  NeedFirmwareUpgradeFromWeb,
  NeedOneKeyBridgeUpgrade,
  OneKeyLocalError,
  UseDesktopToUpdateFirmware,
} from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  type IFirmwareUpdateCapabilityGate,
  getFirmwareUpdateCapabilityGate,
} from '@onekeyhq/shared/src/hardware/firmwareUpdateCapabilities';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import requestHelper from '@onekeyhq/shared/src/request/requestHelper';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

import { FirmwareArtifactProvider } from './FirmwareArtifactProvider';
import { FirmwareManifestProvider } from './FirmwareManifestProvider';
import {
  FirmwareUpdateAnalytics,
  type IFirmwareUpdateAnalyticsContext,
} from './FirmwareUpdateAnalytics';
import { FirmwareUpdateBootstrapRecovery } from './FirmwareUpdateBootstrapRecovery';
import {
  FIRMWARE_UPDATE_MIN_BATTERY_LEVEL,
  FIRMWARE_UPDATE_MIN_VERSION_ALLOWED,
} from './firmwareUpdateConsts';
import { FirmwareUpdateCoordinator } from './FirmwareUpdateCoordinator';
import {
  type FIRMWARE_UPDATE_COMPATIBILITY_DEV_SETTING_KEYS,
  FirmwareUpdateEligibility,
  type IFirmwareUpdateUserConfirmationDto,
} from './FirmwareUpdateEligibility';
import { firmwareUpdateJournal } from './FirmwareUpdateJournal';
import {
  type IFirmwareUpdateRolloutDecision,
  evaluateFirmwareUpdateRollout,
} from './FirmwareUpdateRolloutPolicy';
import {
  type EFirmwareUpdateRuntimeResetReason,
  type FirmwareUpdateRuntimeBinding,
  createDefaultFirmwareUpdateRuntimeBinding,
} from './FirmwareUpdateRuntimeBinding';

import type { FirmwareArtifactStore } from './FirmwareArtifactStore';
import type {
  IFirmwareCheckpoint,
  IFirmwareManifestChannel,
  IFirmwareManifestField,
  IFirmwareManifestFirmwareType,
  IFirmwareManifestLoadResult,
  IFirmwareManifestSelection,
  IFirmwarePreparedPlan,
  IFirmwareUpdateCoordinatorProjection,
  IFirmwareUpdateJournalEnvelope,
  IFirmwareUpdatePlan,
} from './firmwareUpdateCoordinatorTypes';
import type { CoreApi, Features, IDeviceType } from '@onekeyfe/hd-core';

type IFirmwareUpdateDevSettingKey =
  (typeof FIRMWARE_UPDATE_COMPATIBILITY_DEV_SETTING_KEYS)[number];

export type IFirmwareUpdateTransactionStartInput = {
  connectId: string;
  updateType: 'firmware' | 'ble';
  channel?: IFirmwareManifestChannel;
  firmwareType?: IFirmwareManifestFirmwareType;
  confirmations: IFirmwareUpdateUserConfirmationDto;
};

type IFirmwareDeviceVersions = {
  firmware: string;
  ble: string;
  bootloader: string;
};

type IFirmwareUpdateEligibilityPlan = {
  artifacts: readonly Pick<
    IFirmwareUpdatePlan['artifacts'][number],
    'target'
  >[];
  expectedFinalStates: IFirmwareUpdatePlan['expectedFinalStates'];
};

export type IFirmwareUpdateTransactionEligibilityContext = {
  originalConnectId: string | undefined;
  updatingConnectId: string | undefined;
  stableDeviceId: string;
  model: IFirmwareManifestSelection['deviceModel'];
  currentFirmwareType: IFirmwareManifestFirmwareType;
  firmwareType: IFirmwareManifestFirmwareType;
  currentVersions: IFirmwareDeviceVersions;
  isBootloaderMode: boolean;
  batteryLevel: number | undefined;
  plan: IFirmwareUpdateEligibilityPlan;
  latestFeatures: Features;
};

export type IFirmwareUpdateTransactionRuntimeDependencies = {
  getFeatures: (connectId: string | undefined) => Promise<Features>;
  getHardwareSdk: (connectId: string | undefined) => Promise<CoreApi>;
  getTransportType: () => Promise<EHardwareTransportType | undefined>;
  getInstallationKey: () => Promise<string>;
  getFallbackStableDeviceId: (connectId: string) => Promise<string | undefined>;
  getRecoveryConnectId: (stableDeviceId: string) => Promise<string | undefined>;
  getDevSetting: (
    key: IFirmwareUpdateDevSettingKey,
  ) => Promise<boolean | undefined>;
  resolveUpdatingConnectId: (input: {
    connectId: string;
    transportType: EHardwareTransportType;
  }) => string | undefined;
  createArtifactStore: () => FirmwareArtifactStore;
  runHardwareMutation?: (input: {
    originalConnectId: string | undefined;
    execute: () => Promise<unknown>;
  }) => Promise<unknown>;
  onTransactionCompleted?: (input: {
    sessionId: string;
    originalConnectId: string | undefined;
    currentFirmwareType: IFirmwareManifestFirmwareType;
    firmwareType: IFirmwareManifestFirmwareType;
    expectedFinalStates: IFirmwareUpdatePlan['expectedFinalStates'];
  }) => Promise<void>;
  publishProjection?: (
    projection: IFirmwareUpdateCoordinatorProjection,
  ) => Promise<void>;
};

const MODEL_VALUES = new Set<IFirmwareManifestSelection['deviceModel']>([
  'classic',
  'classic1s',
  'classicpure',
  'mini',
  'touch',
  'pro',
  'pro2',
]);

const FIRMWARE_FIELDS = new Set<IFirmwareManifestField>([
  'firmware',
  'firmware-v1',
  'firmware-v2',
  'firmware-v8',
  'firmware-btc-v8',
  'ble',
]);

const transactionError = (code: string, message: string): OneKeyLocalError =>
  Object.assign(new OneKeyLocalError(message), {
    firmwareUpdateTransactionCode: code,
  });

const normalizeModel = (
  value: IDeviceType,
): IFirmwareManifestSelection['deviceModel'] => {
  if (MODEL_VALUES.has(value as IFirmwareManifestSelection['deviceModel'])) {
    return value as IFirmwareManifestSelection['deviceModel'];
  }
  throw transactionError(
    'UNSUPPORTED_DEVICE',
    `Firmware transaction does not support device model ${String(value)}`,
  );
};

const normalizeFirmwareType = (
  value: string | undefined,
): IFirmwareManifestFirmwareType => {
  if (value === 'universal' || value === 'bitcoinonly') return value;
  throw transactionError(
    'UNSUPPORTED_FIRMWARE_TYPE',
    'Firmware transaction received an unsupported firmware type',
  );
};

const normalizeVersion = (value: readonly number[]): string => {
  const version = value.join('.');
  return semver.valid(version) ? version : '0.0.0';
};

const normalizeBatteryLevel = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
};

const getPlatform = (): 'ios' | 'android' | 'desktop' => {
  if (platformEnv.isNativeIOS) return 'ios';
  if (platformEnv.isNativeAndroid) return 'android';
  if (platformEnv.isDesktop) return 'desktop';
  throw transactionError(
    'PLATFORM_NOT_SUPPORTED',
    'Firmware transactions are available only on Native and Desktop',
  );
};

const getDeploymentTarget = () => {
  if (platformEnv.isNative) return 'native' as const;
  if (platformEnv.isDesktop) return 'desktop' as const;
  return 'sdk-managed' as const;
};

const getUpdateFlow = (
  model: IFirmwareManifestSelection['deviceModel'],
): 'v2' | 'v3' | 'v4' => {
  if (model === 'pro2') return 'v4';
  if (model === 'touch' || model === 'pro') return 'v3';
  return 'v2';
};

const getAnalyticsDeviceType = (
  model: IFirmwareManifestSelection['deviceModel'],
): IDeviceType => {
  const deviceTypes: Record<
    IFirmwareManifestSelection['deviceModel'],
    IDeviceType
  > = {
    classic: EDeviceType.Classic,
    classic1s: EDeviceType.Classic1s,
    classicpure: EDeviceType.ClassicPure,
    mini: EDeviceType.Mini,
    touch: EDeviceType.Touch,
    pro: EDeviceType.Pro,
    pro2: EDeviceType.Pro2,
  };
  return deviceTypes[model];
};

const getSdkErrorCode = (
  journal: IFirmwareUpdateJournalEnvelope,
): string | undefined => {
  const code = journal.sanitizedError?.code;
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/u.test(code)
    ? code
    : undefined;
};

const getTargetVersion = (
  plan: IFirmwareUpdateEligibilityPlan,
  target: IFirmwareUpdatePlan['artifacts'][number]['target'],
) => plan.expectedFinalStates.find((state) => state.target === target)?.version;

const hasTarget = (
  plan: IFirmwareUpdateEligibilityPlan,
  target: IFirmwareUpdatePlan['artifacts'][number]['target'],
) => plan.artifacts.some((artifact) => artifact.target === target);

const getEligibilityPlanFromJournal = (
  journal: IFirmwareUpdateJournalEnvelope,
): IFirmwareUpdateEligibilityPlan | undefined => {
  if (journal.updatePlan) return journal.updatePlan;
  if (!journal.preparedPlan) return undefined;
  return {
    artifacts: journal.preparedPlan.artifactReceipts.map(({ target }) => ({
      target,
    })),
    expectedFinalStates: journal.preparedPlan.expectedFinalStates,
  };
};

export class FirmwareUpdateTransactionRuntime {
  private readonly artifactStore: FirmwareArtifactStore;

  private readonly manifestProvider = new FirmwareManifestProvider();

  private readonly analytics = new FirmwareUpdateAnalytics();

  private readonly runtimeBinding: FirmwareUpdateRuntimeBinding;

  private readonly coordinator: FirmwareUpdateCoordinator<IFirmwareUpdateTransactionEligibilityContext>;

  private readonly bootstrapRecovery: FirmwareUpdateBootstrapRecovery<IFirmwareUpdateTransactionEligibilityContext>;

  private readonly contexts = new Map<
    string,
    IFirmwareUpdateTransactionEligibilityContext
  >();

  private readonly analyticsContexts = new Map<
    string,
    {
      context: IFirmwareUpdateAnalyticsContext;
      manifestSource?: IFirmwareManifestLoadResult['source'];
    }
  >();

  constructor(
    private readonly dependencies: IFirmwareUpdateTransactionRuntimeDependencies,
  ) {
    this.artifactStore = dependencies.createArtifactStore();
    const artifactProvider = new FirmwareArtifactProvider(this.artifactStore);
    const eligibility =
      new FirmwareUpdateEligibility<IFirmwareUpdateTransactionEligibilityContext>(
        {
          validateFullResource: (context) => this.validateFullResource(context),
          validateMinimumVersions: (context) =>
            this.validateMinimumVersions(context),
          validateBridge: (context) => this.validateBridge(context),
          validateBattery: (context) => this.validateBattery(context),
          revalidateConnection: (context) => this.revalidateConnection(context),
          revalidateIdentity: (context) => this.revalidateIdentity(context),
        },
      );
    this.runtimeBinding = createDefaultFirmwareUpdateRuntimeBinding({
      getTransportType: dependencies.getTransportType,
    });
    this.coordinator =
      new FirmwareUpdateCoordinator<IFirmwareUpdateTransactionEligibilityContext>(
        {
          journal: firmwareUpdateJournal,
          artifactProvider,
          artifactStore: this.artifactStore,
          eligibility,
          runtimeBinding: this.runtimeBinding,
          executePreparedPlan: (input) => this.executePreparedPlan(input),
          cancelExecution: (sessionId) =>
            this.cancelPreparedPlanExecution(sessionId),
          publishProjection:
            dependencies.publishProjection ?? (async () => undefined),
          onPhaseCommitted: async (journal) => {
            const analyticsContext = this.analyticsContexts.get(
              journal.transactionId,
            );
            if (!analyticsContext) return;
            this.analytics.recordPhaseChanged({
              sessionId: journal.transactionId,
              revision: journal.revision,
              phase: journal.phase,
              context: analyticsContext.context,
              ...(getSdkErrorCode(journal)
                ? { sdkErrorCode: getSdkErrorCode(journal) }
                : {}),
            });
          },
          onArtifactAcquired: async ({
            transactionId,
            artifactId,
            artifactBytes,
            telemetry,
          }) => {
            const analyticsContext = this.analyticsContexts.get(transactionId);
            if (!analyticsContext?.manifestSource) return;
            this.analytics.recordArtifactAcquired({
              sessionId: transactionId,
              artifactId,
              context: analyticsContext.context,
              manifestSource: analyticsContext.manifestSource,
              routeType: telemetry.routeType,
              candidateIndex: telemetry.candidateIndex,
              artifactBytes,
              durationMs: telemetry.durationMs,
              bytesReused: telemetry.bytesReused,
              resumeKind: telemetry.resumeKind,
              resumeCount: telemetry.resumeCount,
            });
          },
        },
      );
    this.bootstrapRecovery =
      new FirmwareUpdateBootstrapRecovery<IFirmwareUpdateTransactionEligibilityContext>(
        {
          journal: firmwareUpdateJournal,
          artifactStore: this.artifactStore,
          coordinator: this.coordinator,
          getCapabilityGate: (hasActiveJournal) =>
            this.getCapabilityGate(hasActiveJournal),
          recoverTransaction: (input) => this.recoverTransaction(input),
          now: Date.now,
        },
      );
  }

  private async getCapabilityGate(
    hasActiveJournal?: boolean,
  ): Promise<IFirmwareUpdateCapabilityGate> {
    const existing =
      hasActiveJournal === undefined
        ? await firmwareUpdateJournal.read()
        : undefined;
    const sdk = await CoreSDKLoader();
    let sdkCapabilities: unknown;
    let artifactCapabilities: unknown;
    try {
      sdkCapabilities = sdk.getFirmwareUpdateCapabilities();
    } catch {
      sdkCapabilities = undefined;
    }
    try {
      artifactCapabilities = await this.artifactStore.getCapabilitySnapshot();
    } catch {
      artifactCapabilities = undefined;
    }
    return getFirmwareUpdateCapabilityGate({
      deploymentTarget: getDeploymentTarget(),
      sdkCapabilities,
      artifactCapabilities,
      hasActiveJournal:
        hasActiveJournal ?? Boolean(existing && !existing.terminalTombstone),
    });
  }

  private async resolveRollout({
    sessionId,
    model,
  }: {
    sessionId: string;
    model: IFirmwareManifestSelection['deviceModel'];
  }): Promise<IFirmwareUpdateRolloutDecision> {
    const configWithRuntime = await requestHelper
      .getFirmwareArtifactIpTableConfig()
      .catch(() => null);
    const decision = evaluateFirmwareUpdateRollout({
      signedRemoteConfig: configWithRuntime?.config.firmware_rollout,
      ruleName: 'coordinatorExternalOnly',
      installationKey: await this.dependencies.getInstallationKey(),
      platform: getPlatform(),
      deviceType: model,
      appVersion: platformEnv.version ?? '0.0.0',
    });
    const transportType = await this.dependencies.getTransportType();
    const analyticsContext = {
      deviceType: getAnalyticsDeviceType(model),
      transportType,
      updateFlow: getUpdateFlow(model),
      policyVersion: decision.policyVersion,
      cohortBucket: decision.cohortBucket,
    };
    this.analytics.recordRolloutDecision({
      sessionId,
      context: analyticsContext,
      allowed: decision.allowed,
      reason: decision.reason,
    });
    return decision;
  }

  private async getDeviceContext({
    connectId,
    firmwareType: requestedFirmwareType,
  }: Pick<IFirmwareUpdateTransactionStartInput, 'connectId' | 'firmwareType'>) {
    const sdk = await CoreSDKLoader();
    const features = await this.dependencies.getFeatures(connectId);
    const model = normalizeModel(sdk.getDeviceType(features));
    const currentFirmwareType = normalizeFirmwareType(
      sdk.getFirmwareType(features),
    );
    const firmwareType = normalizeFirmwareType(
      requestedFirmwareType ?? currentFirmwareType,
    );
    const stableDeviceId =
      sdk.getDeviceUUID(features) ||
      (await this.dependencies.getFallbackStableDeviceId(connectId));
    if (!stableDeviceId) {
      throw transactionError(
        'DEVICE_IDENTITY_UNAVAILABLE',
        'Firmware transaction could not establish a stable device identity',
      );
    }
    const transportType = await this.dependencies.getTransportType();
    if (!transportType) {
      throw transactionError(
        'TRANSPORT_UNAVAILABLE',
        'Firmware transaction has no active hardware transport',
      );
    }
    const currentVersions: IFirmwareDeviceVersions = {
      firmware: normalizeVersion(sdk.getDeviceFirmwareVersion(features)),
      ble: normalizeVersion(sdk.getDeviceBLEFirmwareVersion(features)),
      bootloader: normalizeVersion(sdk.getDeviceBootloaderVersion(features)),
    };
    return {
      features,
      model,
      currentFirmwareType,
      firmwareType,
      stableDeviceId,
      currentVersions,
      transportType,
      updatingConnectId: this.dependencies.resolveUpdatingConnectId({
        connectId,
        transportType,
      }),
      isBootloaderMode:
        features.bootloaderMode === true || features.bootloader_mode === true,
      batteryLevel: normalizeBatteryLevel(features.battery_level),
    };
  }

  private async getManifest({
    features,
    model,
    firmwareType,
    updateType,
    channel,
  }: {
    features: Features;
    model: IFirmwareManifestSelection['deviceModel'];
    firmwareType: IFirmwareManifestFirmwareType;
    updateType: IFirmwareUpdateTransactionStartInput['updateType'];
    channel: IFirmwareManifestChannel;
  }): Promise<{
    manifest: IFirmwareManifestLoadResult;
    firmwareField: IFirmwareManifestField;
  }> {
    const sdk = await CoreSDKLoader();
    const fields = sdk.getFirmwareUpdateFieldArray(features, updateType);
    let lastError: unknown;
    for (const value of fields) {
      if (FIRMWARE_FIELDS.has(value as IFirmwareManifestField)) {
        const firmwareField = value as IFirmwareManifestField;
        try {
          return {
            manifest: await this.manifestProvider.loadManifest({
              channel,
              deviceModel: model,
              firmwareField,
              firmwareType,
            }),
            firmwareField,
          };
        } catch (error) {
          lastError = error;
          if (
            !(
              error instanceof OneKeyLocalError &&
              'firmwareManifestCode' in error &&
              error.firmwareManifestCode === 'CATALOG_ENTRY_MISSING'
            )
          ) {
            throw error;
          }
        }
      }
    }
    throw (
      lastError ??
      transactionError(
        'MANIFEST_SELECTION_UNAVAILABLE',
        'Firmware transaction has no supported manifest selection',
      )
    );
  }

  private async applyPlanDevSettings(
    versions: IFirmwareDeviceVersions,
    updateType: IFirmwareUpdateTransactionStartInput['updateType'],
  ): Promise<IFirmwareDeviceVersions> {
    if (await this.dependencies.getDevSetting('allIsUpToDate')) {
      throw transactionError(
        'NO_UPDATE_AVAILABLE',
        'Firmware update is disabled by the all-up-to-date development override',
      );
    }
    const next = { ...versions };
    if (
      updateType === 'firmware' &&
      ((await this.dependencies.getDevSetting('forceUpdateFirmware')) ||
        (await this.dependencies.getDevSetting('forceUpdateOnceFirmware')) ||
        (await this.dependencies.getDevSetting('forceUpdateBootloader')) ||
        (await this.dependencies.getDevSetting('forceUpdateOnceBootloader')) ||
        (await this.dependencies.getDevSetting(
          'forceUpdateResEvenSameVersion',
        )))
    ) {
      next.firmware = '0.0.0';
    }
    if (
      updateType === 'ble' &&
      ((await this.dependencies.getDevSetting('forceUpdateBle')) ||
        (await this.dependencies.getDevSetting('forceUpdateOnceBle')))
    ) {
      next.ble = '0.0.0';
    }
    return next;
  }

  async start(
    input: IFirmwareUpdateTransactionStartInput,
  ): Promise<IFirmwareUpdateCoordinatorProjection> {
    getPlatform();
    const sessionId = `firmware-${generateUUID()}`;
    const existing = await firmwareUpdateJournal.read();
    if (existing?.terminalTombstone) {
      await firmwareUpdateJournal.clearTerminal();
    } else if (existing) {
      throw transactionError(
        'TRANSACTION_ALREADY_ACTIVE',
        'A firmware update transaction is already active',
      );
    }
    await this.coordinator.beginDiscovery(sessionId);
    try {
      const device = await this.getDeviceContext(input);
      const rolloutDecision = await this.resolveRollout({
        sessionId,
        model: device.model,
      });
      if (!rolloutDecision.allowed) {
        throw transactionError(
          'ROLLOUT_NOT_ALLOWED',
          `Firmware transaction rollout denied: ${rolloutDecision.reason}`,
        );
      }
      const capabilityGate = await this.getCapabilityGate();
      if (!capabilityGate.ready) {
        throw transactionError(
          'CAPABILITY_NOT_READY',
          `Firmware transaction capability gate failed: ${capabilityGate.failure}`,
        );
      }
      const channel = input.channel ?? 'stable';
      const { manifest } = await this.getManifest({
        features: device.features,
        model: device.model,
        firmwareType: device.firmwareType,
        updateType: input.updateType,
        channel,
      });
      const sdk = await CoreSDKLoader();
      const effectiveVersions = await this.applyPlanDevSettings(
        device.currentVersions,
        input.updateType,
      );
      const plan = sdk.buildFirmwareUpdatePlan({
        manifestSnapshot: manifest.snapshot,
        manifestMode: 'external-only',
        deviceSnapshot: {
          identity: device.stableDeviceId,
          model: device.model,
          firmwareType: device.firmwareType,
          currentVersions: {
            firmware:
              input.updateType === 'ble'
                ? effectiveVersions.ble
                : effectiveVersions.firmware,
            ble: effectiveVersions.ble,
            bootloader: effectiveVersions.bootloader,
          },
        },
        channel,
      });
      const context: IFirmwareUpdateTransactionEligibilityContext = {
        originalConnectId: input.connectId,
        updatingConnectId: device.updatingConnectId,
        stableDeviceId: device.stableDeviceId,
        model: device.model,
        currentFirmwareType: device.currentFirmwareType,
        firmwareType: device.firmwareType,
        currentVersions: device.currentVersions,
        isBootloaderMode: device.isBootloaderMode,
        batteryLevel: device.batteryLevel,
        plan,
        latestFeatures: device.features,
      };
      this.contexts.set(sessionId, context);
      const analyticsContext = {
        deviceType: getAnalyticsDeviceType(device.model),
        transportType: device.transportType,
        updateFlow: getUpdateFlow(device.model),
        policyVersion: rolloutDecision.policyVersion,
        cohortBucket: rolloutDecision.cohortBucket,
      };
      this.analyticsContexts.set(sessionId, {
        context: analyticsContext,
        manifestSource: manifest.source,
      });
      const deviceSnapshotDigest = sdk.sha256CanonicalFirmwareJson({
        identity: device.stableDeviceId,
        model: device.model,
        firmwareType: device.firmwareType,
        currentVersions: device.currentVersions,
      });
      return await this.coordinator.createAndPrepare({
        transactionId: sessionId,
        plan,
        deviceSnapshotDigest,
        capabilityGate,
        rolloutDecision,
        confirmations: input.confirmations,
        eligibilityContext: context,
      });
    } catch (error) {
      if (!(await firmwareUpdateJournal.read())) {
        this.contexts.delete(sessionId);
        this.analyticsContexts.delete(sessionId);
        await this.coordinator.failDiscovery({ sessionId, error });
      }
      throw error;
    }
  }

  async execute({
    sessionId,
    connectId,
  }: {
    sessionId: string;
    connectId: string;
  }): Promise<IFirmwareUpdateCoordinatorProjection> {
    let context = this.contexts.get(sessionId);
    if (!context) {
      const journal = await firmwareUpdateJournal.read();
      if (
        !journal ||
        journal.transactionId !== sessionId ||
        !journal.preparedPlan
      ) {
        throw transactionError(
          'SESSION_CONTEXT_UNAVAILABLE',
          'Firmware transaction must be reconciled before execution',
        );
      }
      try {
        await this.coordinator.restorePreparedArtifacts(sessionId);
        context = await this.createRecoveryContext(journal, connectId);
        this.contexts.set(sessionId, context);
        this.restoreRecoveryAnalyticsContext({
          journal,
          context,
          transportType: await this.dependencies.getTransportType(),
        });
      } catch (error) {
        return this.coordinator.markRecoveryWaiting({
          sessionId,
          reason: this.getRecoveryWaitingReason(error),
          error,
        });
      }
    }
    if (
      context.originalConnectId !== undefined &&
      context.originalConnectId !== connectId
    ) {
      throw transactionError(
        'CONNECT_ID_MISMATCH',
        'Firmware transaction connectId does not match its prepared session',
      );
    }
    return this.executeCoordinator({
      sessionId,
      eligibilityContext: context,
    });
  }

  async resume({
    sessionId,
    connectId,
  }: {
    sessionId: string;
    connectId: string;
  }): Promise<IFirmwareUpdateCoordinatorProjection> {
    const journal = await firmwareUpdateJournal.read();
    if (!journal || journal.transactionId !== sessionId) {
      throw transactionError(
        'SESSION_CONTEXT_UNAVAILABLE',
        'Firmware transaction has no durable state to resume',
      );
    }
    let context = this.contexts.get(sessionId);
    if (!context) {
      context = await this.createRecoveryContext(journal, connectId);
      this.contexts.set(sessionId, context);
    }
    if (!journal.preparedPlan && journal.updatePlan) {
      const prepared = await this.coordinator.resumePreparation({
        sessionId,
        ...(journal.phase === 'PLAN_CREATED' ||
        journal.phase === 'ELIGIBILITY_CHECKING'
          ? { eligibilityContext: context }
          : {}),
      });
      if (prepared.phase !== 'PREPARED') return prepared;
    }
    return this.execute({ sessionId, connectId });
  }

  cancel(sessionId: string) {
    return this.coordinator.cancel(sessionId);
  }

  getProjection({ broadcast = false }: { broadcast?: boolean } = {}) {
    return this.coordinator.getProjection({ broadcast });
  }

  initializeRecoveryCritical() {
    return this.bootstrapRecovery.initializeCritical();
  }

  recoverAfterBootstrap() {
    return this.bootstrapRecovery.recoverAfterCritical();
  }

  async prepareForSdkReset(
    reason: Exclude<EFirmwareUpdateRuntimeResetReason, 'binding-replaced'>,
  ) {
    await this.runtimeBinding.prepareForSdkReset(reason);
  }

  async restoreAfterSdkReset() {
    return this.runtimeBinding.restoreAfterSdkReset();
  }

  private async createRecoveryContext(
    journal: IFirmwareUpdateJournalEnvelope,
    connectIdOverride?: string,
  ): Promise<IFirmwareUpdateTransactionEligibilityContext> {
    const plan = getEligibilityPlanFromJournal(journal);
    if (!plan) {
      throw transactionError(
        'RECOVERY_PLAN_UNAVAILABLE',
        'Firmware recovery has no eligibility plan',
      );
    }
    if (
      !MODEL_VALUES.has(
        journal.model as IFirmwareManifestSelection['deviceModel'],
      )
    ) {
      throw transactionError(
        'UNSUPPORTED_DEVICE',
        'Firmware recovery has an unsupported device model',
      );
    }
    const model = journal.model as IFirmwareManifestSelection['deviceModel'];
    const originalConnectId =
      connectIdOverride ??
      (await this.dependencies.getRecoveryConnectId(journal.stableDeviceId));
    const features = await this.dependencies.getFeatures(originalConnectId);
    const sdk = await CoreSDKLoader();
    const currentModel = normalizeModel(sdk.getDeviceType(features));
    const currentStableDeviceId =
      sdk.getDeviceUUID(features) ||
      (originalConnectId
        ? await this.dependencies.getFallbackStableDeviceId(originalConnectId)
        : undefined);
    if (
      currentModel !== model ||
      !currentStableDeviceId ||
      currentStableDeviceId !== journal.stableDeviceId
    ) {
      throw transactionError(
        'DEVICE_IDENTITY_CHANGED',
        'Firmware recovery found a different physical device',
      );
    }
    const firmwareType = normalizeFirmwareType(
      journal.preparedPlan?.device.firmwareType ??
        journal.updatePlan?.device.firmwareType ??
        sdk.getFirmwareType(features),
    );
    const currentFirmwareType = normalizeFirmwareType(
      sdk.getFirmwareType(features),
    );
    const transportType = await this.dependencies.getTransportType();
    if (!transportType) {
      throw transactionError(
        'TRANSPORT_UNAVAILABLE',
        'Firmware recovery has no active hardware transport',
      );
    }
    const currentVersions: IFirmwareDeviceVersions = {
      firmware: normalizeVersion(sdk.getDeviceFirmwareVersion(features)),
      ble: normalizeVersion(sdk.getDeviceBLEFirmwareVersion(features)),
      bootloader: normalizeVersion(sdk.getDeviceBootloaderVersion(features)),
    };
    return {
      originalConnectId,
      updatingConnectId:
        originalConnectId === undefined
          ? undefined
          : this.dependencies.resolveUpdatingConnectId({
              connectId: originalConnectId,
              transportType,
            }),
      stableDeviceId: journal.stableDeviceId,
      model,
      currentFirmwareType,
      firmwareType,
      currentVersions,
      isBootloaderMode:
        features.bootloaderMode === true || features.bootloader_mode === true,
      batteryLevel: normalizeBatteryLevel(features.battery_level),
      plan,
      latestFeatures: features,
    };
  }

  private restoreRecoveryAnalyticsContext({
    journal,
    context,
    transportType,
  }: {
    journal: IFirmwareUpdateJournalEnvelope;
    context: IFirmwareUpdateTransactionEligibilityContext;
    transportType: EHardwareTransportType | undefined;
  }) {
    this.analyticsContexts.set(journal.transactionId, {
      context: {
        deviceType: getAnalyticsDeviceType(context.model),
        transportType,
        updateFlow: getUpdateFlow(context.model),
        policyVersion: journal.rollout.policyVersion,
        cohortBucket: journal.rollout.cohortBucket,
      },
    });
  }

  private getRecoveryWaitingReason(
    error: unknown,
  ): 'awaiting_correct_device' | 'reconciliation_unavailable' {
    if (
      typeof error === 'object' &&
      error !== null &&
      'firmwareUpdateTransactionCode' in error &&
      error.firmwareUpdateTransactionCode === 'TRANSPORT_UNAVAILABLE'
    ) {
      return 'reconciliation_unavailable';
    }
    return 'awaiting_correct_device';
  }

  private async recoverTransaction({
    journal,
    expired,
  }: {
    journal: IFirmwareUpdateJournalEnvelope;
    expired: boolean;
  }): Promise<IFirmwareUpdateCoordinatorProjection | undefined> {
    const destructive =
      journal.pendingDestructiveAction !== undefined ||
      journal.lastCommittedCheckpoint?.destructiveActionStarted === true;
    if (expired && !destructive) {
      return this.coordinator.abandonExpiredPreparation(journal.transactionId);
    }
    let context: IFirmwareUpdateTransactionEligibilityContext | undefined;
    const requiresContextBeforeAcquisition =
      journal.phase === 'PLAN_CREATED' ||
      journal.phase === 'ELIGIBILITY_CHECKING';
    if (requiresContextBeforeAcquisition) {
      try {
        context = await this.createRecoveryContext(journal);
      } catch (error) {
        return this.coordinator.markRecoveryWaiting({
          sessionId: journal.transactionId,
          reason: this.getRecoveryWaitingReason(error),
          error,
        });
      }
    }
    if (journal.updatePlan) {
      return this.coordinator.resumePreparation({
        sessionId: journal.transactionId,
        ...(context ? { eligibilityContext: context } : {}),
      });
    }
    if (!journal.preparedPlan) {
      return this.coordinator.markRecoveryWaiting({
        sessionId: journal.transactionId,
        reason: 'reconciliation_unavailable',
        error: transactionError(
          'RECOVERY_PLAN_UNAVAILABLE',
          'Firmware recovery has neither UpdatePlan nor PreparedPlan',
        ),
      });
    }
    try {
      await this.coordinator.restorePreparedArtifacts(journal.transactionId);
    } catch (error) {
      return this.coordinator.markRecoveryWaiting({
        sessionId: journal.transactionId,
        reason: 'reconciliation_unavailable',
        error,
      });
    }
    if (journal.phase === 'PREPARED') {
      return this.coordinator.getProjection();
    }
    try {
      context = await this.createRecoveryContext(journal);
    } catch (error) {
      return this.coordinator.markRecoveryWaiting({
        sessionId: journal.transactionId,
        reason: this.getRecoveryWaitingReason(error),
        error,
      });
    }
    this.contexts.set(journal.transactionId, context);
    const transportType = await this.dependencies.getTransportType();
    this.restoreRecoveryAnalyticsContext({
      journal,
      context,
      transportType,
    });
    try {
      return await this.executeCoordinator({
        sessionId: journal.transactionId,
        eligibilityContext: context,
      });
    } catch {
      return this.coordinator.getProjection();
    }
  }

  private async validateFullResource(
    context: IFirmwareUpdateTransactionEligibilityContext,
  ) {
    if (await this.dependencies.getDevSetting('shouldUpdateFullRes')) {
      throw new UseDesktopToUpdateFirmware();
    }
    const targetVersion = getTargetVersion(context.plan, 'firmware');
    if (
      context.model === 'touch' &&
      !platformEnv.isDesktop &&
      hasTarget(context.plan, 'resource') &&
      semver.valid(context.currentVersions.firmware) &&
      targetVersion &&
      semver.valid(targetVersion) &&
      semver.lt(context.currentVersions.firmware, '3.5.0') &&
      semver.gte(targetVersion, '3.5.0')
    ) {
      throw new UseDesktopToUpdateFirmware();
    }
  }

  private async validateMinimumVersions(
    context: IFirmwareUpdateTransactionEligibilityContext,
  ) {
    if (await this.dependencies.getDevSetting('shouldUpdateFromWeb')) {
      throw new NeedFirmwareUpgradeFromWeb();
    }
    const minimums = FIRMWARE_UPDATE_MIN_VERSION_ALLOWED[context.model];
    if (!minimums) return;
    const assertMinimum = ({
      target,
      currentVersion,
      minimum,
    }: {
      target: 'firmware' | 'ble' | 'bootloader';
      currentVersion: string;
      minimum: string | undefined;
    }) => {
      if (
        hasTarget(context.plan, target) &&
        minimum &&
        semver.valid(currentVersion) &&
        semver.lt(currentVersion, minimum)
      ) {
        throw new NeedFirmwareUpgradeFromWeb();
      }
    };
    if (context.isBootloaderMode) {
      if (
        hasTarget(context.plan, 'bootloader') &&
        context.currentVersions.bootloader === '0.0.0'
      ) {
        throw new NeedFirmwareUpgradeFromWeb();
      }
      assertMinimum({
        target: 'bootloader',
        currentVersion: context.currentVersions.bootloader,
        minimum: minimums.bootloader,
      });
      return;
    }
    assertMinimum({
      target: 'firmware',
      currentVersion: context.currentVersions.firmware,
      minimum: minimums.firmware,
    });
    assertMinimum({
      target: 'ble',
      currentVersion: context.currentVersions.ble,
      minimum: minimums.ble,
    });
    if (
      !(await this.dependencies.getDevSetting(
        'updateDevDeviceBootloaderOnAppAllowed',
      ))
    ) {
      assertMinimum({
        target: 'bootloader',
        currentVersion: context.currentVersions.bootloader,
        minimum: minimums.bootloader ?? '2.0.0',
      });
    }
  }

  private async validateBridge(
    context: IFirmwareUpdateTransactionEligibilityContext,
  ) {
    const transportType = await this.dependencies.getTransportType();
    if (
      !platformEnv.isDesktop ||
      transportType !== EHardwareTransportType.Bridge ||
      !hasTarget(context.plan, 'firmware')
    ) {
      return;
    }
    const hardwareSdk = await this.dependencies.getHardwareSdk(
      context.updatingConnectId,
    );
    const result = await convertDeviceResponse(() =>
      hardwareSdk.checkBridgeRelease(context.updatingConnectId, {
        willUpdateFirmwareVersion: getTargetVersion(context.plan, 'firmware'),
      }),
    );
    if (
      result?.shouldUpdate ||
      (await this.dependencies.getDevSetting('shouldUpdateBridge'))
    ) {
      throw new NeedOneKeyBridgeUpgrade();
    }
  }

  private async validateBattery(
    context: IFirmwareUpdateTransactionEligibilityContext,
  ) {
    if (!platformEnv.isNative) return;
    const batteryLevel = (await this.dependencies.getDevSetting(
      'lowBatteryLevel',
    ))
      ? 1
      : context.batteryLevel;
    if (
      batteryLevel !== undefined &&
      batteryLevel <= FIRMWARE_UPDATE_MIN_BATTERY_LEVEL
    ) {
      throw new FirmwareUpdateBatteryTooLow();
    }
  }

  private async revalidateConnection(
    context: IFirmwareUpdateTransactionEligibilityContext,
  ) {
    const features = await this.dependencies.getFeatures(
      context.updatingConnectId,
    );
    context.latestFeatures = features;
    context.batteryLevel = normalizeBatteryLevel(features.battery_level);
  }

  private async revalidateIdentity(
    context: IFirmwareUpdateTransactionEligibilityContext,
  ) {
    const sdk = await CoreSDKLoader();
    const currentModel = normalizeModel(
      sdk.getDeviceType(context.latestFeatures),
    );
    const currentStableDeviceId =
      sdk.getDeviceUUID(context.latestFeatures) ||
      (context.originalConnectId
        ? await this.dependencies.getFallbackStableDeviceId(
            context.originalConnectId,
          )
        : undefined);
    if (
      currentModel !== context.model ||
      !currentStableDeviceId ||
      currentStableDeviceId !== context.stableDeviceId
    ) {
      throw transactionError(
        'DEVICE_IDENTITY_CHANGED',
        'Firmware transaction device identity changed before mutation',
      );
    }
  }

  private async executePreparedPlan({
    transactionId,
    preparedPlan,
    checkpoint,
    eligibilityContext,
  }: {
    transactionId: string;
    preparedPlan: IFirmwarePreparedPlan;
    checkpoint?: IFirmwareCheckpoint;
    eligibilityContext: IFirmwareUpdateTransactionEligibilityContext;
  }) {
    const execute = () =>
      this.executePreparedPlanWithSdk({
        transactionId,
        preparedPlan,
        ...(checkpoint ? { checkpoint } : {}),
        eligibilityContext,
      });
    if (this.dependencies.runHardwareMutation) {
      return this.dependencies.runHardwareMutation({
        originalConnectId: eligibilityContext.originalConnectId,
        execute,
      });
    }
    return execute();
  }

  private async executePreparedPlanWithSdk({
    transactionId,
    preparedPlan,
    checkpoint,
    eligibilityContext,
  }: {
    transactionId: string;
    preparedPlan: IFirmwarePreparedPlan;
    checkpoint?: IFirmwareCheckpoint;
    eligibilityContext: IFirmwareUpdateTransactionEligibilityContext;
  }) {
    const hardwareSdk = await this.dependencies.getHardwareSdk(
      eligibilityContext.updatingConnectId,
    );
    const common = {
      preparedPlan,
      ...(checkpoint ? { firmwareCheckpoint: checkpoint } : {}),
      firmwareTransactionId: transactionId,
      platform: platformEnv.symbol ?? 'web',
      firmwareType: preparedPlan.device.firmwareType as EFirmwareType,
    };
    if (eligibilityContext.model === 'pro2') {
      return convertDeviceResponse(() =>
        hardwareSdk.firmwareUpdateV4(
          eligibilityContext.updatingConnectId,
          common,
        ),
      );
    }
    if (
      eligibilityContext.model === 'touch' ||
      eligibilityContext.model === 'pro'
    ) {
      return convertDeviceResponse(() =>
        hardwareSdk.firmwareUpdateV3(
          eligibilityContext.updatingConnectId,
          common,
        ),
      );
    }
    const updateType = preparedPlan.artifactReceipts.every(
      (artifact) => artifact.target === 'ble',
    )
      ? 'ble'
      : 'firmware';
    return convertDeviceResponse(() =>
      hardwareSdk.firmwareUpdateV2(eligibilityContext.updatingConnectId, {
        ...common,
        updateType,
      }),
    );
  }

  private async executeCoordinator({
    sessionId,
    eligibilityContext,
  }: {
    sessionId: string;
    eligibilityContext: IFirmwareUpdateTransactionEligibilityContext;
  }) {
    const projection = await this.coordinator.execute({
      sessionId,
      eligibilityContext,
    });
    if (
      projection.phase === 'COMPLETED' &&
      this.dependencies.onTransactionCompleted
    ) {
      await this.dependencies
        .onTransactionCompleted({
          sessionId,
          originalConnectId: eligibilityContext.originalConnectId,
          currentFirmwareType: eligibilityContext.currentFirmwareType,
          firmwareType: eligibilityContext.firmwareType,
          expectedFinalStates: eligibilityContext.plan.expectedFinalStates,
        })
        .catch(() => undefined);
    }
    return projection;
  }

  private async cancelPreparedPlanExecution(sessionId: string) {
    const context = this.contexts.get(sessionId);
    if (!context) return;
    const hardwareSdk = await this.dependencies.getHardwareSdk(
      context.updatingConnectId,
    );
    await Promise.resolve(hardwareSdk.cancel(context.updatingConnectId));
  }
}

export const getFirmwareUpdateTransactionFailureCode = (
  error: unknown,
): string | undefined => {
  if (
    error instanceof OneKeyLocalError &&
    'firmwareUpdateTransactionCode' in error &&
    typeof error.firmwareUpdateTransactionCode === 'string'
  ) {
    return error.firmwareUpdateTransactionCode;
  }
  return undefined;
};
