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
} from './FirmwareArtifactPreflight';

import type {
  IBridgeFirmwareBinaries,
  IPreparedFirmwareArtifacts,
} from './FirmwareArtifactPreflight';
import type { CoreApi, FirmwareUpdatePlan } from '@onekeyfe/hd-core';

export type IFirmwareWorkflowArtifacts =
  | IPreparedFirmwareArtifacts
  | IBridgeFirmwareBinaries;

export type IFirmwareExecutionArtifacts = {
  preparedArtifacts?: IPreparedFirmwareArtifacts;
  bridgeBinaries?: IBridgeFirmwareBinaries;
  hostBindingGeneration?: number;
};

type IFirmwareHostBinding = {
  sdk: CoreApi;
  generation: number;
};

type IFirmwarePreparedArtifactControllerDependencies = {
  getHardwareTransportType: () => Promise<EHardwareTransportType>;
  getSDKInstance: (connectId: string | undefined) => Promise<CoreApi>;
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
  }: {
    plan: FirmwareUpdatePlan;
    connectId: string | undefined;
    transportType: EHardwareTransportType;
  }): Promise<boolean> {
    const externalSdk = await this.getExternalSdk(connectId);
    const bridgeCapabilityReady =
      platformEnv.isDesktop &&
      transportType === EHardwareTransportType.Bridge &&
      (await isFirmwareArtifactCapabilityReady());
    if (!bridgeCapabilityReady && !externalSdk) {
      return false;
    }
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
  }: {
    hasUpgrade: boolean | undefined;
    plan: FirmwareUpdatePlan | undefined;
    connectId: string | undefined;
    transportType: EHardwareTransportType;
  }): Promise<string | undefined> {
    return hasUpgrade &&
      plan &&
      (await this.cachePlanIfPreparedSupported({
        plan,
        connectId,
        transportType,
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

  private releaseHost(transactionId: string): void {
    const binding = this.hostBindings.get(transactionId);
    if (!binding) return;
    binding.sdk.unregisterFirmwareUpdateHostBinding(binding.generation);
    this.hostBindings.delete(transactionId);
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
  ): IFirmwareExecutionArtifacts {
    const prepared =
      artifacts && 'preparedPlan' in artifacts ? artifacts : undefined;
    return {
      preparedArtifacts: prepared,
      bridgeBinaries:
        artifacts && 'targetBinaries' in artifacts ? artifacts : undefined,
      hostBindingGeneration: prepared
        ? this.getExecutionBindingParams(prepared).hostBindingGeneration
        : undefined,
    };
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
    // cspell:disable-next-line
    const transactionId = `fwtx:${generateUUID().toLowerCase()}`;
    const { leaseRef } =
      await firmwareArtifactAdapter.createLease(transactionId);
    try {
      const prepared = await prepareFirmwareArtifacts(plan, {
        transactionId,
        leaseRef,
        preparePlan: sdk.prepareFirmwareUpdatePlan,
      });
      this.bindHost(prepared, sdk);
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

  async prepareWorkflowArtifacts(
    releaseResult: ICheckAllFirmwareReleaseResult,
  ): Promise<IFirmwareWorkflowArtifacts | undefined> {
    if (!releaseResult.firmwareUpdatePlanDigest) return undefined;
    if (platformEnv.isDesktop) {
      const transportType = await this.dependencies.getHardwareTransportType();
      if (transportType === EHardwareTransportType.Bridge) {
        const plan = this.getPlan(releaseResult);
        return prepareBridgeFirmwareBinaries(plan);
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
  ): Promise<void> {
    this.releaseHost(prepared.transactionId);
    if (disposition === 'safeCancelled') {
      await firmwareArtifactAdapter
        .cancelDownloads(prepared.transactionId)
        .catch(() => undefined);
    }
    await firmwareArtifactAdapter
      .releaseLease({
        leaseRef: prepared.leaseRef,
        disposition,
      })
      .catch(() => undefined);
  }
}
