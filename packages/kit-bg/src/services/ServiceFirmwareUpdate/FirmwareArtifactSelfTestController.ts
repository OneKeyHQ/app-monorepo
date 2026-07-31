import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { isDirectFirmwareHostBindingTransport } from '@onekeyhq/shared/src/hardware/instance';
import { importHardwareSDK } from '@onekeyhq/shared/src/hardware/sdk-loader';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

import {
  executeFirmwareArtifactSelfTest,
  getFirmwareArtifactSelfTestArtifact,
  getFirmwareArtifactSelfTestErrorCode,
  getFirmwareArtifactSelfTestPlatform,
} from './FirmwareArtifactSelfTest';
import { getTrustedFirmwareConfig } from './trustedFirmwareCatalog';

import type {
  IFirmwareArtifactSelfTestPhase,
  IFirmwareArtifactSelfTestProgress,
  IFirmwareArtifactSelfTestResult,
  IFirmwareArtifactSelfTestScenario,
  IFirmwareArtifactSelfTestState,
} from './FirmwareArtifactSelfTest';
import type { FirmwarePreparedArtifactController } from './FirmwarePreparedArtifactController';
import type { CoreApi } from '@onekeyfe/hd-core';

type IFirmwareArtifactSelfTestControllerDependencies = {
  getHardwareTransportType: () => Promise<EHardwareTransportType>;
  getSDKInstance: () => Promise<CoreApi>;
};

export class FirmwareArtifactSelfTestController {
  private state?: IFirmwareArtifactSelfTestState;

  constructor(
    private readonly dependencies: IFirmwareArtifactSelfTestControllerDependencies,
    private readonly preparedArtifacts: FirmwarePreparedArtifactController,
  ) {}

  private updateState({
    phase,
    progress,
    bytesRead,
    chunkCount,
    materializedEntryCount,
    preflightCompletedIterations,
  }: IFirmwareArtifactSelfTestProgress): void {
    const current = this.state;
    if (!current || current.status !== 'running') return;
    const next = {
      ...current,
      phase,
      progress,
      updatedAt: Date.now(),
      bytesRead: bytesRead ?? current.bytesRead,
      chunkCount: chunkCount ?? current.chunkCount,
      materializedEntryCount:
        materializedEntryCount ?? current.materializedEntryCount,
      preflightCompletedIterations:
        preflightCompletedIterations ?? current.preflightCompletedIterations,
    };
    this.state = next;
    const enteredNewPhase = phase !== current.phase;
    const enteredNewProgressBucket =
      Math.floor(progress / 5) !== Math.floor(current.progress / 5);
    if (enteredNewPhase || enteredNewProgressBucket) {
      this.log({ state: next, outcome: 'progress' });
    }
  }

  private log({
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
      preflightCompletedIterations:
        state.preflightCompletedIterations || undefined,
      preparedPlanValidated: state.preparedPlanValidated || undefined,
      sdkHandoffValidated: state.sdkHandoffValidated || undefined,
      cleanupValidated: state.cleanupValidated || undefined,
      failureCleanupValidated: state.failureCleanupValidated || undefined,
      sdkBoundaryCode: state.sdkBoundaryCode,
      errorCode: state.errorCode,
    });
  }

  private async getSdk(): Promise<{
    sdk: CoreApi;
    disposeAfterTest: boolean;
  }> {
    if (!platformEnv.isDesktop) {
      return {
        sdk: await this.dependencies.getSDKInstance(),
        disposeAfterTest: false,
      };
    }
    const transportType = await this.dependencies.getHardwareTransportType();
    if (isDirectFirmwareHostBindingTransport(transportType)) {
      return {
        sdk: await this.dependencies.getSDKInstance(),
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
      preloadedConfig: await getTrustedFirmwareConfig({ preRelease: false }),
    });
    if (!initialized) {
      throw new OneKeyLocalError(
        'Firmware SDK self-test direct instance failed to initialize',
      );
    }
    return { sdk, disposeAfterTest: true };
  }

  private finish({
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
    const current = this.state;
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
      preflightCompletedIterations:
        result?.preflightCompletedIterations ??
        current.preflightCompletedIterations,
      preparedPlanValidated:
        result?.preparedPlanValidated ?? current.preparedPlanValidated,
      sdkHandoffValidated:
        result?.sdkHandoffValidated ?? current.sdkHandoffValidated,
      cleanupValidated: result?.cleanupValidated ?? current.cleanupValidated,
      failureCleanupValidated:
        result?.failureCleanupValidated ?? current.failureCleanupValidated,
      sdkBoundaryCode: result?.sdkBoundaryCode ?? current.sdkBoundaryCode,
      deletedFiles: result?.deletedFiles ?? current.deletedFiles,
      deletedBytes: result?.deletedBytes ?? current.deletedBytes,
      errorCode,
    };
    this.state = next;
    let outcome: 'success' | 'failure' | 'cancelled' = 'failure';
    if (status === 'completed') {
      outcome = 'success';
    } else if (status === 'cancelled') {
      outcome = 'cancelled';
    }
    this.log({ state: next, outcome });
  }

  async start(
    scenario: IFirmwareArtifactSelfTestScenario,
  ): Promise<IFirmwareArtifactSelfTestState> {
    if (this.state?.status === 'running') {
      throw new OneKeyLocalError(
        'Another firmware artifact self-test is already running',
      );
    }
    const runId = generateUUID();
    // cspell:disable-next-line
    const transactionId = `fwtx:${runId}`;
    const now = Date.now();
    const state: IFirmwareArtifactSelfTestState = {
      runId,
      descriptor: (await getFirmwareArtifactSelfTestArtifact(scenario))
        .descriptor,
      platform: getFirmwareArtifactSelfTestPlatform(),
      status: 'running',
      phase: 'starting',
      progress: 0,
      startedAt: now,
      updatedAt: now,
      bytesRead: 0,
      chunkCount: 0,
      materializedEntryCount: 0,
      preflightCompletedIterations: 0,
      preparedPlanValidated: false,
      sdkHandoffValidated: false,
      cleanupValidated: false,
      failureCleanupValidated: false,
      deletedFiles: 0,
      deletedBytes: 0,
    };
    this.state = state;
    this.log({ state, outcome: 'started' });
    void this.getSdk()
      .then(async ({ sdk, disposeAfterTest }) => {
        try {
          return await executeFirmwareArtifactSelfTest({
            scenario,
            transactionId,
            sdk,
            controller: this.preparedArtifacts,
            onProgress: (next) => this.updateState(next),
          });
        } finally {
          if (disposeAfterTest) {
            await sdk.dispose();
          }
        }
      })
      .then((result) => {
        this.finish({
          phase: 'completed',
          status: 'completed',
          result,
        });
      })
      .catch((error) => {
        const errorCode = getFirmwareArtifactSelfTestErrorCode(error);
        const cancelled = errorCode === 'ARTIFACT_CANCELLED';
        this.finish({
          phase: cancelled ? 'cancelled' : 'failed',
          status: cancelled ? 'cancelled' : 'failed',
          errorCode,
        });
      });
    return state;
  }

  getState(): IFirmwareArtifactSelfTestState | undefined {
    return this.state;
  }
}
