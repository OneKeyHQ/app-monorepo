import semver from 'semver';

import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  ELegacyFirmwareUpdateSteps,
  legacyFirmwareUpdateProgressAtom,
  legacyFirmwareUpdateRunningAtom,
  legacyFirmwareUpdateStepAtom,
} from '../../states/jotai/atoms/legacyFirmwareUpdate';
import ServiceBase from '../ServiceBase';
import { FIRMWARE_UPDATE_MIN_VERSION_ALLOWED } from '../ServiceFirmwareUpdate/firmwareUpdateConsts';

import { ClassicFirmwareHandler } from './handlers/ClassicFirmwareHandler';
import { MiniFirmwareHandler } from './handlers/MiniFirmwareHandler';
import { TouchFirmwareHandler } from './handlers/TouchFirmwareHandler';

import type { ILegacyFirmwareUpdateStepInfo } from '../../states/jotai/atoms/legacyFirmwareUpdate';
import type {
  ILegacyFlowCheckParams,
  ILegacyUpdateParams,
  ILegacyUpdateResult,
} from './types';
import type { IDeviceType } from '@onekeyfe/hd-core';

@backgroundClass()
class ServiceLegacyFirmwareUpdate extends ServiceBase {
  // ==================== Handler Instances ====================

  private touchHandler = new TouchFirmwareHandler();

  private miniHandler = new MiniFirmwareHandler();

  private classicHandler = new ClassicFirmwareHandler();

  // ==================== Public Methods ====================

  /**
   * Check if legacy upgrade flow should be used
   *
   * Conditions:
   * 1. Web or Extension platform
   * 2. Device version below minimum limit
   */
  @backgroundMethod()
  shouldUseLegacyFlow(params: ILegacyFlowCheckParams): boolean {
    const { deviceType, firmwareVersion, bootloaderVersion } = params;

    // Condition 1: Only Web/Extension platforms
    if (!platformEnv.isWeb && !platformEnv.isExtension) {
      return false;
    }

    // Condition 2: Pro device has no restrictions
    if (deviceType === EDeviceType.Pro) {
      return false;
    }

    // Condition 3: Check version limits
    const minVersion =
      FIRMWARE_UPDATE_MIN_VERSION_ALLOWED[deviceType as IDeviceType];
    if (!minVersion) {
      return false;
    }

    // Use legacy flow when version is below minimum limit
    const needsLegacy =
      (minVersion.firmware &&
        firmwareVersion &&
        semver.valid(firmwareVersion) &&
        semver.lt(firmwareVersion, minVersion.firmware)) ||
      (minVersion.bootloader &&
        bootloaderVersion &&
        semver.valid(bootloaderVersion) &&
        semver.lt(bootloaderVersion, minVersion.bootloader));

    return !!needsLegacy;
  }

  /**
   * Start legacy device upgrade
   */
  @backgroundMethod()
  async startLegacyUpdate(
    params: ILegacyUpdateParams,
  ): Promise<ILegacyUpdateResult> {
    const { deviceType } = params;

    try {
      // Set running state
      await legacyFirmwareUpdateRunningAtom.set(true);

      // Set initial state
      await this.setStep(ELegacyFirmwareUpdateSteps.preparing);

      // Select handler based on device type
      let result: ILegacyUpdateResult;

      switch (deviceType) {
        case EDeviceType.Touch:
          result = await this.handleTouchUpdate(params);
          break;

        case EDeviceType.Mini:
          result = await this.handleMiniUpdate(params);
          break;

        case EDeviceType.Classic:
        case EDeviceType.Classic1s:
        case EDeviceType.ClassicPure:
          result = await this.handleClassicUpdate(params);
          break;

        default:
          throw new Error(`Unsupported device type: ${deviceType}`);
      }

      // Set complete state
      await this.setStep(ELegacyFirmwareUpdateSteps.done);
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.setStep(ELegacyFirmwareUpdateSteps.error, {
        error: errorMessage,
      });
      throw error;
    } finally {
      await legacyFirmwareUpdateRunningAtom.set(false);
    }
  }

  // ==================== Device Handlers ====================

  private async handleTouchUpdate(
    params: ILegacyUpdateParams,
  ): Promise<ILegacyUpdateResult> {
    return this.touchHandler.update(params, this);
  }

  private async handleMiniUpdate(
    params: ILegacyUpdateParams,
  ): Promise<ILegacyUpdateResult> {
    return this.miniHandler.update(params, this);
  }

  private async handleClassicUpdate(
    params: ILegacyUpdateParams,
  ): Promise<ILegacyUpdateResult> {
    return this.classicHandler.update(params, this);
  }

  // ==================== State Management ====================

  @backgroundMethod()
  async setStep(
    step: ELegacyFirmwareUpdateSteps,
    payload?: ILegacyFirmwareUpdateStepInfo['payload'],
  ): Promise<void> {
    await legacyFirmwareUpdateStepAtom.set({
      step,
      payload,
    } as ILegacyFirmwareUpdateStepInfo);
  }

  @backgroundMethod()
  async setProgress(progress: number, message?: string): Promise<void> {
    await legacyFirmwareUpdateProgressAtom.set({ progress, message });
  }

  @backgroundMethod()
  async resetState(): Promise<void> {
    await legacyFirmwareUpdateStepAtom.set({
      step: ELegacyFirmwareUpdateSteps.idle,
      payload: undefined,
    });
    await legacyFirmwareUpdateProgressAtom.set({
      progress: 0,
      message: undefined,
    });
    await legacyFirmwareUpdateRunningAtom.set(false);
  }

  /**
   * Exit update workflow and reset state
   * Called when the update page is unmounted
   */
  @backgroundMethod()
  async exitUpdateWorkflow(): Promise<void> {
    await this.resetState();
  }

  // ==================== SDK Access ====================

  async getSDKInstance(connectId: string | undefined) {
    return this.backgroundApi.serviceHardware.getSDKInstance({ connectId });
  }
}

export default ServiceLegacyFirmwareUpdate;
