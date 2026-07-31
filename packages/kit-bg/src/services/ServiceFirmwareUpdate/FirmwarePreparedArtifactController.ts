import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { isDirectFirmwareHostBindingTransport } from '@onekeyhq/shared/src/hardware/instance';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import { firmwareArtifactAdapter } from './FirmwareArtifactAdapter';
import {
  isExternalFirmwareCapabilityReady,
  isFirmwareArtifactCapabilityReady,
  prepareBridgeFirmwareBinaries,
  prepareFirmwareArtifacts,
  withFirmwareArtifactStageTimeout,
} from './FirmwareArtifactPreflight';
import { firmwareUpdateTrace } from './FirmwareUpdateTrace';

import type {
  IBridgeFirmwareBinaries,
  IPreparedFirmwareArtifacts,
} from './FirmwareArtifactPreflight';
import type {
  CoreApi,
  FirmwareUpdatePlan,
  FirmwareUpdatePlanForceTarget,
} from '@onekeyfe/hd-core';

export type IFirmwareWorkflowArtifacts =
  | IPreparedFirmwareArtifacts
  | IBridgeFirmwareBinaries;

export type IFirmwareExecutionArtifacts = {
  preparedArtifacts?: IPreparedFirmwareArtifacts;
  bridgeBinaries?: IBridgeFirmwareBinaries;
  hostBindingGeneration?: number;
};

export type IFirmwarePreparedArtifactReleaseResult = {
  hostBindingReleased: boolean;
  leaseReleased: boolean;
};

type IFirmwareHostBinding = {
  sdk: CoreApi;
  generation: number;
};

type IFirmwarePreparedArtifactControllerDependencies = {
  getHardwareTransportType: () => Promise<EHardwareTransportType>;
  getSDKInstance: (connectId: string | undefined) => Promise<CoreApi>;
};

const getPreparedArtifactTraceSummary = (
  prepared: IPreparedFirmwareArtifacts,
) => {
  const artifactReferences = Object.values(prepared.artifactsById ?? {});
  const resourceEntries = prepared.selected.resourceEntries ?? [];
  return {
    count: artifactReferences.length,
    bytes: artifactReferences.reduce(
      (total, artifact) => total + artifact.size,
      0,
    ),
    firmwareBytes: prepared.selected.firmware?.size,
    bleBytes: prepared.selected.ble?.size,
    bootloaderBytes: prepared.selected.bootloader?.size,
    resourceCount:
      resourceEntries.length + prepared.selected.resourceBundleArtifacts.length,
    resourceBytes:
      resourceEntries.reduce((total, entry) => total + entry.artifact.size, 0) +
      prepared.selected.resourceBundleArtifacts.reduce(
        (total, entry) => total + entry.artifact.size,
        0,
      ),
    integrityVerified:
      artifactReferences.length > 0 &&
      artifactReferences.every(
        (artifact) =>
          artifact.size > 0 &&
          typeof artifact.sha256 === 'string' &&
          artifact.sha256.length > 0,
      ),
  };
};

const getBridgeArtifactTraceSummary = (bridge: IBridgeFirmwareBinaries) => {
  const binaries = Object.values(bridge.targetBinaries).filter(
    (binary): binary is ArrayBuffer => binary !== undefined,
  );
  const firmware = bridge.targetBinaries.firmware;
  const ble = bridge.targetBinaries.ble;
  const bootloader = bridge.targetBinaries.bootloader;
  return {
    count: binaries.length,
    bytes: binaries.reduce((total, binary) => total + binary.byteLength, 0),
    firmwareBytes: firmware?.byteLength,
    bleBytes: ble?.byteLength,
    bootloaderBytes: bootloader?.byteLength,
    resourceCount: 0,
    resourceBytes: 0,
    integrityVerified: binaries.length > 0,
  };
};

const assertFirmwareUpdatePlanCoverage = ({
  plan,
  expectedTargets,
}: {
  plan: FirmwareUpdatePlan;
  expectedTargets: readonly FirmwareUpdatePlanForceTarget[];
}): void => {
  if (
    !Array.isArray(plan.artifacts) ||
    plan.artifacts.length === 0 ||
    !Array.isArray(plan.targetsToUpdate) ||
    plan.targetsToUpdate.length === 0
  ) {
    throw new OneKeyLocalError(
      'Firmware update plan has no executable artifacts',
    );
  }

  const artifactTargets = new Set(
    plan.artifacts.map((artifact) => artifact.target),
  );
  const planTargets = new Set(plan.targetsToUpdate);
  if (
    [...artifactTargets].some((target) => !planTargets.has(target)) ||
    [...planTargets].some((target) => !artifactTargets.has(target))
  ) {
    throw new OneKeyLocalError(
      'Firmware update plan target coverage is incomplete',
    );
  }

  const coversExpectedTarget = (
    expectedTarget: FirmwareUpdatePlanForceTarget,
  ) => {
    switch (expectedTarget) {
      case 'firmware':
        return plan.artifacts.some(
          (artifact) =>
            artifact.role === 'firmware' ||
            (artifact.role === 'component' && artifact.target !== 'resource'),
        );
      case 'ble':
        return plan.artifacts.some((artifact) => artifact.role === 'ble');
      case 'bootloader':
        return plan.artifacts.some(
          (artifact) =>
            artifact.role === 'bootloader' ||
            (artifact.role === 'component' && artifact.target === 'boot'),
        );
      case 'resource':
        return plan.artifacts.some(
          (artifact) =>
            artifact.role === 'resource' || artifact.role === 'resourceBundle',
        );
      default:
        return false;
    }
  };

  if (
    [...new Set(expectedTargets)].some(
      (expectedTarget) => !coversExpectedTarget(expectedTarget),
    )
  ) {
    throw new OneKeyLocalError(
      'Firmware update plan does not cover every selected target',
    );
  }
};

export class FirmwarePreparedArtifactController {
  private plans = new Map<string, FirmwareUpdatePlan>();

  private hostBindings = new Map<string, IFirmwareHostBinding>();

  constructor(
    private readonly dependencies: IFirmwarePreparedArtifactControllerDependencies,
  ) {}

  private async getExternalSdk(
    connectId: string | undefined,
  ): Promise<CoreApi | undefined> {
    if (!(await isFirmwareArtifactCapabilityReady())) {
      return undefined;
    }
    if (platformEnv.isDesktop) {
      const transportType = await this.dependencies.getHardwareTransportType();
      if (!isDirectFirmwareHostBindingTransport(transportType)) {
        return undefined;
      }
    }
    const sdk = await this.dependencies.getSDKInstance(connectId);
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

  async cachePlanIfPreparedSupported({
    plan,
    connectId,
    transportType,
    expectedTargets = [],
  }: {
    plan: FirmwareUpdatePlan;
    connectId: string | undefined;
    transportType: EHardwareTransportType;
    expectedTargets?: readonly FirmwareUpdatePlanForceTarget[];
  }): Promise<boolean> {
    const externalSdk = await this.getExternalSdk(connectId);
    const bridgeCapabilityReady =
      platformEnv.isDesktop &&
      transportType === EHardwareTransportType.Bridge &&
      (await isFirmwareArtifactCapabilityReady());
    if (!bridgeCapabilityReady && !externalSdk) {
      return false;
    }
    assertFirmwareUpdatePlanCoverage({ plan, expectedTargets });
    this.plans.set(plan.planDigest, plan);
    if (this.plans.size > 16) {
      const oldestDigest = this.plans.keys().next().value as string | undefined;
      if (oldestDigest) {
        this.plans.delete(oldestDigest);
      }
    }
    return true;
  }

  async cachePlanDigestIfPreparedSupported({
    hasUpgrade,
    plan,
    connectId,
    transportType,
    expectedTargets = [],
  }: {
    hasUpgrade: boolean | undefined;
    plan: FirmwareUpdatePlan | undefined;
    connectId: string | undefined;
    transportType: EHardwareTransportType;
    expectedTargets?: readonly FirmwareUpdatePlanForceTarget[];
  }): Promise<string | undefined> {
    return hasUpgrade &&
      plan &&
      (await this.cachePlanIfPreparedSupported({
        plan,
        connectId,
        transportType,
        expectedTargets,
      }))
      ? plan.planDigest
      : undefined;
  }

  getPlan(releaseResult: ICheckAllFirmwareReleaseResult): FirmwareUpdatePlan {
    const planDigest = releaseResult.firmwareUpdatePlanDigest;
    const plan = planDigest ? this.plans.get(planDigest) : undefined;
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

  private bindHost(prepared: IPreparedFirmwareArtifacts, sdk: CoreApi): void {
    const existing = this.hostBindings.get(prepared.transactionId);
    if (existing) {
      existing.sdk.unregisterFirmwareUpdateHostBinding(existing.generation);
    }
    const generation = (
      sdk.registerFirmwareUpdateHostBinding as unknown as (binding: {
        artifactReader: IPreparedFirmwareArtifacts['artifactReader'];
      }) => number
    )({
      artifactReader: prepared.artifactReader,
    });
    if (!Number.isSafeInteger(generation) || generation <= 0) {
      throw new OneKeyLocalError(
        'Firmware SDK returned an invalid host binding generation',
      );
    }
    this.hostBindings.set(prepared.transactionId, { sdk, generation });
  }

  private releaseHost(transactionId: string): boolean {
    const binding = this.hostBindings.get(transactionId);
    if (!binding) return false;
    try {
      return binding.sdk.unregisterFirmwareUpdateHostBinding(
        binding.generation,
      );
    } finally {
      this.hostBindings.delete(transactionId);
    }
  }

  getExecutionBindingParams(preparedArtifacts: IPreparedFirmwareArtifacts): {
    hostBindingGeneration: number;
  } {
    const binding = this.hostBindings.get(preparedArtifacts.transactionId);
    if (!binding) {
      throw new OneKeyLocalError('Firmware host binding is unavailable');
    }
    return {
      hostBindingGeneration: binding.generation,
    };
  }

  getExecutionArtifacts(
    artifacts: IFirmwareWorkflowArtifacts | undefined,
    sdkMethod?: string,
  ): IFirmwareExecutionArtifacts {
    const prepared =
      artifacts && 'preparedPlan' in artifacts ? artifacts : undefined;
    const bridge =
      artifacts && 'targetBinaries' in artifacts ? artifacts : undefined;
    const executionArtifacts = {
      preparedArtifacts: prepared,
      bridgeBinaries: bridge,
      hostBindingGeneration: prepared
        ? this.getExecutionBindingParams(prepared).hostBindingGeneration
        : undefined,
    };
    if (prepared) {
      firmwareUpdateTrace({
        transactionId: prepared.transactionId,
        stage: 'sdk-handoff',
        executor: prepared.plan.executor,
        sdkMethod,
        inputMode: 'artifact-reader',
        preparedPlanProvided: true,
        hostBindingProvided: Boolean(executionArtifacts.hostBindingGeneration),
        artifacts: getPreparedArtifactTraceSummary(prepared),
      });
    } else if (bridge) {
      firmwareUpdateTrace({
        transactionId: bridge.transactionId,
        stage: 'sdk-handoff',
        executor: bridge.executor,
        sdkMethod,
        inputMode: 'bridge-binary',
        preparedPlanProvided: false,
        hostBindingProvided: false,
        artifacts: getBridgeArtifactTraceSummary(bridge),
      });
    }
    return executionArtifacts;
  }

  async preparePlanArtifacts({
    plan,
    sdk,
    // cspell:disable-next-line
    transactionId = `fwtx:${generateUUID().toLowerCase()}`,
  }: {
    plan: FirmwareUpdatePlan;
    sdk: CoreApi;
    transactionId?: string;
  }): Promise<IPreparedFirmwareArtifacts> {
    firmwareUpdateTrace({
      transactionId,
      stage: 'preflight-start',
      executor: plan.executor,
      inputMode: 'artifact-reader',
      expectedArtifactCount: plan.artifacts.length,
    });
    const leaseOperation = firmwareArtifactAdapter.createLease(transactionId);
    let leaseRef: string;
    try {
      ({ leaseRef } = await withFirmwareArtifactStageTimeout(
        'LEASE_CREATE',
        leaseOperation,
      ));
    } catch (error) {
      void leaseOperation
        .then(({ leaseRef: lateLeaseRef }) =>
          firmwareArtifactAdapter.releaseLease({
            leaseRef: lateLeaseRef,
            disposition: 'safeCancelled',
          }),
        )
        .catch(() => undefined);
      throw error;
    }
    firmwareUpdateTrace({
      transactionId,
      stage: 'lease-created',
      executor: plan.executor,
      inputMode: 'artifact-reader',
    });
    try {
      const prepared = await prepareFirmwareArtifacts(plan, {
        transactionId,
        leaseRef,
        preparePlan: sdk.prepareFirmwareUpdatePlan,
      });
      const validatedPreparedPlan = sdk.validateFirmwareUpdatePreparedPlan(
        prepared.preparedPlan,
      );
      if (
        validatedPreparedPlan.preparedPlanDigest !==
        prepared.preparedPlan.preparedPlanDigest
      ) {
        throw new OneKeyLocalError(
          'Firmware prepared plan validation returned a different digest',
        );
      }
      firmwareUpdateTrace({
        transactionId,
        stage: 'artifact-ready',
        executor: plan.executor,
        inputMode: 'artifact-reader',
        preparedPlanProvided: true,
        artifacts: getPreparedArtifactTraceSummary(prepared),
      });
      this.bindHost(prepared, sdk);
      firmwareUpdateTrace({
        transactionId,
        stage: 'preflight-complete',
        executor: plan.executor,
        inputMode: 'artifact-reader',
        preparedPlanProvided: true,
        hostBindingProvided: true,
        artifacts: getPreparedArtifactTraceSummary(prepared),
      });
      return prepared;
    } catch (error) {
      this.releaseHost(transactionId);
      await firmwareArtifactAdapter
        .cancelDownloads(transactionId)
        .catch(() => undefined);
      await firmwareArtifactAdapter
        .releaseLease({ leaseRef, disposition: 'safeCancelled' })
        .catch(() => undefined);
      throw error;
    }
  }

  async withPreparedPlanArtifacts<T>(
    {
      plan,
      sdk,
      transactionId,
    }: {
      plan: FirmwareUpdatePlan;
      sdk: CoreApi;
      transactionId?: string;
    },
    execute: (artifacts: IPreparedFirmwareArtifacts) => Promise<T>,
    onReleased?: (result: IFirmwarePreparedArtifactReleaseResult) => void,
  ): Promise<T> {
    const prepared = await this.preparePlanArtifacts({
      plan,
      sdk,
      transactionId,
    });
    let disposition: 'completed' | 'safeCancelled' = 'safeCancelled';
    try {
      const result = await execute(prepared);
      disposition = 'completed';
      return result;
    } finally {
      onReleased?.(await this.releasePreparedArtifacts(prepared, disposition));
    }
  }

  private async prepareExternal(
    releaseResult: ICheckAllFirmwareReleaseResult,
  ): Promise<IPreparedFirmwareArtifacts | undefined> {
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      return undefined;
    }
    if (!releaseResult.firmwareUpdatePlanDigest) {
      return undefined;
    }
    const plan = this.getPlan(releaseResult);
    const sdk = await this.getExternalSdk(releaseResult.updatingConnectId);
    if (!sdk) {
      throw new OneKeyLocalError(
        'Firmware external SDK capability is unavailable',
      );
    }
    return this.preparePlanArtifacts({ plan, sdk });
  }

  async prepareWorkflowArtifacts(
    releaseResult: ICheckAllFirmwareReleaseResult,
  ): Promise<IFirmwareWorkflowArtifacts | undefined> {
    if (!releaseResult.firmwareUpdatePlanDigest) return undefined;
    if (platformEnv.isDesktop) {
      const transportType = await this.dependencies.getHardwareTransportType();
      if (transportType === EHardwareTransportType.Bridge) {
        const plan = this.getPlan(releaseResult);
        const transactionId = `bridge:${generateUUID().toLowerCase()}`;
        firmwareUpdateTrace({
          transactionId,
          stage: 'preflight-start',
          executor: plan.executor,
          inputMode: 'bridge-binary',
          expectedArtifactCount: plan.artifacts.length,
        });
        const prepared = await prepareBridgeFirmwareBinaries(
          plan,
          transactionId,
        );
        if (prepared) {
          firmwareUpdateTrace({
            transactionId,
            stage: 'preflight-complete',
            executor: plan.executor,
            inputMode: 'bridge-binary',
            preparedPlanProvided: false,
            hostBindingProvided: false,
            artifacts: getBridgeArtifactTraceSummary(prepared),
          });
        }
        return prepared;
      }
      if (!isDirectFirmwareHostBindingTransport(transportType)) {
        throw new OneKeyLocalError(
          'Firmware prepared transport is unavailable',
        );
      }
    }
    const prepared = await this.prepareExternal(releaseResult);
    if (!prepared) {
      throw new OneKeyLocalError('Firmware artifacts are not prepared');
    }
    return prepared;
  }

  async withWorkflowArtifacts<T>(
    releaseResult: ICheckAllFirmwareReleaseResult,
    execute: (artifacts: IFirmwareWorkflowArtifacts | undefined) => Promise<T>,
  ): Promise<T> {
    const artifacts = await this.prepareWorkflowArtifacts(releaseResult);
    const prepared =
      artifacts && 'preparedPlan' in artifacts ? artifacts : undefined;
    let disposition: 'completed' | 'safeCancelled' = 'safeCancelled';
    try {
      const result = await execute(artifacts);
      disposition = 'completed';
      return result;
    } finally {
      if (prepared) {
        await this.releasePreparedArtifacts(prepared, disposition);
      }
    }
  }

  async releasePreparedArtifacts(
    prepared: IPreparedFirmwareArtifacts,
    disposition: 'completed' | 'safeCancelled',
  ): Promise<IFirmwarePreparedArtifactReleaseResult> {
    let hostBindingReleased = false;
    let leaseReleased = false;
    try {
      hostBindingReleased = this.releaseHost(prepared.transactionId);
    } catch {
      hostBindingReleased = false;
    }
    if (disposition === 'safeCancelled') {
      await firmwareArtifactAdapter
        .cancelDownloads(prepared.transactionId)
        .catch(() => undefined);
    }
    await withFirmwareArtifactStageTimeout(
      'LEASE_RELEASE',
      firmwareArtifactAdapter.releaseLease({
        leaseRef: prepared.leaseRef,
        disposition,
      }),
    )
      .then(() => {
        leaseReleased = true;
      })
      .catch(() => undefined);
    firmwareUpdateTrace({
      transactionId: prepared.transactionId,
      stage: 'release-complete',
      executor: prepared.plan.executor,
      inputMode: 'artifact-reader',
      disposition,
      hostBindingReleased,
      leaseReleased,
    });
    return { hostBindingReleased, leaseReleased };
  }

  sweepOrphanedArtifacts(): Promise<{
    deletedFiles: number;
    deletedBytes: number;
  }> {
    return firmwareArtifactAdapter.sweepOrphans();
  }
}
