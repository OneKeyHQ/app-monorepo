import { EDeviceType } from '@onekeyfe/hd-shared';
import semver from 'semver';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  ELegacyFirmwareUpdateSteps,
  legacyFirmwareUpdateProgressAtom,
  legacyFirmwareUpdateRunningAtom,
  legacyFirmwareUpdateStepAtom,
} from '../../states/jotai/atoms/legacyFirmwareUpdate';
import ServiceBase from '../ServiceBase';
import { FIRMWARE_UPDATE_MIN_VERSION_ALLOWED } from '../ServiceFirmwareUpdate/firmwareUpdateConsts';
import serviceHardwareUtils from '../ServiceHardware/serviceHardwareUtils';

import { ClassicFirmwareHandler } from './handlers/ClassicFirmwareHandler';
import { MiniFirmwareHandler } from './handlers/MiniFirmwareHandler';
import { TouchFirmwareHandler } from './handlers/TouchFirmwareHandler';

import type {
  ILegacyFlowCheckParams,
  ILegacyUpdateParams,
  ILegacyUpdateResult,
} from './types';
import type { ILegacyFirmwareUpdateStepInfo } from '../../states/jotai/atoms/legacyFirmwareUpdate';
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
   * 1. All platforms (Web, Extension, Native)
   * 2. Device version below minimum limit
   */
  @backgroundMethod()
  shouldUseLegacyFlow(params: ILegacyFlowCheckParams): boolean {
    const { deviceType, firmwareVersion, bootloaderVersion } = params;

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

    // Emit begin firmware update event
    appEventBus.emit(EAppEventBusNames.BeginFirmwareUpdate, undefined);

    // Wait for other hardware tasks to stop processing
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
      'startLegacyUpdate: locked transport type',
      currentTransportType,
    );

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
          throw new OneKeyLocalError(`Unsupported device type: ${deviceType}`);
      }

      // If device needs bootloader mode, don't set to done
      // UI will show guidance and user needs to manually enter bootloader mode
      // Then restart the update process
      if (result.needsBootloaderMode) {
        // Step is already set to waitingBootloaderMode by the handler
        // Keep running state true and transport lock active
        // User will restart the update after entering bootloader mode
        return result;
      }

      // Set complete state
      await this.setStep(ELegacyFirmwareUpdateSteps.done);

      // Clean up on successful completion
      await this.cleanupAfterUpdate();

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.setStep(ELegacyFirmwareUpdateSteps.error, {
        error: errorMessage,
      });

      // Clean up on error
      await this.cleanupAfterUpdate();

      throw error;
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
    await this.cleanupAfterUpdate();
    await this.resetState();
  }

  /**
   * Clean up resources after firmware update completes or fails
   * This includes clearing transport type lock and emitting events
   */
  private async cleanupAfterUpdate(): Promise<void> {
    await legacyFirmwareUpdateRunningAtom.set(false);

    // Clear transport type lock
    await this.backgroundApi.serviceHardware.clearForceTransportType();
    serviceHardwareUtils.hardwareLog(
      'startLegacyUpdate: cleared transport type lock',
    );

    // Emit finish firmware update event
    appEventBus.emit(EAppEventBusNames.FinishFirmwareUpdate, undefined);
  }

  // ==================== SDK Access ====================

  async getSDKInstance(connectId: string | undefined) {
    return this.backgroundApi.serviceHardware.getSDKInstance({ connectId });
  }
}

export default ServiceLegacyFirmwareUpdate;
