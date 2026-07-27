import {
  EDeviceType,
  type EFirmwareType,
  HardwareErrorCode,
} from '@onekeyfe/hd-shared';
import { get, isArray, isNil } from 'lodash';
import semver from 'semver';

import {
  backgroundClass,
  backgroundMethod,
  backgroundMethodForDev,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { makeTimeoutPromise } from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  BridgeTimeoutError,
  FirmwareUpdateBatteryTooLow,
  FirmwareUpdateExit,
  FirmwareUpdateTasksClear,
  InitIframeLoadFail,
  InitIframeTimeout,
  NeedFirmwareUpgradeFromWeb,
  NeedOneKeyBridgeUpgrade,
  OneKeyLocalError,
  UseDesktopToUpdateFirmware,
} from '@onekeyhq/shared/src/errors';
import { FirmwareUpdateVersionMismatchError } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  convertDeviceResponse,
  isHardwareErrorByCode,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  CoreSDKLoader,
  isDirectFirmwareHostBindingTransport,
} from '@onekeyhq/shared/src/hardware/instance';
import { importHardwareSDK } from '@onekeyhq/shared/src/hardware/sdk-loader';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { parseFirmwareVersions } from '@onekeyhq/shared/src/logger/scopes/update/scenes/firmware';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IFirmwareUpdateRolloutPlatform } from '@onekeyhq/shared/src/request/types/ipTable';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import type {
  IAllDeviceVerifyVersions,
  IBleFirmwareReleasePayload,
  IBleFirmwareUpdateInfo,
  IBootloaderReleasePayload,
  IBootloaderUpdateInfo,
  ICheckAllFirmwareReleaseResult,
  IDeviceFirmwareType,
  IFirmwareChangeLog,
  IFirmwareReleasePayload,
  IFirmwareUpdateInfo,
  IFirmwareUpdateV3VersionParams,
  IHardwareBridgeReleasePayload,
  IOneKeyDeviceFeatures,
  IResourceUpdateInfo,
} from '@onekeyhq/shared/types/device';
import {
  EHardwareCallContext,
  EOneKeyDeviceMode,
} from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import {
  EFirmwareUpdateSteps,
  EHardwareUiStateAction,
  firmwareUpdateResultVerifyAtom,
  firmwareUpdateRetryAtom,
  firmwareUpdateStepInfoAtom,
  firmwareUpdateWorkflowRunningAtom,
  hardwareUiStateAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';
import serviceHardwareUtils from '../ServiceHardware/serviceHardwareUtils';

import {
  type IBridgeFirmwareBinaries,
  type IFirmwareArtifactReference,
  type IPreparedFirmwareArtifacts,
  cancelFirmwareArtifactPreparations,
  getBridgeFirmwareV3BinaryParams,
  getBridgeFirmwareV4BinaryParams,
  isExternalFirmwareCapabilityReady,
  isFirmwareArtifactCapabilityReady,
  prepareBridgeFirmwareBinaries,
  prepareFirmwareArtifacts,
  restoreFirmwareUpdatePlanFromPrepared,
  restorePreparedFirmwareArtifacts,
} from './FirmwareArtifactPreflight';
import {
  type IFirmwareArtifactSelfTestPhase,
  type IFirmwareArtifactSelfTestProgress,
  type IFirmwareArtifactSelfTestResult,
  type IFirmwareArtifactSelfTestScenario,
  type IFirmwareArtifactSelfTestState,
  executeFirmwareArtifactSelfTest,
  getFirmwareArtifactSelfTestArtifact,
  getFirmwareArtifactSelfTestErrorCode,
  getFirmwareArtifactSelfTestPlatform,
} from './FirmwareArtifactSelfTest';
import {
  FIRMWARE_ONBOARDING_MAX_VERSIONS_BEHIND,
  FIRMWARE_UPDATE_MIN_BATTERY_LEVEL,
  FIRMWARE_UPDATE_MIN_VERSION_ALLOWED,
} from './firmwareUpdateConsts';
import { FirmwareUpdateDetectMap } from './FirmwareUpdateDetectMap';
import {
  type IFirmwareUpdateJournalEnvelope,
  firmwareUpdateJournal,
} from './FirmwareUpdateJournal';
import { evaluateFirmwareUpdateRollout } from './FirmwareUpdateRolloutPolicy';
import { getTrustedFirmwareConfig } from './trustedFirmwareCatalog';

import type { IDBDevice } from '../../dbs/local/types';
import type {
  IPromiseContainerCallbackCreate,
  IPromiseContainerReject,
  IPromiseContainerResolve,
} from '../ServicePromise';
import type {
  AllFirmwareRelease,
  CoreApi,
  Success as CoreSuccess,
  DeviceUploadResourceParams,
  Features,
  FirmwareCheckpoint,
  FirmwareCheckpointSink,
  FirmwareUpdatePlan,
  FirmwareUpdatePlanTarget,
  FirmwareUpdatePreparedPlan,
  FirmwareUpdateV4Target,
  IDeviceType,
  IVersionArray,
} from '@onekeyfe/hd-core';
import type { Success } from '@onekeyfe/hd-transport';

export type IAutoUpdateFirmwareParams = {
  connectId: string | undefined;
  version: string;
  firmwareType: IDeviceFirmwareType;
  deviceType: IDeviceType | undefined;
};

export type IUpdateFirmwareWorkflowParams = {
  backuped: boolean;
  usbConnected: boolean;
  releaseResult: ICheckAllFirmwareReleaseResult;
};

export type IStartUpdateWorkflowV2Result = {
  backgroundTaskStarted: true;
};

export type IUpdateFirmwareTaskFn = ({
  id,
}: {
  id: number;
}) => Promise<Success | undefined>; // return Success | undefined go to next task, throw error to retry

type IUpdateFirmwareTask = {
  fn: IUpdateFirmwareTaskFn;
  workflowId: number | undefined;
};

interface IFirmwareUpdateResult {
  bleVersion?: string;
  firmwareVersion?: string;
  bootloaderVersion?: string;
}

type IFirmwareUpdateV4AppParams = IFirmwareUpdateV3VersionParams & {
  targetsToUpdate: FirmwareUpdateV4Target[];
};

type IFirmwareExecutionBindingParams = {
  hostBindingGeneration: number;
  checkpointSequenceStart: number;
  resumeCheckpoint?: FirmwareCheckpoint;
};

type IFirmwareWorkflowArtifacts =
  | IPreparedFirmwareArtifacts
  | IBridgeFirmwareBinaries;

const getPreparedFirmwareArtifacts = (
  artifacts: IFirmwareWorkflowArtifacts | undefined,
): IPreparedFirmwareArtifacts | undefined =>
  artifacts && 'preparedPlan' in artifacts ? artifacts : undefined;

const getBridgeFirmwareBinaries = (
  artifacts: IFirmwareWorkflowArtifacts | undefined,
): IBridgeFirmwareBinaries | undefined =>
  artifacts && 'targetBinaries' in artifacts ? artifacts : undefined;

type IFirmwareCheckpointBinding = {
  checkpointSequenceStart: number;
  checkpointSink: FirmwareCheckpointSink;
  resumeCheckpoint?: FirmwareCheckpoint;
  hostBinding?: {
    sdk: CoreApi;
    generation: number;
  };
};

const FIRMWARE_UPDATE_V4_TARGETS = new Set<FirmwareUpdateV4Target>([
  'boot',
  'app_v1',
  'app_v2',
  'coprocessor',
  'resource',
  'se01',
  'se02',
  'se03',
  'se04',
]);

@backgroundClass()
class ServiceFirmwareUpdate extends ServiceBase {
  private firmwareUpdatePlans = new Map<string, FirmwareUpdatePlan>();

  private firmwareRecoveryPromise?: Promise<void>;

  private firmwareCheckpointBindings = new Map<
    string,
    IFirmwareCheckpointBinding
  >();

  private firmwareArtifactSelfTestState?: IFirmwareArtifactSelfTestState;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private updateFirmwareArtifactSelfTestState({
    phase,
    progress,
    bytesRead,
    chunkCount,
    materializedEntryCount,
  }: IFirmwareArtifactSelfTestProgress): void {
    const current = this.firmwareArtifactSelfTestState;
    if (!current || current.status !== 'running') return;
    const now = Date.now();
    const next = {
      ...current,
      phase,
      progress,
      updatedAt: now,
      bytesRead: bytesRead ?? current.bytesRead,
      chunkCount: chunkCount ?? current.chunkCount,
      materializedEntryCount:
        materializedEntryCount ?? current.materializedEntryCount,
    };
    this.firmwareArtifactSelfTestState = next;
    const enteredNewPhase = phase !== current.phase;
    const enteredNewProgressBucket =
      Math.floor(progress / 5) !== Math.floor(current.progress / 5);
    if (enteredNewPhase || enteredNewProgressBucket) {
      this.logFirmwareArtifactSelfTest({
        state: next,
        outcome: 'progress',
      });
    }
  }

  private logFirmwareArtifactSelfTest({
    state,
    outcome,
  }: {
    state: IFirmwareArtifactSelfTestState;
    outcome: 'started' | 'progress' | 'success' | 'failure' | 'cancelled';
  }): void {
    defaultLogger.update.firmware.firmwareArtifactSelfTest({
      runId: state.runId,
      runtime: 'bg',
      platform: state.platform,
      scenario: state.descriptor.scenario,
      phase: state.phase,
      outcome,
      durationMs: Date.now() - state.startedAt,
      bytes: state.bytesRead || undefined,
      chunkCount: state.chunkCount || undefined,
      materializedEntryCount: state.materializedEntryCount || undefined,
      sdkEntryValidated: state.sdkEntryValidated || undefined,
      sdkIntegrityRejected: state.sdkIntegrityRejected || undefined,
      sdkBindingReleased: state.sdkBindingReleased || undefined,
      sdkBoundaryCode: state.sdkBoundaryCode,
      errorCode: state.errorCode,
    });
  }

  private async getFirmwareArtifactSelfTestSdk(): Promise<{
    sdk: CoreApi;
    disposeAfterTest: boolean;
  }> {
    if (!platformEnv.isDesktop) {
      return {
        sdk: await this.getSDKInstance({ connectId: undefined }),
        disposeAfterTest: false,
      };
    }
    const transportType =
      await this.backgroundApi.serviceSetting.getHardwareTransportType();
    if (isDirectFirmwareHostBindingTransport(transportType)) {
      return {
        sdk: await this.getSDKInstance({ connectId: undefined }),
        disposeAfterTest: false,
      };
    }
    const sdk = await importHardwareSDK({
      hardwareTransportType: EHardwareTransportType.WEBUSB,
    });
    const initialized = await sdk.init({
      debug: false,
      env: 'desktop-webusb',
      fetchConfig: false,
      firmwareManifestMode: 'external-only',
      preloadedConfig: getTrustedFirmwareConfig({ preRelease: false }),
    });
    if (!initialized) {
      throw new OneKeyLocalError(
        'Firmware SDK self-test direct instance failed to initialize',
      );
    }
    return { sdk, disposeAfterTest: true };
  }

  private finishFirmwareArtifactSelfTest({
    phase,
    status,
    result,
    errorCode,
  }: {
    phase: Extract<
      IFirmwareArtifactSelfTestPhase,
      'completed' | 'failed' | 'cancelled'
    >;
    status: Extract<
      IFirmwareArtifactSelfTestState['status'],
      'completed' | 'failed' | 'cancelled'
    >;
    result?: IFirmwareArtifactSelfTestResult;
    errorCode?: string;
  }): void {
    const current = this.firmwareArtifactSelfTestState;
    if (!current) return;
    const completedAt = Date.now();
    const next = {
      ...current,
      phase,
      status,
      progress: status === 'completed' ? 100 : current.progress,
      updatedAt: completedAt,
      completedAt,
      bytesRead: result?.bytesRead ?? current.bytesRead,
      chunkCount: result?.chunkCount ?? current.chunkCount,
      materializedEntryCount:
        result?.materializedEntryCount ?? current.materializedEntryCount,
      sdkEntryValidated: result?.sdkEntryValidated ?? current.sdkEntryValidated,
      sdkIntegrityRejected:
        result?.sdkIntegrityRejected ?? current.sdkIntegrityRejected,
      sdkBindingReleased:
        result?.sdkBindingReleased ?? current.sdkBindingReleased,
      sdkBoundaryCode: result?.sdkBoundaryCode ?? current.sdkBoundaryCode,
      deletedFiles: result?.deletedFiles ?? current.deletedFiles,
      deletedBytes: result?.deletedBytes ?? current.deletedBytes,
      errorCode,
    };
    this.firmwareArtifactSelfTestState = next;
    let outcome: 'success' | 'failure' | 'cancelled' = 'failure';
    if (status === 'completed') {
      outcome = 'success';
    } else if (status === 'cancelled') {
      outcome = 'cancelled';
    }
    this.logFirmwareArtifactSelfTest({
      state: next,
      outcome,
    });
  }

  @backgroundMethodForDev()
  async startFirmwareArtifactSelfTest({
    scenario,
  }: {
    scenario: IFirmwareArtifactSelfTestScenario;
  }): Promise<IFirmwareArtifactSelfTestState> {
    if (this.firmwareArtifactSelfTestState?.status === 'running') {
      throw new OneKeyLocalError(
        'Another firmware artifact self-test is already running',
      );
    }
    const runId = generateUUID();
    const transactionId = `fwtx:${runId}`;
    const now = Date.now();
    const state: IFirmwareArtifactSelfTestState = {
      runId,
      descriptor: getFirmwareArtifactSelfTestArtifact(scenario).descriptor,
      platform: getFirmwareArtifactSelfTestPlatform(),
      status: 'running',
      phase: 'starting',
      progress: 0,
      startedAt: now,
      updatedAt: now,
      bytesRead: 0,
      chunkCount: 0,
      materializedEntryCount: 0,
      sdkEntryValidated: false,
      sdkIntegrityRejected: false,
      sdkBindingReleased: false,
      deletedFiles: 0,
      deletedBytes: 0,
    };
    this.firmwareArtifactSelfTestState = state;
    this.logFirmwareArtifactSelfTest({ state, outcome: 'started' });
    void this.getFirmwareArtifactSelfTestSdk()
      .then(async ({ sdk, disposeAfterTest }) => {
        try {
          return await executeFirmwareArtifactSelfTest({
            scenario,
            transactionId,
            sdk,
            onProgress: (next) =>
              this.updateFirmwareArtifactSelfTestState(next),
          });
        } finally {
          if (disposeAfterTest) {
            await sdk.dispose();
          }
        }
      })
      .then((result) => {
        this.finishFirmwareArtifactSelfTest({
          phase: 'completed',
          status: 'completed',
          result,
        });
      })
      .catch((error) => {
        const errorCode = getFirmwareArtifactSelfTestErrorCode(error);
        const cancelled = errorCode === 'ARTIFACT_CANCELLED';
        this.finishFirmwareArtifactSelfTest({
          phase: cancelled ? 'cancelled' : 'failed',
          status: cancelled ? 'cancelled' : 'failed',
          errorCode,
        });
      });
    return state;
  }

  @backgroundMethodForDev()
  async getFirmwareArtifactSelfTestState(): Promise<
    IFirmwareArtifactSelfTestState | undefined
  > {
    return this.firmwareArtifactSelfTestState;
  }

  async getSDKInstance({
    connectId,
  }: {
    connectId: string | undefined;
  }): Promise<CoreApi> {
    const hardwareSDK = await this.backgroundApi.serviceHardware.getSDKInstance(
      {
        connectId,
      },
    );
    return hardwareSDK;
  }

  private async evaluateExternalFirmwareRollout(plan: FirmwareUpdatePlan) {
    const appPlatform = platformEnv.appPlatform;
    if (
      appPlatform !== 'ios' &&
      appPlatform !== 'android' &&
      appPlatform !== 'desktop'
    ) {
      throw new OneKeyLocalError(
        'External firmware rollout is unavailable on this platform',
      );
    }
    const [configWithRuntime, installationKey] = await Promise.all([
      this.backgroundApi.simpleDb.ipTable.getConfig(),
      this.backgroundApi.serviceSetting.getInstanceId(),
    ]);
    return evaluateFirmwareUpdateRollout({
      configWithRuntime,
      installationKey,
      platform: appPlatform as IFirmwareUpdateRolloutPlatform,
      deviceType: plan.deviceModel,
      appVersion: platformEnv.version ?? '',
    });
  }

  private async getExternalFirmwareSdk(
    connectId: string | undefined,
  ): Promise<CoreApi | undefined> {
    if (!(await isFirmwareArtifactCapabilityReady())) {
      return undefined;
    }
    if (platformEnv.isDesktop) {
      const transportType =
        await this.backgroundApi.serviceSetting.getHardwareTransportType();
      if (!isDirectFirmwareHostBindingTransport(transportType)) {
        return undefined;
      }
    }
    const sdk = await this.getSDKInstance({ connectId });
    try {
      return isExternalFirmwareCapabilityReady(
        sdk.getFirmwareUpdateCapabilities?.(),
      ) &&
        typeof sdk.prepareFirmwareUpdatePlan === 'function' &&
        typeof sdk.validateFirmwareUpdatePreparedPlan === 'function' &&
        typeof sdk.registerFirmwareUpdateHostBinding === 'function' &&
        typeof sdk.unregisterFirmwareUpdateHostBinding === 'function'
        ? sdk
        : undefined;
    } catch {
      return undefined;
    }
  }

  async resumeActiveFirmwareTransaction(): Promise<void> {
    if (this.firmwareRecoveryPromise) {
      return this.firmwareRecoveryPromise;
    }
    const recovery = this.resumeActiveFirmwareTransactionInternal().finally(
      () => {
        if (this.firmwareRecoveryPromise === recovery) {
          this.firmwareRecoveryPromise = undefined;
        }
      },
    );
    this.firmwareRecoveryPromise = recovery;
    return recovery;
  }

  private async resumeActiveFirmwareTransactionInternal(): Promise<void> {
    if (!platformEnv.isNative && !platformEnv.isDesktop) return;
    const journal = await firmwareUpdateJournal.read();
    if (
      !journal ||
      ['COMPLETED', 'FAILED', 'ABANDONED'].includes(journal.phase)
    ) {
      return;
    }
    if (journal.phase === 'EXECUTING') {
      return;
    }

    if (journal.phase === 'PREPARING') {
      return;
    }
    if (
      !journal.prepared ||
      (!journal.destructiveStarted && !journal.executionStarted)
    ) {
      return;
    }

    const device = await this.resolveFirmwareRecoveryDevice(journal);
    if (!device) {
      await firmwareUpdateJournal.markRecoveryWaiting(
        journal.transactionId,
        'awaiting_correct_device',
      );
      return;
    }
    const sdk = await this.getExternalFirmwareSdk(device.connectId);
    if (!sdk) {
      await firmwareUpdateJournal.markRecoveryWaiting(
        journal.transactionId,
        'recovery_unsupported',
      );
      return;
    }
    let plan: FirmwareUpdatePlan;
    try {
      plan = restoreFirmwareUpdatePlanFromPrepared(
        sdk.validateFirmwareUpdatePreparedPlan(journal.prepared),
      );
    } catch {
      await firmwareUpdateJournal.markRecoveryWaiting(
        journal.transactionId,
        'recovery_unsupported',
      );
      return;
    }

    const features = await this.readFirmwareRecoveryFeatures(
      device.connectId,
    ).catch(() => undefined);
    if (!features) {
      await firmwareUpdateJournal.markRecoveryWaiting(
        journal.transactionId,
        'reconciliation_unavailable',
      );
      return;
    }
    if (
      !(await this.isFirmwareRecoveryDeviceMatch({
        stableDeviceId: journal.stableDeviceId,
        deviceModel: journal.deviceModel,
        features,
        persistedDevice: device.dbDevice,
      }))
    ) {
      await firmwareUpdateJournal.markRecoveryWaiting(
        journal.transactionId,
        'awaiting_correct_device',
      );
      return;
    }

    try {
      const prepared = await restorePreparedFirmwareArtifacts({
        plan,
        transactionId: journal.transactionId,
        leaseRef: journal.leaseRef,
        prepared: journal.prepared,
        preparePlan: sdk.prepareFirmwareUpdatePlan,
        validatePreparedPlan: sdk.validateFirmwareUpdatePreparedPlan,
      });
      this.cacheFirmwareUpdatePlan(plan);
      this.bindFirmwareCheckpoint(
        journal.transactionId,
        journal.sdkCheckpoint?.sequence ?? 0,
        journal.sdkCheckpoint,
      );
      this.bindFirmwareHostBinding(journal.transactionId, prepared, sdk);
      await firmwareUpdateJournal.markExecuting(journal.transactionId);
      await this.executePreparedFirmwareRecovery({
        connectId: device.connectId,
        plan,
        prepared,
      });
      if (plan.executor === 'v2') {
        await this.verifyFirmwareRecoveryResult({
          connectId: device.connectId,
          plan,
          persistedDevice: device.dbDevice,
        });
      }
      await firmwareUpdateJournal.markCompleted(journal.transactionId);
      this.releaseFirmwareHostBinding(journal.transactionId);
      this.firmwareCheckpointBindings.delete(journal.transactionId);
    } catch (error) {
      this.releaseFirmwareHostBinding(journal.transactionId);
      await firmwareUpdateJournal.markFailure(journal.transactionId, error);
    }
  }

  private async resolveFirmwareRecoveryDevice(
    journal: IFirmwareUpdateJournalEnvelope,
  ): Promise<
    { connectId: string | undefined; dbDevice?: IDBDevice } | undefined
  > {
    const { devices } = await localDb.getAllDevices();
    const dbDevice = devices.find(
      (candidate) => candidate.uuid === journal.stableDeviceId,
    );
    if (platformEnv.isNative && !dbDevice) return undefined;
    const currentTransportType =
      await this.backgroundApi.serviceSetting.getHardwareTransportType();
    const updatingConnectId = deviceUtils.getUpdatingConnectId({
      connectId: dbDevice?.connectId,
      currentTransportType,
    });
    return {
      connectId: deviceUtils.getFixedUpdatingConnectId({
        updatingConnectId,
        currentTransportType,
        device: dbDevice,
      }),
      ...(dbDevice ? { dbDevice } : {}),
    };
  }

  private readFirmwareRecoveryFeatures(connectId: string | undefined) {
    return this.backgroundApi.serviceHardware.getFeaturesWithoutCache({
      connectId,
      silentMode: true,
      params: { allowEmptyConnectId: true },
      hardwareCallContext: EHardwareCallContext.SILENT_CALL,
    }) as Promise<IOneKeyDeviceFeatures>;
  }

  private async isFirmwareRecoveryDeviceMatch({
    stableDeviceId,
    deviceModel,
    features,
    persistedDevice,
  }: {
    stableDeviceId: string;
    deviceModel: string;
    features: IOneKeyDeviceFeatures;
    persistedDevice?: IDBDevice;
  }): Promise<boolean> {
    const { getDeviceType, getDeviceUUID } = await CoreSDKLoader();
    const observedIdentity = getDeviceUUID(features as Features);
    const identityMatches =
      observedIdentity === stableDeviceId ||
      (!observedIdentity && persistedDevice?.uuid === stableDeviceId);
    return (
      identityMatches &&
      String(getDeviceType(features as Features)) === deviceModel
    );
  }

  private getFirmwarePlanTargetVersion(
    plan: FirmwareUpdatePlan,
    target: FirmwareUpdatePlanTarget,
  ): string | undefined {
    return plan.artifacts.find((artifact) => artifact.target === target)
      ?.targetVersion;
  }

  private async executePreparedFirmwareRecovery({
    connectId,
    plan,
    prepared,
  }: {
    connectId: string | undefined;
    plan: FirmwareUpdatePlan;
    prepared: IPreparedFirmwareArtifacts;
  }): Promise<void> {
    if (plan.executor === 'v4') {
      const targetsToUpdate = plan.targetsToUpdate.filter(
        (target): target is FirmwareUpdateV4Target =>
          FIRMWARE_UPDATE_V4_TARGETS.has(target as FirmwareUpdateV4Target),
      );
      if (targetsToUpdate.length !== plan.targetsToUpdate.length) {
        throw new OneKeyLocalError(
          'Protocol V2 firmware recovery target is invalid',
        );
      }
      await this.updatingFirmwareV4(
        {
          connectId,
          firmwareType: plan.firmwareType,
          firmwareVersion: undefined,
          bleVersion: undefined,
          bootloaderVersion: undefined,
          targetsToUpdate,
        },
        prepared,
      );
      return;
    }
    if (plan.executor === 'v3') {
      await this.updatingFirmwareV3(
        {
          connectId,
          firmwareType: plan.firmwareType,
          firmwareVersion: this.getFirmwarePlanTargetVersion(plan, 'firmware'),
          bleVersion: this.getFirmwarePlanTargetVersion(plan, 'ble'),
          bootloaderVersion: this.getFirmwarePlanTargetVersion(
            plan,
            'bootloader',
          ),
        },
        prepared,
      );
      return;
    }
    await this.executePreparedFirmwareV2Recovery({
      connectId,
      plan,
      prepared,
    });
  }

  private async executePreparedFirmwareV2Recovery({
    connectId,
    plan,
    prepared,
  }: {
    connectId: string | undefined;
    plan: FirmwareUpdatePlan;
    prepared: IPreparedFirmwareArtifacts;
  }): Promise<void> {
    const legacyEpochs = plan.epochs.filter(
      (epoch) => epoch.kind === 'legacy-update',
    );
    if (plan.executor !== 'v2' || legacyEpochs.length !== 1) {
      throw new OneKeyLocalError(
        'Firmware recovery plan has no unique V2 execution epoch',
      );
    }
    const artifactsById = new Map(
      plan.artifacts.map((artifact) => [artifact.artifactId, artifact]),
    );
    const operations: Array<'bootloader' | 'firmware' | 'ble'> = [];
    for (const artifactId of legacyEpochs[0].artifactIds) {
      const artifact = artifactsById.get(artifactId);
      if (!artifact) {
        throw new OneKeyLocalError(
          'Firmware recovery epoch references an unknown artifact',
        );
      }
      const target =
        artifact.target === 'resource' ? 'firmware' : artifact.target;
      if (
        target !== 'bootloader' &&
        target !== 'firmware' &&
        target !== 'ble'
      ) {
        throw new OneKeyLocalError(
          'Firmware recovery epoch contains an incompatible target',
        );
      }
      if (!operations.includes(target)) {
        operations.push(target);
      }
    }
    const plannedOperations = [
      ...new Set(
        plan.targetsToUpdate.map((target) =>
          target === 'resource' ? 'firmware' : target,
        ),
      ),
    ];
    if (
      operations.length !== plannedOperations.length ||
      operations.some((target) => !plannedOperations.includes(target))
    ) {
      throw new OneKeyLocalError(
        'Firmware recovery epoch does not cover the planned targets',
      );
    }
    const resumeCheckpoint =
      this.getFirmwareCheckpointParams(prepared).resumeCheckpoint;
    const resumeTarget =
      resumeCheckpoint?.target === 'resource'
        ? 'firmware'
        : resumeCheckpoint?.target;
    let startIndex = 0;
    if (resumeTarget) {
      const matchedIndex = operations.findIndex(
        (target) => target === resumeTarget,
      );
      if (matchedIndex < 0) {
        throw new OneKeyLocalError(
          'Firmware recovery checkpoint does not match the plan',
        );
      }
      startIndex =
        resumeCheckpoint?.stage === 'FINAL_VERIFIED'
          ? matchedIndex + 1
          : matchedIndex;
    }
    const hardwareSDK = await this.getSDKInstance({ connectId });
    for (const target of operations.slice(startIndex)) {
      const checkpointParams = this.getFirmwareCheckpointParams(prepared);
      if (target === 'bootloader') {
        const artifact = prepared.selected.bootloader;
        if (!artifact) {
          throw new OneKeyLocalError(
            'Prepared bootloader artifact is unavailable',
          );
        }
        if (
          plan.deviceModel === String(EDeviceType.Touch) ||
          plan.deviceModel === String(EDeviceType.Pro)
        ) {
          await convertDeviceResponse(() =>
            (
              hardwareSDK.deviceUpdateBootloader as unknown as (
                id: string | undefined,
                params: {
                  preparedPlan: FirmwareUpdatePreparedPlan;
                  artifact: IFirmwareArtifactReference;
                  hostBindingGeneration: number;
                  checkpointSequenceStart: number;
                  resumeCheckpoint?: FirmwareCheckpoint;
                },
              ) => ReturnType<CoreApi['deviceUpdateBootloader']>
            )(connectId, {
              preparedPlan: prepared.preparedPlan,
              artifact,
              ...checkpointParams,
            }),
          );
        } else {
          await convertDeviceResponse(() =>
            (
              hardwareSDK.firmwareUpdateV2 as unknown as (
                id: string | undefined,
                params: {
                  preparedPlan: FirmwareUpdatePreparedPlan;
                  updateType: 'firmware';
                  isUpdateBootloader: true;
                  platform: string;
                  artifact: IFirmwareArtifactReference;
                  hostBindingGeneration: number;
                  checkpointSequenceStart: number;
                  resumeCheckpoint?: FirmwareCheckpoint;
                },
              ) => ReturnType<CoreApi['firmwareUpdateV2']>
            )(connectId, {
              preparedPlan: prepared.preparedPlan,
              updateType: 'firmware',
              isUpdateBootloader: true,
              platform: platformEnv.symbol ?? 'web',
              artifact,
              ...checkpointParams,
            }),
          );
        }
      } else {
        const artifact =
          target === 'firmware'
            ? prepared.selected.firmware
            : prepared.selected.ble;
        if (!artifact) {
          throw new OneKeyLocalError(
            `Prepared ${target} artifact is unavailable`,
          );
        }
        await convertDeviceResponse(() =>
          (
            hardwareSDK.firmwareUpdateV2 as unknown as (
              id: string | undefined,
              params: {
                preparedPlan: FirmwareUpdatePreparedPlan;
                updateType: 'firmware' | 'ble';
                forcedUpdateRes: boolean;
                platform: string;
                firmwareType: EFirmwareType;
                artifact: IFirmwareArtifactReference;
                resourceEntries?: readonly {
                  entryName: string;
                  artifact: IFirmwareArtifactReference;
                }[];
                hostBindingGeneration: number;
                checkpointSequenceStart: number;
                resumeCheckpoint?: FirmwareCheckpoint;
              },
            ) => ReturnType<CoreApi['firmwareUpdateV2']>
          )(connectId, {
            preparedPlan: prepared.preparedPlan,
            updateType: target,
            forcedUpdateRes:
              target === 'firmware' &&
              Boolean(prepared.selected.resourceEntries?.length),
            platform: platformEnv.symbol ?? 'web',
            firmwareType: plan.firmwareType,
            artifact,
            ...(target === 'firmware' && prepared.selected.resourceEntries
              ? { resourceEntries: prepared.selected.resourceEntries }
              : {}),
            ...checkpointParams,
          }),
        );
      }
    }
  }

  private async verifyFirmwareRecoveryResult({
    connectId,
    plan,
    persistedDevice,
  }: {
    connectId: string | undefined;
    plan: FirmwareUpdatePlan;
    persistedDevice?: IDBDevice;
  }): Promise<void> {
    let features: IOneKeyDeviceFeatures | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidate = await this.readFirmwareRecoveryFeatures(
        connectId,
      ).catch(() => undefined);
      if (
        candidate &&
        (await this.isFirmwareRecoveryDeviceMatch({
          stableDeviceId: plan.deviceIdentity,
          deviceModel: plan.deviceModel,
          features: candidate,
          persistedDevice,
        }))
      ) {
        features = candidate;
        break;
      }
      await timerUtils.wait(1500);
    }
    if (!features) {
      throw new OneKeyLocalError(
        'Firmware recovery final device state is unavailable',
      );
    }
    const {
      getDeviceBLEFirmwareVersion,
      getDeviceBootloaderVersion,
      getDeviceFirmwareVersion,
      getFirmwareType,
    } = await CoreSDKLoader();
    const observedVersions: Partial<Record<FirmwareUpdatePlanTarget, string>> =
      {
        firmware: getDeviceFirmwareVersion(features as Features).join('.'),
        ble: getDeviceBLEFirmwareVersion(features as Features).join('.'),
        bootloader: getDeviceBootloaderVersion(features as Features).join('.'),
      };
    for (const target of ['firmware', 'ble', 'bootloader'] as const) {
      const expected = this.getFirmwarePlanTargetVersion(plan, target);
      if (expected && observedVersions[target] !== expected) {
        throw new OneKeyLocalError(
          `Firmware recovery final ${target} version is not verified`,
        );
      }
    }
    if (
      plan.targetsToUpdate.includes('firmware') &&
      getFirmwareType(features as Features) !== plan.firmwareType
    ) {
      throw new OneKeyLocalError(
        'Firmware recovery final firmware type is not verified',
      );
    }
  }

  async prepareExternalFirmwareArtifacts(
    releaseResult: ICheckAllFirmwareReleaseResult,
    confirmations: {
      backuped: boolean;
      usbConnected: boolean;
    },
  ): Promise<IPreparedFirmwareArtifacts | undefined> {
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      return undefined;
    }
    if (!releaseResult.firmwareUpdatePlanDigest) {
      return undefined;
    }
    const plan = this.getFirmwareUpdatePlan(releaseResult);
    const sdk = await this.getExternalFirmwareSdk(
      releaseResult.updatingConnectId,
    );
    const current = await firmwareUpdateJournal.read();
    const currentTransactionOwnsPlan =
      current?.planDigest === plan.planDigest &&
      !['COMPLETED', 'FAILED', 'ABANDONED'].includes(current.phase);
    if (!sdk) {
      if (currentTransactionOwnsPlan) {
        throw new OneKeyLocalError(
          'Active firmware transaction recovery is unsupported by this SDK',
        );
      }
      return undefined;
    }
    const rollout =
      currentTransactionOwnsPlan && current
        ? undefined
        : await this.evaluateExternalFirmwareRollout(plan);
    const journal = await firmwareUpdateJournal.begin({
      plan,
      ...confirmations,
      rollout,
    });
    if (!journal) return undefined;
    try {
      if (journal.prepared) {
        const prepared = await restorePreparedFirmwareArtifacts({
          plan,
          transactionId: journal.transactionId,
          leaseRef: journal.leaseRef,
          prepared: journal.prepared,
          preparePlan: sdk.prepareFirmwareUpdatePlan,
          validatePreparedPlan: sdk.validateFirmwareUpdatePreparedPlan,
        });
        this.bindFirmwareCheckpoint(
          journal.transactionId,
          journal.checkpointSequenceStart,
          journal.resumeCheckpoint,
        );
        this.bindFirmwareHostBinding(journal.transactionId, prepared, sdk);
        return prepared;
      }
      const prepared = await prepareFirmwareArtifacts(plan, {
        transactionId: journal.transactionId,
        leaseRef: journal.leaseRef,
        preparePlan: sdk.prepareFirmwareUpdatePlan,
      });
      await firmwareUpdateJournal.markPrepared(journal.transactionId, prepared);
      this.bindFirmwareCheckpoint(
        journal.transactionId,
        journal.checkpointSequenceStart,
        journal.resumeCheckpoint,
      );
      this.bindFirmwareHostBinding(journal.transactionId, prepared, sdk);
      return prepared;
    } catch (error) {
      this.releaseFirmwareHostBinding(journal.transactionId);
      await firmwareUpdateJournal.markFailure(journal.transactionId, error);
      throw error;
    }
  }

  private async prepareFirmwareWorkflowArtifacts(
    releaseResult: ICheckAllFirmwareReleaseResult,
    confirmations: {
      backuped: boolean;
      usbConnected: boolean;
    },
  ): Promise<IFirmwareWorkflowArtifacts | undefined> {
    const prepared = await this.prepareExternalFirmwareArtifacts(
      releaseResult,
      confirmations,
    );
    if (prepared || !platformEnv.isDesktop) return prepared;
    const transportType =
      await this.backgroundApi.serviceSetting.getHardwareTransportType();
    if (transportType !== EHardwareTransportType.Bridge) return undefined;
    return prepareBridgeFirmwareBinaries(
      this.getFirmwareUpdatePlan(releaseResult),
    );
  }

  private bindFirmwareCheckpoint(
    transactionId: string,
    checkpointSequenceStart: number,
    resumeCheckpoint?: FirmwareCheckpoint,
  ) {
    const existing = this.firmwareCheckpointBindings.get(transactionId);
    if (existing) {
      if (!resumeCheckpoint) return existing;
      const resumed = {
        ...existing,
        checkpointSequenceStart,
        resumeCheckpoint,
      };
      this.firmwareCheckpointBindings.set(transactionId, resumed);
      return resumed;
    }
    const binding = {
      checkpointSequenceStart,
      ...(resumeCheckpoint ? { resumeCheckpoint } : {}),
      checkpointSink: {
        commit: (checkpoint) =>
          firmwareUpdateJournal.commitSdkCheckpoint(transactionId, checkpoint),
      },
    } satisfies IFirmwareCheckpointBinding;
    this.firmwareCheckpointBindings.set(transactionId, binding);
    return binding;
  }

  private getFirmwareCheckpointParams(
    preparedArtifacts: IPreparedFirmwareArtifacts,
  ): IFirmwareExecutionBindingParams {
    const binding = this.firmwareCheckpointBindings.get(
      preparedArtifacts.transactionId,
    );
    if (!binding) {
      throw new OneKeyLocalError('Firmware checkpoint binding is unavailable');
    }
    if (!binding.hostBinding) {
      throw new OneKeyLocalError('Firmware host binding is unavailable');
    }
    return {
      hostBindingGeneration: binding.hostBinding.generation,
      checkpointSequenceStart: binding.checkpointSequenceStart,
      ...(binding.resumeCheckpoint
        ? { resumeCheckpoint: binding.resumeCheckpoint }
        : {}),
    };
  }

  private bindFirmwareHostBinding(
    transactionId: string,
    prepared: IPreparedFirmwareArtifacts,
    sdk: CoreApi,
  ): number {
    const checkpoint = this.firmwareCheckpointBindings.get(transactionId);
    if (!checkpoint) {
      throw new OneKeyLocalError('Firmware checkpoint binding is unavailable');
    }
    if (checkpoint.hostBinding) {
      checkpoint.hostBinding.sdk.unregisterFirmwareUpdateHostBinding(
        checkpoint.hostBinding.generation,
      );
    }
    const generation = sdk.registerFirmwareUpdateHostBinding({
      artifactReader: prepared.artifactReader,
      checkpointSink: checkpoint.checkpointSink,
    });
    if (!Number.isSafeInteger(generation) || generation <= 0) {
      throw new OneKeyLocalError(
        'Firmware SDK returned an invalid host binding generation',
      );
    }
    checkpoint.hostBinding = { sdk, generation };
    return generation;
  }

  private releaseFirmwareHostBinding(transactionId: string): void {
    const checkpoint = this.firmwareCheckpointBindings.get(transactionId);
    if (!checkpoint?.hostBinding) return;
    checkpoint.hostBinding.sdk.unregisterFirmwareUpdateHostBinding(
      checkpoint.hostBinding.generation,
    );
    checkpoint.hostBinding = undefined;
  }

  private cacheFirmwareUpdatePlan(plan: FirmwareUpdatePlan | undefined) {
    if (!plan) return;
    this.firmwareUpdatePlans.set(plan.planDigest, plan);
    if (this.firmwareUpdatePlans.size > 16) {
      const oldestDigest = this.firmwareUpdatePlans.keys().next().value as
        | string
        | undefined;
      if (oldestDigest) {
        this.firmwareUpdatePlans.delete(oldestDigest);
      }
    }
  }

  private getFirmwareUpdatePlan(
    releaseResult: ICheckAllFirmwareReleaseResult,
  ): FirmwareUpdatePlan {
    const planDigest = releaseResult.firmwareUpdatePlanDigest;
    const plan = planDigest
      ? this.firmwareUpdatePlans.get(planDigest)
      : undefined;
    if (!plan) {
      throw new OneKeyLocalError(
        'Firmware update plan is unavailable; check for updates again',
      );
    }
    if (
      plan.deviceIdentity !== (releaseResult.deviceUUID || 'unavailable') ||
      plan.deviceModel !== String(releaseResult.deviceType) ||
      plan.platform !== (platformEnv.symbol ?? 'web')
    ) {
      throw new OneKeyLocalError(
        'Firmware update plan does not match the selected device',
      );
    }
    return plan;
  }

  async clearOnceUpdateDevSettings() {
    await this.backgroundApi.serviceDevSetting.updateFirmwareUpdateDevSettings({
      forceUpdateOnceFirmware: false,
      forceUpdateOnceBle: false,
      forceUpdateOnceBootloader: false,
    });
  }

  @backgroundMethod()
  async rebootToBootloader(connectId: string): Promise<boolean> {
    const hardwareSDK = await this.getSDKInstance({
      connectId,
    });
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceUpdateReboot(connectId),
    );
  }

  @backgroundMethod()
  async rebootToBoardloader(connectId: string): Promise<Success> {
    const hardwareSDK = await this.getSDKInstance({
      connectId,
    });

    return convertDeviceResponse(() =>
      hardwareSDK?.deviceRebootToBoardloader(connectId),
    );
  }

  async checkDeviceIsBootloaderMode({
    connectId,
    allowEmptyConnectId,
    featuresCache,
  }: {
    connectId: string | undefined;
    allowEmptyConnectId?: boolean | undefined;
    featuresCache?: IOneKeyDeviceFeatures;
  }) {
    let features: IOneKeyDeviceFeatures | undefined;
    let error: IOneKeyError | undefined;
    let isBootloaderMode = false;
    try {
      if (featuresCache) {
        features = featuresCache;
      } else {
        // call getFeatures, use FIRMWARE_EVENT to setFirmwareUpdateInfo() and setBleFirmwareUpdateInfo()
        features =
          await this.backgroundApi.serviceHardware.getFeaturesWithoutCache({
            connectId,
            params: {
              retryCount: 0, // don't retry, just checking once
              // force sdk throw DeviceDetectInBootloaderMode but not DeviceNotFound when device at bootloader mode and only one device connected
              detectBootloaderDevice: true,
              // do not prompt web device permission
              skipWebDevicePrompt: true,
              allowEmptyConnectId,
            },
            silentMode: true,
          });
      }
      isBootloaderMode = await deviceUtils.isBootloaderModeByFeatures({
        features,
      });
    } catch (e) {
      if (
        isHardwareErrorByCode({
          error: e as any,
          code: HardwareErrorCode.DeviceDetectInBootloaderMode,
        })
      ) {
        isBootloaderMode = true;
      } else {
        error = e as any;
      }
    }
    return {
      isBootloaderMode,
      features,
      error,
    };
  }

  @backgroundMethod()
  async uploadResource(connectId: string, params: DeviceUploadResourceParams) {
    const hardwareSDK = await this.getSDKInstance({
      connectId,
    });
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceUploadResource(connectId, params),
    );
  }

  detectMap = new FirmwareUpdateDetectMap({
    backgroundApi: this.backgroundApi,
  });

  @backgroundMethod()
  async resetShouldDetectTimeCheck({ connectId }: { connectId: string }) {
    this.detectMap.resetLastDetectAt({ connectId });
  }

  @backgroundMethod()
  async showAutoUpdateCheckDebugToast(message: string) {
    void this.backgroundApi.serviceDevSetting
      .getFirmwareUpdateDevSettings('showAutoCheckHardwareUpdatesToast')
      .then((result) => {
        if (!result) return;

        void this.backgroundApi.serviceApp.showToast({
          method: 'message',
          title: message,
        });
      })
      .catch(() => {
        // ignore
      });
  }

  /**
   * Defer device update checks
   * @param connectId device connectId
   */
  @backgroundMethod()
  async delayShouldDetectTimeCheck({ connectId }: { connectId: string }) {
    this.detectMap.updateLastDetectAt({ connectId });

    void this.showAutoUpdateCheckDebugToast('推迟硬件自动更新检测');
  }

  @backgroundMethod()
  async delayShouldDetectTimeCheckWithDelay({
    connectId,
    delay,
  }: {
    connectId: string;
    delay: number;
  }) {
    this.detectMap.updateLastDetectAtWithDelay({
      connectId,
      delay,
    });
    void this.showAutoUpdateCheckDebugToast('暂停硬件自动更新检测');
  }

  @backgroundMethod()
  async getFirmwareUpdateDetectInfo({ connectId }: { connectId: string }) {
    const info = this.detectMap.detectMapCache[connectId];
    return info;
  }

  // TODO sdk not ready yet(slow network test)
  // TODO check firmware update from hidden wallet
  // TODO check firmware update from onboarding
  @backgroundMethod()
  async detectActiveAccountFirmwareUpdates({
    connectId,
  }: {
    connectId: string;
  }) {
    // detect certain account device firmware update, so connectId is required
    if (!connectId) {
      return;
    }
    const dbDevice = await localDb.getDeviceByQuery({ connectId });
    const vendorProfile = dbDevice?.vendor
      ? getVendorProfile(dbDevice.vendor)
      : undefined;
    if (vendorProfile?.isThirdParty) {
      return;
    }
    const showBootloaderUpdateModal = () => {
      appEventBus.emit(EAppEventBusNames.ShowFirmwareUpdateFromBootloaderMode, {
        connectId,
      });
    };
    if (!this.detectMap.shouldDetect({ connectId })) {
      return;
    }
    this.detectMap.updateLastDetectAt({
      connectId,
    });

    const compatibleConnectId =
      await this.backgroundApi.serviceHardware.getCompatibleConnectId({
        hardwareCallContext: EHardwareCallContext.BACKGROUND_TASK,
        connectId,
      });

    const { isBootloaderMode, features, error } =
      await this.checkDeviceIsBootloaderMode({
        connectId: compatibleConnectId || connectId,
      });

    serviceHardwareUtils.hardwareLog('checkFirmwareUpdateStatus', features);

    if (error) {
      if (
        isHardwareErrorByCode({
          error,
          code: [HardwareErrorCode.DeviceNotFound],
        })
      ) {
        // ignore
        return;
      }
      throw error;
    }

    if (isBootloaderMode) {
      showBootloaderUpdateModal();
    }
  }

  private _checkCacheMeetExpectations({
    baseReleaseInfo,
  }: {
    baseReleaseInfo: AllFirmwareRelease | undefined;
  }) {
    if (baseReleaseInfo) {
      const firmwareVersion = get(baseReleaseInfo, 'firmware.release.version');
      const bleVersion = get(baseReleaseInfo, 'ble.release.version');
      const featuresCache = get(baseReleaseInfo, 'features');
      if (featuresCache && (bleVersion || firmwareVersion)) {
        return baseReleaseInfo;
      }
    }
    return undefined;
  }

  @backgroundMethod()
  @toastIfError()
  async checkAllFirmwareRelease({
    connectId,
    firmwareType,
    skipCancel,
    baseReleaseInfoCache,
  }: {
    connectId: string | undefined;
    firmwareType: EFirmwareType | undefined;
    skipCancel?: boolean;
    baseReleaseInfoCache?: AllFirmwareRelease;
  }): Promise<ICheckAllFirmwareReleaseResult> {
    const { getDeviceUUID } = await CoreSDKLoader();

    const releaseInfoCache = this._checkCacheMeetExpectations({
      baseReleaseInfo: baseReleaseInfoCache,
    });

    const originalConnectId = connectId;
    // Skip cancel when using cached data since device state was already verified
    const needSkipCancel = skipCancel || !!releaseInfoCache;

    if (platformEnv.isNative && !originalConnectId) {
      throw new OneKeyLocalError(
        'checkAllFirmwareRelease ERROR: native ble-sdk connectId is required',
      );
    }

    await firmwareUpdateStepInfoAtom.set({
      step: EFirmwareUpdateSteps.init,
      payload: undefined,
    });
    await firmwareUpdateRetryAtom.set(undefined);
    serviceHardwareUtils.hardwareLog('checkAllFirmwareRelease');

    const sdk = await this.getSDKInstance({
      connectId: originalConnectId,
    });
    try {
      if (!needSkipCancel) {
        sdk.cancel(originalConnectId);
      }
    } catch (_error) {
      //
    }

    if (!needSkipCancel) {
      await timerUtils.wait(1000);
    }

    const currentTransportType =
      await this.backgroundApi.serviceSetting.getHardwareTransportType();
    const updatingConnectId = deviceUtils.getUpdatingConnectId({
      connectId: originalConnectId,
      currentTransportType,
    });

    try {
      if (!needSkipCancel) {
        sdk.cancel(updatingConnectId);
      }
    } catch (_error) {
      //
    }

    const { isBootloaderMode, features: initialFeatures } =
      await this.checkDeviceIsBootloaderMode({
        connectId: originalConnectId,
        allowEmptyConnectId: true,
        featuresCache: releaseInfoCache?.features,
      });
    let features: Features = initialFeatures as Features;

    // use originalConnectId getFeatures() make sure sdk throw DeviceNotFound if connected device not matched with originalConnectId
    if (isBootloaderMode || !features) {
      features =
        await this.backgroundApi.serviceHardware.getFeaturesWithoutCache({
          connectId: isBootloaderMode ? updatingConnectId : originalConnectId,
          params: {
            allowEmptyConnectId: true,
          },
        });
    }

    const releaseInfo = releaseInfoCache?.firmwareUpdatePlan
      ? releaseInfoCache
      : await this.loadBaseFirmwareRelease({
          connectId: originalConnectId,
          firmwareType,
          skipChangeTransportType: true,
        });

    const currentFirmwareType = await deviceUtils.getFirmwareType({
      features: releaseInfo.features,
    });

    const firmware = await this.checkFirmwareRelease({
      connectId: updatingConnectId,
      features,
      firmwareReleasePayload:
        releaseInfo.firmware as unknown as IFirmwareReleasePayload,
      saveUpdateInfo: currentFirmwareType === firmwareType,
    });

    let ble;
    let bootloader;
    let bridge;
    if (firmware?.hasUpgrade && firmware.toVersion) {
      bridge = releaseInfo.bridge as unknown as IHardwareBridgeReleasePayload;

      const mockShouldUpdateBridge =
        await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
          'shouldUpdateBridge',
        );
      if (bridge && mockShouldUpdateBridge === true) {
        // TODO mock bridge?.shouldUpdate
        bridge.shouldUpdate = true;
      }

      // TODO only check bootloader upgrade？
      if (!bridge?.shouldUpdate && releaseInfo.bootloader) {
        bootloader = await this.checkBootloaderRelease({
          connectId: updatingConnectId,
          features,
          firmwareUpdateInfo: firmware,
          bootloaderReleasePayload:
            releaseInfo.bootloader as unknown as IBootloaderReleasePayload,
        });
      }
    }

    if (!bridge?.shouldUpdate) {
      ble = await this.checkBLEFirmwareRelease({
        connectId: updatingConnectId,
        features,
        bleReleasePayload:
          releaseInfo.ble as unknown as IBleFirmwareReleasePayload,
      });
    }

    let hasUpgrade =
      firmware?.hasUpgrade || ble?.hasUpgrade || bootloader?.hasUpgrade;

    const mockAllIsUpToDate =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'allIsUpToDate',
      );
    if (mockAllIsUpToDate) {
      hasUpgrade = false;
    }

    // Force update if firmware is too many versions behind
    if (firmware?.hasUpgrade) {
      if (
        this.isVersionTooOld(
          firmware.fromVersion,
          firmware.toVersion,
          FIRMWARE_ONBOARDING_MAX_VERSIONS_BEHIND,
        )
      ) {
        firmware.hasUpgradeForce = true;
      }
    }
    if (ble?.hasUpgrade) {
      if (
        this.isVersionTooOld(
          ble.fromVersion,
          ble.toVersion,
          FIRMWARE_ONBOARDING_MAX_VERSIONS_BEHIND,
        )
      ) {
        ble.hasUpgradeForce = true;
      }
    }

    // TODO boot mode device uuid is empty
    const deviceUUID = getDeviceUUID(features);
    const deviceType = await deviceUtils.getDeviceTypeFromFeatures({
      features,
    });
    const deviceName = await deviceUtils.buildDeviceName({ features });
    const deviceBleName = deviceUtils.buildDeviceBleName({ features });

    const totalPhase: Array<IDeviceFirmwareType | undefined> = [
      bootloader?.hasUpgrade ? 'bootloader' : undefined,
      firmware?.hasUpgrade ? 'firmware' : undefined,
      ble?.hasUpgrade ? 'ble' : undefined,
    ];

    if (!hasUpgrade && originalConnectId) {
      await this.detectMap.deleteUpdateInfo({
        connectId: originalConnectId,
      });
    }

    let serverVersionInfos: IAllDeviceVerifyVersions | undefined;
    const defaultVersion = '0.0.0';
    const versionInfosFromBackend =
      await this.backgroundApi.serviceHardware.hardwareVerifyManager.fetchFirmwareVerifyHash(
        {
          deviceType,
          firmwareVersion: firmware?.hasUpgrade
            ? firmware.toVersion
            : defaultVersion,
          bluetoothVersion: ble?.hasUpgrade ? ble.toVersion : defaultVersion,
          bootloaderVersion: bootloader?.hasUpgrade
            ? bootloader.toVersion
            : defaultVersion,
          firmwareType,
        },
      );
    if (Array.isArray(versionInfosFromBackend)) {
      serverVersionInfos = deviceUtils.parseServerVersionInfos({
        serverVerifyInfos: versionInfosFromBackend,
      });
      if (firmware?.hasUpgrade && serverVersionInfos.firmware.releaseUrl) {
        firmware.githubReleaseUrl = serverVersionInfos.firmware.releaseUrl;
      }
      if (ble?.hasUpgrade && serverVersionInfos.bluetooth.releaseUrl) {
        ble.githubReleaseUrl = serverVersionInfos.bluetooth.releaseUrl;
      }
      if (bootloader?.hasUpgrade && serverVersionInfos.bootloader.releaseUrl) {
        bootloader.githubReleaseUrl = serverVersionInfos.bootloader.releaseUrl;
      }
    }

    let device: IDBDevice | undefined;
    let fixedUpdatingConnectId = updatingConnectId;
    try {
      if (platformEnv.isSupportDesktopBle) {
        device = await localDb.getDeviceByQuery({
          connectId: originalConnectId,
        });
        fixedUpdatingConnectId = deviceUtils.getFixedUpdatingConnectId({
          updatingConnectId,
          currentTransportType,
          device,
        });
      }
    } catch (_error) {
      // ignore
    }

    let firmwareUpdatePlanDigest: string | undefined;
    const firmwareUpdatePlan = releaseInfo.firmwareUpdatePlan;
    if (hasUpgrade && firmwareUpdatePlan) {
      const [currentJournal, externalFirmwareSdk] = await Promise.all([
        firmwareUpdateJournal.read(),
        this.getExternalFirmwareSdk(updatingConnectId),
      ]);
      const currentTransactionOwnsPlan =
        currentJournal !== undefined &&
        currentJournal.planDigest === firmwareUpdatePlan.planDigest &&
        currentJournal.phase !== 'COMPLETED' &&
        currentJournal.phase !== 'FAILED' &&
        currentJournal.phase !== 'ABANDONED';
      if (currentTransactionOwnsPlan && !externalFirmwareSdk) {
        throw new OneKeyLocalError(
          'Active firmware transaction recovery is unsupported by this SDK',
        );
      }
      const bridgeBinaryReady =
        platformEnv.isDesktop &&
        currentTransportType === EHardwareTransportType.Bridge &&
        (await isFirmwareArtifactCapabilityReady());
      const externalPreparedReady =
        externalFirmwareSdk &&
        (currentTransactionOwnsPlan ||
          (await this.evaluateExternalFirmwareRollout(firmwareUpdatePlan))
            .allowed);
      if (bridgeBinaryReady || externalPreparedReady) {
        this.cacheFirmwareUpdatePlan(firmwareUpdatePlan);
        firmwareUpdatePlanDigest = firmwareUpdatePlan.planDigest;
      }
    }

    return {
      updatingConnectId: fixedUpdatingConnectId,
      originalConnectId,
      features,
      deviceType,
      deviceName,
      deviceBleName,
      deviceUUID,
      firmwareUpdatePlanDigest,
      hasUpgrade,
      isBootloaderMode: features
        ? (await deviceUtils.getDeviceModeFromFeatures({ features })) ===
          EOneKeyDeviceMode.bootloader
        : false,
      updateInfos: {
        firmware,
        ble,
        bootloader,
        bridge,
      },
      totalPhase: totalPhase.filter(Boolean),
    };
  }

  @backgroundMethod()
  async checkFirmwareRelease({
    connectId,
    features,
    firmwareReleasePayload,
    saveUpdateInfo = true,
  }: {
    connectId: string | undefined;
    features: IOneKeyDeviceFeatures;
    firmwareReleasePayload: IFirmwareReleasePayload;
    saveUpdateInfo?: boolean;
  }): Promise<IFirmwareUpdateInfo> {
    const releasePayload: IFirmwareReleasePayload = {
      ...firmwareReleasePayload,
      features,
      connectId, // set connectId as result missing features, but events include
    };

    // TODO check releaseInfo.version with current version
    // 1. manual check here
    // 2. auto check by event: FIRMWARE_EVENT (event emit by method calling like sdk.getFeatures())
    return this.setFirmwareUpdateInfo(releasePayload, saveUpdateInfo);
  }

  private async loadBaseFirmwareRelease({
    connectId,
    firmwareType,
    skipChangeTransportType,
    retryCount,
    silentMode,
  }: {
    connectId: string | undefined;
    firmwareType: EFirmwareType | undefined;
    skipChangeTransportType?: boolean;
    retryCount?: number;
    silentMode?: boolean;
  }) {
    const hardwareSDK = await this.getSDKInstance({
      connectId,
    });
    const checkBridgeRelease = await this._hasUseBridge();
    let currentConnectId = connectId;
    if (!skipChangeTransportType) {
      const currentTransportType =
        await this.backgroundApi.serviceSetting.getHardwareTransportType();
      currentConnectId = deviceUtils.getUpdatingConnectId({
        connectId,
        currentTransportType,
      });
    }
    const result = await convertDeviceResponse(
      () =>
        // method fail if device on boot mode
        hardwareSDK.checkAllFirmwareRelease(currentConnectId, {
          checkBridgeRelease,
          firmwareType,
          platform: platformEnv.symbol ?? 'web',
          retryCount,
        }),
      {
        silentMode,
      },
    );

    return result;
  }

  @backgroundMethod()
  async baseCheckAllFirmwareRelease(
    params: Parameters<ServiceFirmwareUpdate['loadBaseFirmwareRelease']>[0],
  ) {
    const result = await this.loadBaseFirmwareRelease(params);
    return {
      ...result,
      firmwareUpdatePlan: undefined,
    };
  }

  @backgroundMethod()
  async checkFirmwareTypeAvailable({
    connectId,
    deviceType,
    firmwareType,
  }: {
    connectId: string | undefined;
    deviceType: IDeviceType;
    firmwareType: EFirmwareType;
  }) {
    const hardwareSDK = await this.getSDKInstance({
      connectId,
    });
    return convertDeviceResponse(() =>
      hardwareSDK.checkFirmwareTypeAvailable({
        deviceType,
        firmwareType,
      }),
    );
  }

  @backgroundMethod()
  async checkBLEFirmwareRelease({
    connectId,
    features,
    bleReleasePayload,
  }: {
    connectId: string | undefined;
    features: IOneKeyDeviceFeatures;
    bleReleasePayload: IBleFirmwareReleasePayload;
  }): Promise<IBleFirmwareUpdateInfo> {
    const releasePayload: IBleFirmwareReleasePayload = {
      ...bleReleasePayload,
      features,
      connectId,
    };

    // TODO check releaseInfo.version with current version
    // 1. manual check here
    // 2. auto check by event: FIRMWARE_EVENT (event emit by method calling like sdk.getFeatures())
    return this.setBleFirmwareUpdateInfo(releasePayload);
  }

  // TODO only for classic and mini?
  @backgroundMethod()
  async checkBootloaderRelease({
    connectId,
    features,
    firmwareUpdateInfo,
    bootloaderReleasePayload,
  }: {
    connectId: string | undefined;
    features: IOneKeyDeviceFeatures;
    firmwareUpdateInfo: IFirmwareUpdateInfo;
    bootloaderReleasePayload: IBootloaderReleasePayload;
  }): Promise<IBootloaderUpdateInfo> {
    const usedReleasePayload = bootloaderReleasePayload;

    const { bootloaderVersion } = await deviceUtils.getDeviceVersion({
      features,
      device: undefined,
    });
    let toVersion = '';
    let changelog: IFirmwareChangeLog | undefined;
    // boot releaseInfo?.release may be string of resource download url
    const versionFromReleaseInfo =
      usedReleasePayload?.release?.displayBootloaderVersion;
    if (versionFromReleaseInfo && isArray(versionFromReleaseInfo)) {
      toVersion = this.arrayVersionToString(versionFromReleaseInfo as any);
    }
    if (!toVersion) {
      toVersion = this.arrayVersionToString(
        firmwareUpdateInfo.releasePayload.release?.displayBootloaderVersion,
      );
    }
    changelog = usedReleasePayload.release?.bootloaderChangelog;
    if (!changelog) {
      changelog =
        firmwareUpdateInfo.releasePayload.release?.bootloaderChangelog;
    }

    const fromVersion = bootloaderVersion;
    const { hasUpgrade, hasUpgradeForce } =
      await this.getFirmwareHasUpgradeStatus({
        releasePayload: usedReleasePayload,
        firmwareType: 'bootloader',
        fromVersion,
        toVersion,
        fromFirmwareType: undefined,
        toFirmwareType: undefined,
      });

    const updateInfo: IBootloaderUpdateInfo = {
      connectId,
      hasUpgrade,
      hasUpgradeForce,
      fromVersion,
      fromFirmwareType: undefined,
      toVersion,
      toFirmwareType: undefined,
      releasePayload: usedReleasePayload,
      changelog,
      firmwareType: 'bootloader',
    };
    return updateInfo;
  }

  async getFirmwareHasUpgradeStatus({
    releasePayload,
    firmwareType,
    fromVersion,
    toVersion,
    fromFirmwareType,
    toFirmwareType,
  }: {
    releasePayload:
      | IFirmwareReleasePayload
      | IBleFirmwareReleasePayload
      | IBootloaderReleasePayload;
    firmwareType: IDeviceFirmwareType;
    fromVersion: string;
    toVersion: string;
    fromFirmwareType: EFirmwareType | undefined;
    toFirmwareType: EFirmwareType | undefined;
  }) {
    let hasUpgradeForce = false;
    let hasUpgrade = false;
    switch (releasePayload?.status) {
      case 'required':
        hasUpgradeForce = true;
        hasUpgrade = true;
        break;
      case 'valid':
      case 'none':
        hasUpgrade = false;
        break;
      case 'outdated':
        hasUpgrade = true;
        break;
      default:
        hasUpgrade = false;
        break;
    }

    // bootloaderMode may return status: 'unknown' | 'none'
    // TODO: different of 'unknown' | 'none';
    if (
      // bootloader can't detect current firmware version, so we always upgrade fw and ble
      releasePayload?.bootloaderMode &&
      releasePayload?.release &&
      ['firmware', 'ble'].includes(firmwareType) // bootloader can't reinstall
    ) {
      hasUpgrade = true;
    }

    // TODO sdk missing type shouldUpdate
    // @ts-ignore
    if (releasePayload?.shouldUpdate) {
      // if sdk indicate should update, always update
      hasUpgrade = true;
    }

    const changeFirmwareType = fromFirmwareType !== toFirmwareType;
    if (
      firmwareType !== 'bootloader' &&
      !releasePayload?.bootloaderMode &&
      fromVersion &&
      toVersion &&
      !changeFirmwareType
    ) {
      if (semver.gte(fromVersion, toVersion)) {
        hasUpgrade = false;
        hasUpgradeForce = false;
      }
    }

    // re-fix at last, if valid status, never upgrade
    if (releasePayload?.status === 'valid') {
      hasUpgrade = false;
    }

    const mockUpdateFirmware =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'forceUpdateFirmware',
      );
    const mockUpdateOnceFirmware =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'forceUpdateOnceFirmware',
      );
    const mockUpdateBle =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'forceUpdateBle',
      );
    const mockUpdateOnceBle =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'forceUpdateOnceBle',
      );
    const mockUpdateBootloader =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'forceUpdateBootloader',
      );
    const mockUpdateOnceBootloader =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'forceUpdateOnceBootloader',
      );
    if (
      firmwareType === 'firmware' &&
      (mockUpdateFirmware || mockUpdateOnceFirmware)
    ) {
      hasUpgrade = true;
    }
    if (firmwareType === 'ble' && (mockUpdateBle || mockUpdateOnceBle)) {
      hasUpgrade = true;
    }
    if (
      firmwareType === 'bootloader' &&
      (mockUpdateBootloader || mockUpdateOnceBootloader)
    ) {
      hasUpgrade = true;
    }

    return {
      hasUpgradeForce,
      hasUpgrade,
    };
  }

  isVersionTooOld(
    fromVersion: string,
    toVersion: string,
    maxBehind: number,
  ): boolean {
    const from = semver.parse(fromVersion);
    const to = semver.parse(toVersion);
    if (!from || !to) return false;

    if (to.major > from.major) return true;
    if (to.major === from.major && to.minor - from.minor > maxBehind)
      return true;
    if (
      to.major === from.major &&
      to.minor === from.minor &&
      to.patch - from.patch > maxBehind
    )
      return true;

    return false;
  }

  async getConnectIdFromReleaseInfo(
    payload: IFirmwareReleasePayload | IBleFirmwareReleasePayload,
  ) {
    let connectId = payload.connectId;
    // features only included by events calling
    if (!connectId && payload.features) {
      connectId =
        await this.backgroundApi.serviceHardware.getConnectIdFromFeatures({
          features: payload.features,
        });
    }
    return connectId;
  }

  arrayVersionToString(version: IVersionArray | undefined) {
    return version?.join('.') || '';
  }

  // TODO move to standalone service
  @backgroundMethod()
  async setFirmwareUpdateInfo(
    payload: IFirmwareReleasePayload,
    saveUpdateInfo = true,
  ): Promise<IFirmwareUpdateInfo> {
    serviceHardwareUtils.hardwareLog('_checkFirmwareUpdate', payload);
    if (!payload?.features) {
      throw new OneKeyLocalError(
        'setFirmwareUpdateInfo ERROR: features is required',
      );
    }
    const connectId = await this.getConnectIdFromReleaseInfo(payload);

    const { firmwareVersion } = await deviceUtils.getDeviceVersion({
      device: undefined,
      features: payload?.features,
    });

    const fromVersion = firmwareVersion || '';
    const fromFirmwareType = await deviceUtils.getFirmwareType({
      features: payload?.features,
    });
    const toVersion = this.arrayVersionToString(payload?.release?.version);
    const toFirmwareType = payload.release?.firmwareType;
    const { hasUpgrade, hasUpgradeForce } =
      await this.getFirmwareHasUpgradeStatus({
        releasePayload: payload,
        firmwareType: 'firmware',
        fromVersion,
        toVersion,
        fromFirmwareType,
        toFirmwareType,
      });

    const updateInfo: IFirmwareUpdateInfo = {
      connectId,
      hasUpgrade,
      hasUpgradeForce,
      fromVersion,
      fromFirmwareType,
      toVersion,
      toFirmwareType: payload.release?.firmwareType,
      releasePayload: payload,
      changelog: payload.release?.changelog,
      firmwareType: 'firmware',
    };
    if (connectId && saveUpdateInfo) {
      await this.detectMap.updateFirmwareUpdateInfo({
        connectId,
        updateInfo,
      });
    }
    serviceHardwareUtils.hardwareLog(
      '_checkFirmwareUpdate updateInfo',
      updateInfo,
    );
    return updateInfo;
  }

  @backgroundMethod()
  async setBleFirmwareUpdateInfo(payload: IBleFirmwareReleasePayload) {
    serviceHardwareUtils.hardwareLog('showBleFirmwareReleaseInfo', payload);
    if (!payload.features) {
      throw new OneKeyLocalError(
        'setBleFirmwareUpdateInfo ERROR: features is required',
      );
    }
    const connectId = await this.getConnectIdFromReleaseInfo(payload);
    const { bleVersion } = await deviceUtils.getDeviceVersion({
      device: undefined,
      features: payload.features,
    });
    const fromVersion = bleVersion || '';
    const toVersion = this.arrayVersionToString(payload?.release?.version);
    const { hasUpgrade, hasUpgradeForce } =
      await this.getFirmwareHasUpgradeStatus({
        releasePayload: payload,
        firmwareType: 'ble',
        fromVersion,
        toVersion,
        fromFirmwareType: undefined,
        toFirmwareType: undefined,
      });

    const updateInfo: IBleFirmwareUpdateInfo = {
      connectId,
      hasUpgrade,
      hasUpgradeForce,
      fromVersion,
      fromFirmwareType: undefined,
      toVersion,
      toFirmwareType: undefined,
      releasePayload: payload,
      changelog: payload.release?.changelog,
      firmwareType: 'ble',
    };
    if (connectId) {
      await this.detectMap.updateBleFirmwareUpdateInfo({
        connectId,
        updateInfo,
      });
    }
    return updateInfo;
  }

  async withFirmwareUpdateEvents<T>(fn: () => Promise<T>): Promise<T> {
    const hardwareSDK = await this.getSDKInstance({
      connectId: undefined,
    });
    const listener = (data: any) => {
      serviceHardwareUtils.hardwareLog('autoUpdateFirmware', data);
      // dispatch(setUpdateFirmwareStep(get(data, 'data.message', '')));
    };
    hardwareSDK.on(EHardwareUiStateAction.FIRMWARE_TIP, listener);
    try {
      return await fn();
    } finally {
      hardwareSDK.off(EHardwareUiStateAction.FIRMWARE_TIP, listener);
    }
  }

  @backgroundMethod()
  async ensureDeviceExist(
    connectId: string,
    maxTryCount = 10,
    bootloaderMode = false,
  ) {
    return new Promise((resolve) => {
      const scanner = deviceUtils.getDeviceScanner({
        backgroundApi: this.backgroundApi,
      });
      let tryCount = 0;
      scanner.startDeviceScan(
        (response) => {
          tryCount += 1;
          if (tryCount > maxTryCount) {
            scanner.stopScan();
            resolve(false);
          }
          if (!response.success) {
            return;
          }
          const deviceExist = bootloaderMode
            ? // bootloader mode does not have connect id for classic
              (response.payload ?? []).length > 0
            : (response.payload ?? []).find((d) =>
                equalsIgnoreCase(d.connectId, connectId),
              );
          if (deviceExist) {
            scanner.stopScan();
            resolve(true);
          }
        },
        () => {},
        1,
        3000,
        Number.MAX_VALUE,
      );
    });
  }

  async updatingBootloader(
    params: IUpdateFirmwareWorkflowParams,
    updateInfo: IBootloaderUpdateInfo,
    firmwareArtifacts?: IFirmwareWorkflowArtifacts,
  ): Promise<undefined | Success> {
    const preparedArtifacts = getPreparedFirmwareArtifacts(firmwareArtifacts);
    const bridgeBinary =
      getBridgeFirmwareBinaries(firmwareArtifacts)?.targetBinaries.bootloader;
    const hardwareSDK = await this.getSDKInstance({
      connectId: params.releaseResult.updatingConnectId,
    });

    const deviceType = params.releaseResult?.deviceType;
    if (!deviceType) return;

    // TODO move to utils
    const isClassicOrMini =
      deviceType === EDeviceType.Classic ||
      deviceType === EDeviceType.Mini ||
      deviceType === EDeviceType.Classic1s ||
      deviceType === EDeviceType.ClassicPure;

    const isTouchOrPro =
      deviceType === EDeviceType.Touch || deviceType === EDeviceType.Pro;

    return this.withFirmwareUpdateEvents(async () => {
      if (isClassicOrMini) {
        await firmwareUpdateStepInfoAtom.set({
          step: EFirmwareUpdateSteps.installing,
          payload: {
            installingTarget: {
              totalPhase: params.releaseResult.totalPhase,
              currentPhase: 'bootloader',
              updateInfo,
            },
          },
        });
        const bootloaderArtifact = preparedArtifacts?.selected.bootloader;
        const result = convertDeviceResponse(async () => {
          if (bootloaderArtifact && preparedArtifacts) {
            const checkpointParams =
              this.getFirmwareCheckpointParams(preparedArtifacts);
            return (
              hardwareSDK.firmwareUpdateV2 as unknown as (
                connectId: string | undefined,
                params: {
                  preparedPlan: FirmwareUpdatePreparedPlan;
                  updateType: 'firmware';
                  platform: string;
                  isUpdateBootloader: true;
                  artifact: IFirmwareArtifactReference;
                  hostBindingGeneration: number;
                  checkpointSequenceStart: number;
                  resumeCheckpoint?: FirmwareCheckpoint;
                },
              ) => ReturnType<CoreApi['firmwareUpdateV2']>
            )(params.releaseResult.updatingConnectId, {
              preparedPlan: preparedArtifacts.preparedPlan,
              updateType: 'firmware',
              platform: platformEnv.symbol ?? 'web',
              isUpdateBootloader: true,
              artifact: bootloaderArtifact,
              ...checkpointParams,
            });
          }
          if (bridgeBinary) {
            return (
              hardwareSDK.firmwareUpdateV2 as unknown as (
                connectId: string | undefined,
                updateParams: {
                  binary: ArrayBuffer;
                  updateType: 'firmware';
                  platform: string;
                  isUpdateBootloader: true;
                },
              ) => ReturnType<CoreApi['firmwareUpdateV2']>
            )(params.releaseResult.updatingConnectId, {
              binary: bridgeBinary,
              updateType: 'firmware',
              platform: platformEnv.symbol ?? 'web',
              isUpdateBootloader: true,
            });
          }
          return hardwareSDK.firmwareUpdateV2(
            params.releaseResult.updatingConnectId,
            {
              updateType: 'firmware',
              platform: platformEnv.symbol ?? 'web',
              isUpdateBootloader: true,
            },
          );
        });
        return result;
      }
      if (isTouchOrPro) {
        await firmwareUpdateStepInfoAtom.set({
          step: EFirmwareUpdateSteps.installing,
          payload: {
            installingTarget: {
              totalPhase: params.releaseResult.totalPhase,
              currentPhase: 'bootloader',
              updateInfo,
            },
          },
        });
        const bootloaderArtifact = preparedArtifacts?.selected.bootloader;
        return convertDeviceResponse(async () => {
          if (bootloaderArtifact && preparedArtifacts) {
            const checkpointParams =
              this.getFirmwareCheckpointParams(preparedArtifacts);
            return (
              hardwareSDK.deviceUpdateBootloader as unknown as (
                connectId: string,
                params: {
                  preparedPlan: FirmwareUpdatePreparedPlan;
                  artifact: IFirmwareArtifactReference;
                  hostBindingGeneration: number;
                  checkpointSequenceStart: number;
                  resumeCheckpoint?: FirmwareCheckpoint;
                },
              ) => ReturnType<CoreApi['deviceUpdateBootloader']>
            )(params.releaseResult.updatingConnectId as string, {
              preparedPlan: preparedArtifacts.preparedPlan,
              artifact: bootloaderArtifact,
              ...checkpointParams,
            });
          }
          if (bridgeBinary) {
            return hardwareSDK.deviceUpdateBootloader(
              params.releaseResult.updatingConnectId as string,
              { binary: bridgeBinary },
            );
          }
          return hardwareSDK.deviceUpdateBootloader(
            params.releaseResult.updatingConnectId as string,
            {},
          );
        });
      }
    });
  }

  updatingBootloaderForTouchAndProLegacy(
    params: IUpdateFirmwareWorkflowParams,
  ) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      const hardwareSDK = await this.getSDKInstance({
        connectId: params.releaseResult.updatingConnectId,
      });
      // restart count down
      await timerUtils.wait(8000);
      let tryCount = 0;
      //  polling device when restart success
      const DISCONNECT_ERROR = 'Request failed with status code';
      const execute = async () => {
        if (!params.releaseResult.updatingConnectId) {
          return;
        }
        const isFoundDevice = await this.ensureDeviceExist(
          params.releaseResult.updatingConnectId,
        );
        if (!isFoundDevice) {
          resolve({
            success: false,
            payload: {
              error: 'Device Not Found',
              code: HardwareErrorCode.DeviceNotFound,
            },
          });
        }
        const res = await hardwareSDK.deviceUpdateBootloader(
          params.releaseResult.updatingConnectId,
          {},
        );
        if (!res.success) {
          if (
            res.payload.error.indexOf(DISCONNECT_ERROR) > -1 &&
            tryCount < 3
          ) {
            tryCount += 1;
            await execute();
          } else {
            resolve(res);
            return;
          }
        }
        resolve(res as unknown as CoreSuccess<boolean>);
      };

      await execute();
    });
  }

  @backgroundMethod()
  @toastIfError()
  async updatingFirmware(
    { connectId, version, firmwareType, deviceType }: IAutoUpdateFirmwareParams,
    updateInfo: IBleFirmwareUpdateInfo | IFirmwareUpdateInfo,
    workflowParams: IUpdateFirmwareWorkflowParams,
    firmwareArtifacts?: IFirmwareWorkflowArtifacts,
  ): Promise<Success> {
    const preparedArtifacts = getPreparedFirmwareArtifacts(firmwareArtifacts);
    const bridgeBinaries = getBridgeFirmwareBinaries(firmwareArtifacts);
    // const { dispatch } = this.backgroundApi;
    // dispatch(setUpdateFirmwareStep(''));

    const hardwareSDK = await this.getSDKInstance({
      connectId,
    });

    return this.withFirmwareUpdateEvents(async () => {
      // dev
      // const settings = this.backgroundApi.appSelector((s) => s.settings);
      // const enable = settings?.devMode?.enable ?? false;
      // const updateDeviceRes = settings?.devMode?.updateDeviceRes ?? false;

      // const forcedUpdateRes = enable && updateDeviceRes;
      // const version = settings.deviceUpdates?.[connectId][firmwareType]?.version;

      const forceUpdateResEvenIfSameVersion =
        await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
          'forceUpdateResEvenSameVersion',
        );
      const versionArr = version.split('.').map((v) => parseInt(v, 10)); // TODO move to utils
      await firmwareUpdateStepInfoAtom.set({
        step: EFirmwareUpdateSteps.installing,
        payload: {
          installingTarget: {
            totalPhase: workflowParams.releaseResult.totalPhase,
            currentPhase: firmwareType,
            updateInfo,
          },
        },
      });

      const currentTransportType =
        await this.backgroundApi.serviceSetting.getHardwareTransportType();

      const updateType = firmwareType === 'ble' ? 'ble' : 'firmware';
      const selectedArtifact =
        updateType === 'ble'
          ? preparedArtifacts?.selected.ble
          : preparedArtifacts?.selected.firmware;
      const result = await convertDeviceResponse(async () => {
        const updatingConnectId = deviceUtils.getUpdatingConnectId({
          connectId,
          currentTransportType,
        });
        if (selectedArtifact && preparedArtifacts) {
          const checkpointParams =
            this.getFirmwareCheckpointParams(preparedArtifacts);
          return (
            hardwareSDK.firmwareUpdateV2 as unknown as (
              id: string | undefined,
              updateParams: {
                preparedPlan: FirmwareUpdatePreparedPlan;
                updateType: 'firmware' | 'ble';
                forcedUpdateRes: boolean;
                platform: string;
                firmwareType: EFirmwareType | undefined;
                artifact: IFirmwareArtifactReference;
                resourceEntries?: readonly {
                  entryName: string;
                  artifact: IFirmwareArtifactReference;
                }[];
                hostBindingGeneration: number;
                checkpointSequenceStart: number;
                resumeCheckpoint?: FirmwareCheckpoint;
              },
            ) => ReturnType<CoreApi['firmwareUpdateV2']>
          )(updatingConnectId, {
            preparedPlan: preparedArtifacts.preparedPlan,
            updateType,
            forcedUpdateRes: forceUpdateResEvenIfSameVersion === true,
            platform: platformEnv.symbol ?? 'web',
            firmwareType: updateInfo.toFirmwareType,
            artifact: selectedArtifact,
            ...(updateType === 'firmware' &&
            preparedArtifacts.selected.resourceEntries
              ? {
                  resourceEntries: preparedArtifacts.selected.resourceEntries,
                }
              : {}),
            ...checkpointParams,
          });
        }
        const bridgeBinary =
          bridgeBinaries?.targetBinaries[
            updateType === 'ble' ? 'ble' : 'firmware'
          ];
        if (bridgeBinary) {
          return (
            hardwareSDK.firmwareUpdateV2 as unknown as (
              id: string | undefined,
              updateParams: {
                binary: ArrayBuffer;
                updateType: 'firmware' | 'ble';
                forcedUpdateRes: boolean;
                platform: string;
                firmwareType: EFirmwareType | undefined;
              },
            ) => ReturnType<CoreApi['firmwareUpdateV2']>
          )(updatingConnectId, {
            binary: bridgeBinary,
            updateType,
            forcedUpdateRes: forceUpdateResEvenIfSameVersion === true,
            platform: platformEnv.symbol ?? 'web',
            firmwareType: updateInfo.toFirmwareType,
          });
        }
        return hardwareSDK.firmwareUpdateV2(updatingConnectId, {
          updateType,
          forcedUpdateRes: forceUpdateResEvenIfSameVersion === true,
          version: versionArr,
          platform: platformEnv.symbol ?? 'web',
          firmwareType: updateInfo.toFirmwareType,
        });
      });
      if (
        result &&
        deviceType === EDeviceType.Touch &&
        firmwareType === 'firmware'
      ) {
        // const updateBootRes = await this.updateBootloader(connectId);
        // if (!updateBootRes.success) return updateBootRes;
      }
      // TODO handleErrors UpdatingModal
      return result;
    });
  }

  @backgroundMethod()
  async checkBridgeStatus(): Promise<{ status: boolean; timeout?: boolean }> {
    if (!(await this._hasUseBridge())) {
      return Promise.resolve({ status: true });
    }

    const hardwareSDK = await this.getSDKInstance({
      connectId: undefined,
    });

    try {
      const bridgeStatus = await convertDeviceResponse(() =>
        hardwareSDK?.checkBridgeStatus(),
      );
      return { status: bridgeStatus };
    } catch (error) {
      if (
        error instanceof InitIframeLoadFail ||
        error instanceof InitIframeTimeout
      ) {
        return Promise.resolve({ status: true });
      }
      /**
       * Sometimes we need to capture the Bridge timeout error
       * it does not mean that the user does not have bridge installed
       */
      if (error instanceof BridgeTimeoutError) {
        return Promise.resolve({ status: true, timeout: true });
      }

      return Promise.resolve({ status: false });
    }
  }

  async _hasUseBridge() {
    const hardwareTransportType =
      await this.backgroundApi.serviceSetting.getHardwareTransportType();
    if (hardwareTransportType === EHardwareTransportType.WEBUSB) {
      return false;
    }
    return (
      platformEnv.isDesktop || platformEnv.isWeb || platformEnv.isExtension
    );
  }

  updateTasks: Record<number | string, IUpdateFirmwareTask> = {};

  updateWorkflowSequence = 0;

  // Bind analytics to the workflow that created each task so late native
  // completions cannot mutate a newer workflow's counters.
  updateWorkflowTracking:
    | {
        workflowId: number;
        acceptsTaskResults: boolean;
        updateFlow: 'v1' | 'v2';
        releaseResult: ICheckAllFirmwareReleaseResult;
        activeStartedAt: number | undefined;
        activeDurationMs: number;
        attemptCount: number;
        retryCount: number;
      }
    | undefined;

  resetUpdateWorkflowTracking({
    updateFlow,
    releaseResult,
  }: {
    updateFlow: 'v1' | 'v2';
    releaseResult: ICheckAllFirmwareReleaseResult;
  }) {
    const workflowId = (this.updateWorkflowSequence += 1);
    this.updateWorkflowTracking = {
      workflowId,
      acceptsTaskResults: true,
      updateFlow,
      releaseResult,
      activeStartedAt: Date.now(),
      activeDurationMs: 0,
      attemptCount: 0,
      retryCount: 0,
    };
    return workflowId;
  }

  getUpdateWorkflowTracking(workflowId: number) {
    const tracking = this.updateWorkflowTracking;
    return tracking?.workflowId === workflowId && tracking.acceptsTaskResults
      ? tracking
      : undefined;
  }

  isUpdateWorkflowCurrent(workflowId: number | undefined) {
    return (
      workflowId === undefined ||
      (this.updateWorkflowTracking?.workflowId === workflowId &&
        this.updateWorkflowTracking.acceptsTaskResults)
    );
  }

  closeUpdateWorkflowTracking() {
    const tracking = this.updateWorkflowTracking;
    if (!tracking || !tracking.acceptsTaskResults) {
      return;
    }
    this.pauseUpdateWorkflowTracking(tracking.workflowId);
    tracking.acceptsTaskResults = false;
  }

  pauseUpdateWorkflowTracking(workflowId: number) {
    const tracking = this.getUpdateWorkflowTracking(workflowId);
    if (!tracking || tracking.activeStartedAt === undefined) {
      return;
    }
    tracking.activeDurationMs += Date.now() - tracking.activeStartedAt;
    tracking.activeStartedAt = undefined;
  }

  resumeUpdateWorkflowTracking(workflowId: number) {
    const tracking = this.getUpdateWorkflowTracking(workflowId);
    if (!tracking || tracking.activeStartedAt !== undefined) {
      return;
    }
    tracking.activeStartedAt = Date.now();
  }

  recordUpdateWorkflowRetry(workflowId: number) {
    const tracking = this.getUpdateWorkflowTracking(workflowId);
    if (!tracking) {
      return false;
    }
    tracking.retryCount += 1;
    return true;
  }

  @backgroundMethod()
  async getUpdateWorkflowTrackingInfo(): Promise<{
    retryCount: number | undefined;
    durationMs: number | undefined;
  }> {
    const tracking = this.updateWorkflowTracking;
    const currentActiveDurationMs =
      tracking?.activeStartedAt === undefined
        ? 0
        : Date.now() - tracking.activeStartedAt;
    return {
      retryCount: tracking?.retryCount,
      durationMs: tracking
        ? tracking.activeDurationMs + currentActiveDurationMs
        : undefined,
    };
  }

  async trackUpdateTaskAttemptResult({
    workflowId,
    status,
    error,
  }: {
    workflowId: number;
    status: 'success' | 'failed';
    error?: unknown;
  }) {
    // Never let analytics break the update/retry flow
    try {
      const tracking = this.getUpdateWorkflowTracking(workflowId);
      if (!tracking) {
        return;
      }
      // User exit is not a real update failure
      if (
        status === 'failed' &&
        (error instanceof FirmwareUpdateExit ||
          error instanceof FirmwareUpdateTasksClear)
      ) {
        return;
      }
      const attempt = (tracking.attemptCount += 1);
      const err =
        error === undefined ? undefined : toPlainErrorObject(error as any);
      const hardwareTransportType =
        await this.backgroundApi.serviceSetting.getHardwareTransportType();
      defaultLogger.update.firmware.firmwareUpdateAttemptResult({
        deviceType: tracking.releaseResult.deviceType,
        transportType: hardwareTransportType,
        updateFlow: tracking.updateFlow,
        firmwareVersions: parseFirmwareVersions(tracking.releaseResult),
        attempt,
        status,
        errorCode: err?.code,
        errorMessage: err?.message,
      });
    } catch (loggingError) {
      serviceHardwareUtils.hardwareLog(
        'trackUpdateTaskAttemptResult logging ERROR',
        loggingError,
      );
    }
  }

  updateTasksAdd({
    fn,
    reject,
    resolve,
  }: IPromiseContainerCallbackCreate & {
    fn: IUpdateFirmwareTaskFn;
  }) {
    const { servicePromise } = this.backgroundApi;
    // TODO disabled servicePromise auto reject when timeout
    const id = servicePromise.createCallback({ reject, resolve });

    this.updateTasks[id] = {
      fn,
      workflowId: this.updateWorkflowTracking?.workflowId,
    };
    return id;
  }

  async updateTasksReject({ id, error }: IPromiseContainerReject) {
    const { servicePromise } = this.backgroundApi;
    await servicePromise.rejectCallback({ id, error });
    delete this.updateTasks[id];
  }

  async updateTasksResolve({ id, data }: IPromiseContainerResolve) {
    const { servicePromise } = this.backgroundApi;
    await servicePromise.resolveCallback({
      id,
      data,
    });
    delete this.updateTasks[id];
  }

  async updateTasksClear(reason: string) {
    await Promise.all(
      Object.keys(this.updateTasks).map(async (id) => {
        await this.updateTasksReject({
          id,
          error: new FirmwareUpdateTasksClear({
            message: `updateTasksClear: ${reason}`,
          }),
        });
      }),
    );
    this.updateTasks = {};
  }

  @backgroundMethod()
  async exitUpdateWorkflow() {
    this.closeUpdateWorkflowTracking();
    try {
      await cancelFirmwareArtifactPreparations();
    } finally {
      await this.updateTasksClear('exitUpdateWorkflow');
      await firmwareUpdateWorkflowRunningAtom.set(false);
    }
  }

  async cancelUpdateWorkflowIfExit() {
    const isRunning = await firmwareUpdateWorkflowRunningAtom.get();
    if (!isRunning) {
      throw new FirmwareUpdateExit();
    }
  }

  async waitDeviceRestart({
    releaseResult,
    actionType,
  }: {
    releaseResult: ICheckAllFirmwareReleaseResult | undefined;
    actionType: 'nextPhase' | 'retry' | 'ble-done' | 'boot-done' | 'done';
  }) {
    // use getFeatures to wait device reboot, not working, will pending forever
    // await this.backgroundApi.serviceHardware.getFeatures(
    //   params.connectId,
    //   {
    //     allowEmptyConnectId: true,
    //   },
    // );
    const hardwareTransportType =
      await this.backgroundApi.serviceSetting.getHardwareTransportType();
    if (actionType === 'nextPhase') {
      const isWebUsb = hardwareTransportType === EHardwareTransportType.WEBUSB;
      await timerUtils.wait(isWebUsb ? 20 * 1000 : 15 * 1000);
    }
    if (actionType === 'retry') {
      await timerUtils.wait(5 * 1000);
    }
    if (actionType === 'ble-done') {
      if (
        [EDeviceType.Touch, EDeviceType.Pro].includes(
          (releaseResult?.deviceType || '') as EDeviceType,
        )
      ) {
        await timerUtils.wait(15 * 1000);
      }
    }
    if (actionType === 'done') {
      await timerUtils.wait(
        releaseResult?.deviceType === EDeviceType.Mini ? 5 * 1000 : 2 * 1000,
      );
    }
    if (actionType === 'boot-done') {
      if (
        [EDeviceType.Touch, EDeviceType.Pro].includes(
          (releaseResult?.deviceType ?? '') as EDeviceType,
        )
      ) {
        await timerUtils.wait(20 * 1000);
      }
    }
  }

  @backgroundMethod()
  @toastIfError()
  async startUpdateWorkflow(params: IUpdateFirmwareWorkflowParams) {
    this.resetUpdateWorkflowTracking({
      updateFlow: 'v1',
      releaseResult: params.releaseResult,
    });
    const dbDevice = await localDb.getDeviceByQuery({
      connectId: params.releaseResult.originalConnectId, // TODO remove connectId check
    });
    if (!dbDevice) {
      // throw new OneKeyLocalError('device not found');
    }
    let transactionId: string | undefined;
    try {
      await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
        async () => {
          appEventBus.emit(EAppEventBusNames.BeginFirmwareUpdate, undefined);
          // await other hardware task stop processing
          await timerUtils.wait(3000);

          // Lock transport type during firmware update to prevent auto-switching
          // This prevents the system from switching to BLE when USB device is temporarily
          // unavailable during device reboot
          const currentTransportType =
            await this.backgroundApi.serviceSetting.getHardwareTransportType();
          await this.backgroundApi.serviceHardware.setForceTransportType({
            forceTransportType: currentTransportType,
          });
          serviceHardwareUtils.hardwareLog(
            'startUpdateWorkflow: locked transport type',
            currentTransportType,
          );

          try {
            // TODO verify current device is matched with params.connectId\params.updateFirmware\params.updateBle
            // pre checking
            await this.validateMnemonicBackuped(params);
            await this.validateUSBConnection(params);
            // must before validateMinVersionAllowed, go to https://help.onekey.so/
            await this.validateShouldUpdateFullResource(params);
            // go to https://firmware.onekey.so/
            await this.validateMinVersionAllowed(params);
            await this.validateDeviceBattery(params);
            await this.validateShouldUpdateBridge(params);

            const firmwareArtifacts =
              await this.prepareFirmwareWorkflowArtifacts(
                params.releaseResult,
                {
                  backuped: params.backuped,
                  usbConnected: params.usbConnected,
                },
              );
            const preparedArtifacts =
              getPreparedFirmwareArtifacts(firmwareArtifacts);
            transactionId = preparedArtifacts?.transactionId;

            // ** clear all retry tasks
            await this.updateTasksClear('startUpdateWorkflow');
            if (transactionId) {
              await firmwareUpdateJournal.markExecuting(transactionId);
            }

            let shouldRebootAfterUpdate = false;

            const waitRebootDelayForNextPhase = async () => {
              if (shouldRebootAfterUpdate) {
                await this.waitDeviceRestart({
                  actionType: 'nextPhase',
                  releaseResult: params.releaseResult,
                });
                shouldRebootAfterUpdate = false;
              }
            };

            // ** bootloader update
            await this.cancelUpdateWorkflowIfExit();
            if (params?.releaseResult?.updateInfos?.bootloader?.hasUpgrade) {
              await waitRebootDelayForNextPhase();
              await this.startUpdateBootloaderTask(params, firmwareArtifacts);

              shouldRebootAfterUpdate = true;

              // await hardware boot install and reboot
              // move sdk
              await this.waitDeviceRestart({
                actionType: 'boot-done',
                releaseResult: params.releaseResult,
              });
            }

            // TODO cancel workflow if modal closed or back

            // ** firmware update (including res update)
            if (params?.releaseResult?.updateInfos?.firmware?.hasUpgrade) {
              await waitRebootDelayForNextPhase();

              const deviceType = params?.releaseResult?.deviceType;
              // TODO recheck release if match with current connect device
              // TODO check update version gt current version
              // TODO check features matched
              await this.cancelUpdateWorkflowIfExit();
              await this.startUpdateFirmwareTaskBase(
                {
                  connectId: params?.releaseResult?.updatingConnectId,
                  version:
                    params?.releaseResult?.updateInfos?.firmware?.toVersion,
                  firmwareType: 'firmware',
                  deviceType,
                },
                params?.releaseResult?.updateInfos?.firmware,
                params,
                firmwareArtifacts,
              );

              shouldRebootAfterUpdate = true;
            }

            //  ble update
            if (params?.releaseResult?.updateInfos?.ble?.hasUpgrade) {
              await waitRebootDelayForNextPhase();

              const deviceType = params?.releaseResult?.deviceType;

              // TODO recheck release if match with current connect device
              await this.cancelUpdateWorkflowIfExit();
              await this.startUpdateFirmwareTaskBase(
                {
                  connectId: params?.releaseResult?.updatingConnectId,
                  version: params?.releaseResult?.updateInfos?.ble?.toVersion,
                  firmwareType: 'ble',
                  deviceType,
                },
                params?.releaseResult?.updateInfos?.ble,
                params,
                firmwareArtifacts,
              );

              shouldRebootAfterUpdate = true;

              await this.waitDeviceRestart({
                actionType: 'ble-done',
                releaseResult: params.releaseResult,
              });
            }

            serviceHardwareUtils.hardwareLog(
              'startUpdateWorkflow DONE',
              params,
            );

            await firmwareUpdateRetryAtom.set(undefined);
            if (
              transactionId &&
              preparedArtifacts?.plan.executor === 'v2' &&
              !params.releaseResult.originalConnectId
            ) {
              throw new OneKeyLocalError(
                'Firmware update final device identity is unavailable',
              );
            }
            if (params.releaseResult.originalConnectId) {
              await this.waitDeviceRestart({
                actionType: 'done',
                releaseResult: params.releaseResult,
              });
              if (transactionId && preparedArtifacts?.plan.executor === 'v2') {
                await this.verifyFirmwareRecoveryResult({
                  connectId: params.releaseResult.originalConnectId,
                  plan: preparedArtifacts.plan,
                  persistedDevice: dbDevice,
                });
              }
              await this.detectMap.deleteUpdateInfo({
                connectId: params.releaseResult.originalConnectId,
              });
              await this.backgroundApi.serviceHardware.updateDeviceVersionAfterFirmwareUpdate(
                params,
              );
              await this.clearOnceUpdateDevSettings();
              appEventBus.emit(
                EAppEventBusNames.FinishFirmwareUpdate,
                undefined,
              );
            }
            if (transactionId) {
              await firmwareUpdateJournal.markCompleted(transactionId);
              this.releaseFirmwareHostBinding(transactionId);
              this.firmwareCheckpointBindings.delete(transactionId);
            }
          } finally {
            // Always clear transport type lock when firmware update completes (success or failure)
            await this.backgroundApi.serviceHardware.clearForceTransportType();
            serviceHardwareUtils.hardwareLog(
              'startUpdateWorkflow: cleared transport type lock',
            );
            // Reset workflow running state at service level to prevent lock-screen bypass
            // This ensures the atom is reset even if the UI component has unmounted
            await firmwareUpdateWorkflowRunningAtom.set(false);
          }
        },
        {
          deviceParams: {
            dbDevice: dbDevice || ({} as any),
          },
          skipDeviceCancel: true,
          hideCheckingDeviceLoading: true,
          debugMethodName: 'startUpdateWorkflow',
        },
      );
    } catch (error) {
      if (transactionId) {
        await firmwareUpdateJournal.markFailure(transactionId, error);
        this.releaseFirmwareHostBinding(transactionId);
        const journal = await firmwareUpdateJournal
          .read()
          .catch(() => undefined);
        if (
          !journal ||
          journal.transactionId !== transactionId ||
          ['COMPLETED', 'FAILED', 'ABANDONED'].includes(journal.phase)
        ) {
          this.firmwareCheckpointBindings.delete(transactionId);
        }
      }
      throw error;
    }
  }

  @backgroundMethod()
  async clearHardwareUiStateBeforeStartUpdateWorkflow() {
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.FIRMWARE_TIP,
      connectId: '',
      payload: {} as any,
    });
    await firmwareUpdateResultVerifyAtom.set(undefined);
  }

  async completeUpdateWorkflow({
    params,
  }: {
    params: IUpdateFirmwareWorkflowParams;
  }) {
    const updateFirmwareInfo = params.releaseResult.updateInfos?.firmware;
    const { fromFirmwareType, toFirmwareType } = updateFirmwareInfo ?? {
      fromFirmwareType: undefined,
      toFirmwareType: undefined,
    };
    const needOnboarding =
      fromFirmwareType && toFirmwareType && fromFirmwareType !== toFirmwareType;

    await firmwareUpdateStepInfoAtom.set({
      step: EFirmwareUpdateSteps.updateDone,
      payload: {
        needOnboarding,
      },
    });

    try {
      const hardwareTransportType =
        await this.backgroundApi.serviceSetting.getHardwareTransportType();
      const trackingInfo = await this.getUpdateWorkflowTrackingInfo();

      defaultLogger.update.firmware.firmwareUpdateResult({
        deviceType: params.releaseResult.deviceType,
        transportType: hardwareTransportType,
        updateFlow: 'v2',
        firmwareVersions: parseFirmwareVersions(params.releaseResult),
        fromFirmwareType,
        toFirmwareType,
        status: 'success',
        retryCount: trackingInfo.retryCount,
        durationMs: trackingInfo.durationMs,
      });
    } catch (loggingError) {
      serviceHardwareUtils.hardwareLog(
        'completeUpdateWorkflow logging ERROR',
        loggingError,
      );
    }
  }

  async failUpdateWorkflow({
    params,
    error,
  }: {
    params: IUpdateFirmwareWorkflowParams;
    error: unknown;
  }) {
    const err = toPlainErrorObject(error as any);
    const updateFirmwareInfo = params.releaseResult.updateInfos?.firmware;

    serviceHardwareUtils.hardwareLog('startUpdateWorkflow ERROR', error);
    await firmwareUpdateStepInfoAtom.set({
      step: EFirmwareUpdateSteps.error,
      payload: {
        error: err,
      },
    });

    try {
      errorToastUtils.toastIfError(error);
      errorToastUtils.showToastOfError(error);
    } catch (toastError) {
      serviceHardwareUtils.hardwareLog(
        'failUpdateWorkflow toast ERROR',
        toastError,
      );
    }

    try {
      const hardwareTransportType =
        await this.backgroundApi.serviceSetting.getHardwareTransportType();
      const trackingInfo = await this.getUpdateWorkflowTrackingInfo();

      defaultLogger.update.firmware.firmwareUpdateResult({
        deviceType: params.releaseResult.deviceType,
        transportType: hardwareTransportType,
        updateFlow: 'v2',
        firmwareVersions: parseFirmwareVersions(params.releaseResult),
        fromFirmwareType: updateFirmwareInfo?.fromFirmwareType,
        toFirmwareType: updateFirmwareInfo?.toFirmwareType,
        status: 'failed',
        errorCode: err?.code,
        errorMessage: err?.message,
        retryCount: trackingInfo.retryCount,
        durationMs: trackingInfo.durationMs,
      });
    } catch (loggingError) {
      serviceHardwareUtils.hardwareLog(
        'failUpdateWorkflow logging ERROR',
        loggingError,
      );
    }
  }

  async runUpdateWorkflowV2(params: IUpdateFirmwareWorkflowParams) {
    let transactionId: string | undefined;
    try {
      await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
        async () => {
          let shouldClearForceTransportType = false;

          try {
            appEventBus.emit(EAppEventBusNames.BeginFirmwareUpdate, undefined);
            // await other hardware task stop processing
            await timerUtils.wait(3000);

            // Lock transport type during firmware update to prevent auto-switching
            const currentTransportType =
              await this.backgroundApi.serviceSetting.getHardwareTransportType();
            await this.backgroundApi.serviceHardware.setForceTransportType({
              forceTransportType: currentTransportType,
            });
            shouldClearForceTransportType = true;
            serviceHardwareUtils.hardwareLog(
              'startUpdateWorkflowV2: locked transport type',
              currentTransportType,
            );

            // pre checking
            await this.validateMnemonicBackuped(params);
            await this.validateUSBConnection(params);
            // must before validateMinVersionAllowed, go to https://help.onekey.so/
            await this.validateShouldUpdateFullResource(params);
            // go to https://firmware.onekey.so/
            await this.validateMinVersionAllowed(params);
            await this.validateDeviceBattery(params);
            await this.validateShouldUpdateBridge(params);

            const firmwareArtifacts =
              await this.prepareFirmwareWorkflowArtifacts(
                params.releaseResult,
                {
                  backuped: params.backuped,
                  usbConnected: params.usbConnected,
                },
              );
            const preparedArtifacts =
              getPreparedFirmwareArtifacts(firmwareArtifacts);
            transactionId = preparedArtifacts?.transactionId;

            // ** clear all retry tasks
            await this.updateTasksClear('startUpdateWorkflow');

            await this.cancelUpdateWorkflowIfExit();

            const deviceType = params?.releaseResult?.deviceType;
            if (
              deviceType !== EDeviceType.Pro &&
              deviceType !== EDeviceType.Pro2
            ) {
              throw new OneKeyLocalError(
                'Do not support update firmware for this device',
              );
            }
            if (transactionId) {
              await firmwareUpdateJournal.markExecuting(transactionId);
            }

            const updateResult =
              await this.startUpdateFirmwareTaskForNewBootVersion(
                params,
                firmwareArtifacts,
              );
            console.log(
              'startUpdateFirmwareTaskForNewBootVersion result: ===> ',
              updateResult,
            );

            serviceHardwareUtils.hardwareLog(
              'startUpdateWorkflow DONE',
              params,
            );

            await firmwareUpdateRetryAtom.set(undefined);
            if (params.releaseResult.originalConnectId) {
              await this.waitDeviceRestart({
                actionType: 'done',
                releaseResult: params.releaseResult,
              });
              await this.detectMap.deleteUpdateInfo({
                connectId: params.releaseResult.originalConnectId,
              });
              await this.backgroundApi.serviceHardware.updateDeviceVersionAfterFirmwareUpdate(
                params,
              );
              await this.clearOnceUpdateDevSettings();
              appEventBus.emit(
                EAppEventBusNames.FinishFirmwareUpdate,
                undefined,
              );
            }
            // wait verify
            await timerUtils.wait(2000);
            if (transactionId) {
              await firmwareUpdateJournal.markCompleted(transactionId);
              this.releaseFirmwareHostBinding(transactionId);
              this.firmwareCheckpointBindings.delete(transactionId);
            }
          } finally {
            if (shouldClearForceTransportType) {
              // Always clear transport type lock when firmware update completes
              await this.backgroundApi.serviceHardware.clearForceTransportType();
              serviceHardwareUtils.hardwareLog(
                'startUpdateWorkflowV2: cleared transport type lock',
              );
            }
          }
        },
        {
          deviceParams: {
            dbDevice: {} as any,
          },
          skipDeviceCancel: true,
          hideCheckingDeviceLoading: true,
          debugMethodName: 'startUpdateWorkflowV2',
        },
      );
    } catch (error) {
      if (transactionId) {
        await firmwareUpdateJournal.markFailure(transactionId, error);
        this.releaseFirmwareHostBinding(transactionId);
        const journal = await firmwareUpdateJournal
          .read()
          .catch(() => undefined);
        if (
          !journal ||
          journal.transactionId !== transactionId ||
          ['COMPLETED', 'FAILED', 'ABANDONED'].includes(journal.phase)
        ) {
          this.firmwareCheckpointBindings.delete(transactionId);
        }
      }
      throw error;
    } finally {
      // Reset workflow running state at service level to prevent lock-screen bypass
      await firmwareUpdateWorkflowRunningAtom.set(false);
    }
  }

  @backgroundMethod()
  async startUpdateWorkflowV2(
    params: IUpdateFirmwareWorkflowParams,
  ): Promise<IStartUpdateWorkflowV2Result> {
    this.resetUpdateWorkflowTracking({
      updateFlow: 'v2',
      releaseResult: params.releaseResult,
    });
    await firmwareUpdateWorkflowRunningAtom.set(true);

    void (async () => {
      try {
        await this.runUpdateWorkflowV2(params);
        await this.completeUpdateWorkflow({
          params,
        });
      } catch (error) {
        await this.failUpdateWorkflow({
          params,
          error,
        });
      }
    })().catch((error) => {
      serviceHardwareUtils.hardwareLog(
        'startUpdateWorkflowV2 background task handler ERROR',
        error,
      );
    });

    return { backgroundTaskStarted: true };
  }

  async startUpdateBootloaderTask(
    params: IUpdateFirmwareWorkflowParams,
    firmwareArtifacts?: IFirmwareWorkflowArtifacts,
  ) {
    const firmwareUpdateInfo = params?.releaseResult?.updateInfos?.firmware;
    const firmwareToVersion = firmwareUpdateInfo?.toVersion;
    if (!firmwareUpdateInfo || !firmwareToVersion) {
      return;
    }
    const features =
      await this.backgroundApi.serviceHardware.getFeaturesWithoutCache({
        connectId: params.releaseResult.updatingConnectId,
        params: {
          allowEmptyConnectId: true,
        },
      });

    // TODO move to fn
    const releaseInfo = await this.loadBaseFirmwareRelease({
      connectId: params?.releaseResult?.updatingConnectId,
      firmwareType:
        params?.releaseResult?.updateInfos?.firmware?.toFirmwareType,
    });
    const updateInfo = await this.checkBootloaderRelease({
      features,
      connectId: params.releaseResult.updatingConnectId,
      firmwareUpdateInfo,
      bootloaderReleasePayload:
        releaseInfo.bootloader as unknown as IBootloaderReleasePayload,
    });
    // TODO mock boot re-update
    // if (release) {
    //   release.shouldUpdate = true;
    // }

    const mockUpdateBootloader =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'forceUpdateBootloader',
      );
    // TODO check update version gt current version
    if (updateInfo?.hasUpgrade || mockUpdateBootloader) {
      return this.createRunTaskWithRetry({
        fn: async () =>
          this.updatingBootloader(params, updateInfo, firmwareArtifacts),
      });
    }
  }

  async startUpdateFirmwareTaskBase(
    params: IAutoUpdateFirmwareParams,
    updateInfo: IBleFirmwareUpdateInfo | IFirmwareUpdateInfo,
    workflowParams: IUpdateFirmwareWorkflowParams,
    firmwareArtifacts?: IFirmwareWorkflowArtifacts,
  ) {
    return this.createRunTaskWithRetry({
      fn: async () =>
        this.updatingFirmware(
          params,
          updateInfo,
          workflowParams,
          firmwareArtifacts,
        ),
    });
  }

  createRunTaskWithRetry({ fn }: { fn: IUpdateFirmwareTaskFn }) {
    return new Promise((resolve, reject) => {
      const id = this.updateTasksAdd({ fn, reject, resolve });
      void this.runUpdateTask({ id });
    });
  }

  @backgroundMethod()
  async runUpdateTask({
    id,
    preFn,
  }: {
    id: number;
    preFn?: (params?: undefined) => Promise<void | undefined>;
  }): Promise<void> {
    const task = this.updateTasks[id];
    if (!task || !this.isUpdateWorkflowCurrent(task.workflowId)) {
      return;
    }

    try {
      await this.cancelUpdateWorkflowIfExit();
    } catch (error) {
      await this.updateTasksReject({ id, error });
      return;
    }

    try {
      await firmwareUpdateRetryAtom.set(undefined);

      await preFn?.();
      if (!this.isUpdateWorkflowCurrent(task.workflowId)) {
        return;
      }

      const result = await task.fn({ id });
      if (!this.isUpdateWorkflowCurrent(task.workflowId)) {
        return;
      }
      await this.updateTasksResolve({ id, data: result });
      serviceHardwareUtils.hardwareLog('runUpdateTask SUCCESS', result);
      if (task.workflowId !== undefined) {
        void this.trackUpdateTaskAttemptResult({
          workflowId: task.workflowId,
          status: 'success',
        });
      }
    } catch (error) {
      if (!this.isUpdateWorkflowCurrent(task.workflowId)) {
        return;
      }
      if (task.workflowId !== undefined) {
        this.pauseUpdateWorkflowTracking(task.workflowId);
      }
      serviceHardwareUtils.hardwareLog('startUpdateWorkflow ERROR', error);

      // OK-57543: track each real attempt even when a later retry succeeds
      if (task.workflowId !== undefined) {
        void this.trackUpdateTaskAttemptResult({
          workflowId: task.workflowId,
          status: 'failed',
          error,
        });
      }

      // never reject here, we should use retry
      // await servicePromise.rejectCallback({ id, error });
      await firmwareUpdateRetryAtom.set({
        id,
        error: toPlainErrorObject(error as any),
      });

      await this.backgroundApi.serviceHardwareUI.closeHardwareUiStateDialog({
        skipDeviceCancel: true,
        connectId: '',
      });

      // TODO hide deviceCheckingLoading and confirm dialog
    } finally {
      if (this.isUpdateWorkflowCurrent(task.workflowId)) {
        try {
          await this.cancelUpdateWorkflowIfExit();
          // Workflow is still alive (not exited by user), but in retry wait state
          // Allow lock screen since no active hardware communication is happening
          const retryInfo = await firmwareUpdateRetryAtom.get();
          if (retryInfo) {
            await firmwareUpdateWorkflowRunningAtom.set(false);
          }
        } catch (error2) {
          await this.updateTasksReject({ id, error: error2 });
        }
      }
    }
  }

  @backgroundMethod()
  async retryUpdateTask({
    id,
    connectId,
    releaseResult,
  }: {
    id: number;
    // TODO put connectId to updateTasks
    connectId: string | undefined;
    releaseResult: ICheckAllFirmwareReleaseResult | undefined;
  }) {
    const task = this.updateTasks[id];
    if (!task || !this.isUpdateWorkflowCurrent(task.workflowId)) {
      return;
    }
    if (task.workflowId !== undefined) {
      this.resumeUpdateWorkflowTracking(task.workflowId);
      this.recordUpdateWorkflowRetry(task.workflowId);
    }

    // Re-block lock screen before resuming hardware communication
    await firmwareUpdateWorkflowRunningAtom.set(true);

    await firmwareUpdateRetryAtom.set(undefined);

    await this.waitDeviceRestart({
      releaseResult,
      actionType: 'retry',
    });

    await this.runUpdateTask({
      id,
      preFn: makeTimeoutPromise({
        asyncFunc: async () => {
          // make sure device is ready after reboot
          // TODO move to fn and re-checking release \ device \ version matched
          try {
            const features =
              await this.backgroundApi.serviceHardware.getFeaturesWithoutCache({
                connectId,
                params: {
                  allowEmptyConnectId: true,
                },
              });
            serviceHardwareUtils.hardwareLog('retryUpdateTask', {
              connectId,
              features,
            });
          } catch (error) {
            await firmwareUpdateStepInfoAtom.set({
              step: EFirmwareUpdateSteps.installing,
              payload: {
                installingTarget: {
                  totalPhase: releaseResult?.totalPhase,
                  currentPhase: '',
                  updateInfo: releaseResult?.updateInfos,
                } as any,
              },
            });
            throw error;
          }
        },
        timeout: timerUtils.getTimeDurationMs({
          // user may retry just when device reboot, getFeatures() will pending forever, so we need timeout reject, then user can see retry button
          seconds: 30,
        }),
        timeoutRejectError: new Error('Retry Timeout'),
      }),
    });
  }

  checkTouchNeedUpdateResource(
    params: IUpdateFirmwareWorkflowParams,
  ): IResourceUpdateInfo {
    const deviceType = params.releaseResult?.deviceType;
    const fwUpdateInfo = params.releaseResult?.updateInfos?.firmware;
    const fwRelease = fwUpdateInfo?.releasePayload?.release;
    if (fwRelease) {
      const { version, fullResourceRange = ['3.5.0', '3.5.0'] } = fwRelease;
      if (deviceType !== EDeviceType.Touch) {
        return { error: null, needUpdate: false };
      }
      const currentVersion = fwUpdateInfo.fromVersion;
      const targetVersion = version.join('.');
      const [minVersion, limitVersion] = fullResourceRange;
      if (
        currentVersion &&
        targetVersion &&
        minVersion &&
        limitVersion &&
        semver.lt(currentVersion, minVersion) &&
        semver.gte(targetVersion, limitVersion)
      ) {
        return {
          error: !platformEnv.isDesktop ? 'USE_DESKTOP' : null,
          needUpdate: true,
          minVersion,
          limitVersion,
        };
      }
    }

    return { error: null, needUpdate: false };
  }

  async startUpdateFirmwareTaskForNewBootVersion(
    params: IUpdateFirmwareWorkflowParams,
    firmwareArtifacts?: IFirmwareWorkflowArtifacts,
  ): Promise<IFirmwareUpdateResult> {
    const { releaseResult } = params;
    const { updateInfos } = releaseResult;
    const plan = this.getFirmwareUpdatePlan(releaseResult);

    const updateParams: IFirmwareUpdateV3VersionParams = {
      connectId: releaseResult.updatingConnectId,
      bleVersion: updateInfos.ble?.hasUpgrade
        ? updateInfos.ble?.toVersion
        : undefined,
      firmwareVersion: updateInfos.firmware?.hasUpgrade
        ? updateInfos.firmware?.toVersion
        : undefined,
      bootloaderVersion: updateInfos.bootloader?.hasUpgrade
        ? updateInfos.bootloader?.toVersion
        : undefined,
      firmwareType: updateInfos.firmware?.toFirmwareType,
    };
    if (plan.executor === 'v4') {
      const targetsToUpdate = plan.targetsToUpdate.filter(
        (target): target is FirmwareUpdateV4Target =>
          FIRMWARE_UPDATE_V4_TARGETS.has(target as FirmwareUpdateV4Target),
      );
      if (targetsToUpdate.length !== plan.targetsToUpdate.length) {
        throw new OneKeyLocalError(
          'Protocol V2 firmware update plan contains an invalid target',
        );
      }
      return this.createRunTaskWithRetry({
        fn: async () =>
          this.updatingFirmwareV4(
            {
              ...updateParams,
              targetsToUpdate,
            },
            firmwareArtifacts,
          ),
      }) as Promise<IFirmwareUpdateResult>;
    }
    if (plan.executor !== 'v3') {
      throw new OneKeyLocalError(
        'Firmware update plan selected an incompatible executor',
      );
    }
    return this.createRunTaskWithRetry({
      fn: async () => this.updatingFirmwareV3(updateParams, firmwareArtifacts),
    }) as Promise<IFirmwareUpdateResult>;
  }

  async updatingFirmwareV4(
    params: IFirmwareUpdateV4AppParams,
    firmwareArtifacts?: IFirmwareWorkflowArtifacts,
  ): Promise<Success> {
    const preparedArtifacts = getPreparedFirmwareArtifacts(firmwareArtifacts);
    const bridgeBinaries = getBridgeFirmwareBinaries(firmwareArtifacts);
    if (platformEnv.isNative && !preparedArtifacts) {
      throw new OneKeyLocalError(
        'Protocol V2 firmware artifacts are not prepared',
      );
    }
    const hardwareSDK = await this.getSDKInstance({
      connectId: params.connectId,
    });

    return this.withFirmwareUpdateEvents(async () => {
      await firmwareUpdateStepInfoAtom.set({
        step: EFirmwareUpdateSteps.installing,
        payload: {
          installingTarget: {} as any,
        },
      });
      const currentTransportType =
        await this.backgroundApi.serviceSetting.getHardwareTransportType();
      if (
        platformEnv.isDesktop &&
        isDirectFirmwareHostBindingTransport(currentTransportType) &&
        !preparedArtifacts
      ) {
        throw new OneKeyLocalError(
          'Protocol V2 firmware artifacts are not prepared',
        );
      }
      const updatingConnectId = deviceUtils.getUpdatingConnectId({
        connectId: params.connectId,
        currentTransportType,
      });
      const updateResult = await convertDeviceResponse(() =>
        hardwareSDK.firmwareUpdateV4(updatingConnectId, {
          platform: platformEnv.symbol ?? 'web',
          firmwareType: params.firmwareType,
          targetsToUpdate: params.targetsToUpdate,
          ...getBridgeFirmwareV4BinaryParams(bridgeBinaries),
          ...(preparedArtifacts
            ? {
                preparedPlan: preparedArtifacts.preparedPlan,
                expectedDeviceId: preparedArtifacts.plan.deviceIdentity,
                expectedTargetVersions: Object.fromEntries(
                  preparedArtifacts.plan.artifacts.flatMap((artifact) =>
                    artifact.targetVersion &&
                    FIRMWARE_UPDATE_V4_TARGETS.has(
                      artifact.target as FirmwareUpdateV4Target,
                    )
                      ? [
                          [
                            artifact.target as FirmwareUpdateV4Target,
                            artifact.targetVersion,
                          ] as const,
                        ]
                      : [],
                  ),
                ),
                componentArtifacts:
                  preparedArtifacts.selected.componentArtifacts,
                resourceBundleArtifacts:
                  preparedArtifacts.selected.resourceBundleArtifacts,
                ...this.getFirmwareCheckpointParams(preparedArtifacts),
              }
            : {}),
        }),
      );

      await firmwareUpdateResultVerifyAtom.set({
        finalBleVersion: updateResult?.bleVersion || '',
        finalFirmwareVersion: updateResult?.firmwareVersion || '',
        finalBootloaderVersion: updateResult?.bootloaderVersion || '',
      });
      return { message: 'success', ...updateResult };
    });
  }

  async updatingFirmwareV3(
    params: IFirmwareUpdateV3VersionParams,
    firmwareArtifacts?: IFirmwareWorkflowArtifacts,
  ): Promise<Success> {
    const preparedArtifacts = getPreparedFirmwareArtifacts(firmwareArtifacts);
    const bridgeBinaries = getBridgeFirmwareBinaries(firmwareArtifacts);
    const hardwareSDK = await this.getSDKInstance({
      connectId: params.connectId,
    });

    return this.withFirmwareUpdateEvents(async () => {
      const { connectId } = params;
      await firmwareUpdateStepInfoAtom.set({
        step: EFirmwareUpdateSteps.installing,
        payload: {
          installingTarget: {} as any,
        },
      });

      const convertVersion = (version?: string) => {
        if (version && semver.valid(version)) {
          return version.split('.').map((v) => parseInt(v, 10));
        }
        return undefined;
      };

      const toFirmwareVersion = convertVersion(params.firmwareVersion);
      const toBleVersion = convertVersion(params.bleVersion);
      const toBootloaderVersion = convertVersion(params.bootloaderVersion);
      const versionMismatches: string[] = [];

      try {
        const currentTransportType =
          await this.backgroundApi.serviceSetting.getHardwareTransportType();
        const updateResult = await convertDeviceResponse(async () => {
          const updatingConnectId = deviceUtils.getUpdatingConnectId({
            connectId,
            currentTransportType,
          });
          if (preparedArtifacts) {
            return (
              hardwareSDK.firmwareUpdateV3 as unknown as (
                id: string | undefined,
                updateParams: {
                  preparedPlan: FirmwareUpdatePreparedPlan;
                  platform: string;
                  bleVersion: number[] | undefined;
                  firmwareVersion: number[] | undefined;
                  bootloaderVersion: number[] | undefined;
                  firmwareType: EFirmwareType | undefined;
                  hostBindingGeneration: number;
                  checkpointSequenceStart: number;
                  resumeCheckpoint?: FirmwareCheckpoint;
                  artifacts: {
                    ble?: IFirmwareArtifactReference;
                    firmware?: IFirmwareArtifactReference;
                    bootloader?: IFirmwareArtifactReference;
                    resourceEntries?: readonly {
                      entryName: string;
                      artifact: IFirmwareArtifactReference;
                    }[];
                  };
                },
              ) => ReturnType<CoreApi['firmwareUpdateV3']>
            )(updatingConnectId, {
              preparedPlan: preparedArtifacts.preparedPlan,
              platform: platformEnv.symbol ?? 'web',
              bleVersion: toBleVersion,
              firmwareVersion: toFirmwareVersion,
              bootloaderVersion: toBootloaderVersion,
              firmwareType: params.firmwareType,
              ...this.getFirmwareCheckpointParams(preparedArtifacts),
              artifacts: {
                ...(preparedArtifacts.selected.ble
                  ? { ble: preparedArtifacts.selected.ble }
                  : {}),
                ...(preparedArtifacts.selected.firmware
                  ? { firmware: preparedArtifacts.selected.firmware }
                  : {}),
                ...(preparedArtifacts.selected.bootloader
                  ? { bootloader: preparedArtifacts.selected.bootloader }
                  : {}),
                ...(preparedArtifacts.selected.resourceEntries
                  ? {
                      resourceEntries:
                        preparedArtifacts.selected.resourceEntries,
                    }
                  : {}),
              },
            });
          }
          return hardwareSDK.firmwareUpdateV3(updatingConnectId, {
            platform: platformEnv.symbol ?? 'web',
            bleVersion: toBleVersion,
            firmwareVersion: toFirmwareVersion,
            bootloaderVersion: toBootloaderVersion,
            firmwareType: params.firmwareType,
            ...getBridgeFirmwareV3BinaryParams(bridgeBinaries),
          });
        });

        // verify final version
        await firmwareUpdateResultVerifyAtom.set({
          finalBleVersion: updateResult?.bleVersion || '',
          finalFirmwareVersion: updateResult?.firmwareVersion || '',
          finalBootloaderVersion: updateResult?.bootloaderVersion || '',
        });

        const verifyVersion = (
          expectedVersionStr: string | undefined,
          actualVersionStr: string | undefined,
        ) => {
          if (expectedVersionStr && semver.valid(expectedVersionStr)) {
            if (
              !actualVersionStr ||
              !semver.valid(actualVersionStr) ||
              !semver.eq(actualVersionStr, expectedVersionStr)
            ) {
              versionMismatches.push(expectedVersionStr);
            }
          }
        };

        verifyVersion(
          toFirmwareVersion?.join('.'),
          updateResult?.firmwareVersion,
        );
        verifyVersion(toBleVersion?.join('.'), updateResult?.bleVersion);
        verifyVersion(
          toBootloaderVersion?.join('.'),
          updateResult?.bootloaderVersion,
        );

        // wait for 1.5s to verify
        await timerUtils.wait(1500);

        if (versionMismatches.length > 0) {
          throw new FirmwareUpdateVersionMismatchError();
        }

        return { message: 'success', ...updateResult };
      } catch (error) {
        console.log('updatingFirmwareV3 error: ', error);
        throw error;
      }
    });
  }

  async validateShouldUpdateFullResource(
    params: IUpdateFirmwareWorkflowParams,
  ) {
    const mockShouldUpdateFullRes =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'shouldUpdateFullRes',
      );
    if (
      mockShouldUpdateFullRes === true ||
      this.checkTouchNeedUpdateResource(params).needUpdate
    ) {
      throw new UseDesktopToUpdateFirmware();
    }
  }

  async validateShouldUpdateBridge(params: IUpdateFirmwareWorkflowParams) {
    if (params?.releaseResult?.updateInfos?.bridge?.shouldUpdate) {
      throw new NeedOneKeyBridgeUpgrade();
    }
  }

  async validateMinVersionAllowed(params: IUpdateFirmwareWorkflowParams) {
    const minVersionMap = FIRMWARE_UPDATE_MIN_VERSION_ALLOWED;

    const mockShouldUpdateFromWeb =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'shouldUpdateFromWeb',
      );

    if (mockShouldUpdateFromWeb === true) {
      throw new NeedFirmwareUpgradeFromWeb();
    }

    const deviceType = params.releaseResult?.deviceType;

    const checkFn = ({
      updateInfo,
      minVersion,
    }: {
      updateInfo: IFirmwareUpdateInfo | IBootloaderUpdateInfo | undefined;
      minVersion: string | undefined;
    }) => {
      if (
        deviceType &&
        updateInfo?.hasUpgrade &&
        updateInfo?.fromVersion &&
        minVersion &&
        semver.lt(updateInfo?.fromVersion || '', minVersion || '')
      ) {
        throw new NeedFirmwareUpgradeFromWeb();
      }
    };

    // bootloader mode device may return wrong firmware current version. so we skip this check
    if (params.releaseResult?.isBootloaderMode) {
      // only check bootloader version at boot mode
      checkFn({
        updateInfo: params.releaseResult?.updateInfos?.bootloader,
        minVersion: minVersionMap?.[deviceType || 'unknown']?.bootloader,
      });
      if (
        params.releaseResult?.updateInfos?.bootloader?.hasUpgrade &&
        !params.releaseResult?.updateInfos?.bootloader?.fromVersion
      ) {
        throw new NeedFirmwareUpgradeFromWeb();
      }
      return;
    }

    checkFn({
      updateInfo: params.releaseResult?.updateInfos?.firmware,
      minVersion: minVersionMap?.[deviceType || 'unknown']?.firmware,
    });

    checkFn({
      updateInfo: params.releaseResult?.updateInfos?.ble,
      minVersion: minVersionMap?.[deviceType || 'unknown']?.ble,
    });

    const updateDevDeviceBootloaderOnAppAllowed =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'updateDevDeviceBootloaderOnAppAllowed',
      );

    if (updateDevDeviceBootloaderOnAppAllowed !== true) {
      checkFn({
        updateInfo: params.releaseResult?.updateInfos?.bootloader,
        minVersion:
          minVersionMap?.[deviceType || 'unknown']?.bootloader || '2.0.0',
      });
    }
  }

  async validateMnemonicBackuped(params: IUpdateFirmwareWorkflowParams) {
    if (!params.backuped) {
      throw new OneKeyLocalError('mnemonic not backuped');
    }
  }

  async validateUSBConnection(params: IUpdateFirmwareWorkflowParams) {
    // TODO device is connected by USB
    if (!params.usbConnected) {
      throw new OneKeyLocalError('USB not connected');
    }
  }

  async validateDeviceBattery(params: IUpdateFirmwareWorkflowParams) {
    // USB connected, skip battery check
    if (!platformEnv.isNative) {
      return;
    }

    const { features: deviceFeatures } = params.releaseResult;

    let batteryLevel: number | undefined = deviceFeatures?.battery_level;

    const mockLowBattery =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'lowBatteryLevel',
      );
    if (mockLowBattery === true) {
      batteryLevel = 1;
    }

    if (isNil(batteryLevel) || Number.isNaN(batteryLevel)) return;

    // <= 25%
    if (Number(batteryLevel ?? 0) <= FIRMWARE_UPDATE_MIN_BATTERY_LEVEL) {
      throw new FirmwareUpdateBatteryTooLow();
    }
  }
}

export default ServiceFirmwareUpdate;
