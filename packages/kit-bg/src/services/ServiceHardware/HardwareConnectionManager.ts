import { EDeviceType } from '@onekeyfe/hd-shared';
import axios from 'axios';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import type { IHardwareCallContext } from '@onekeyhq/shared/types/device';
import {
  EHardwareCallContext,
  EOneKeyDeviceMode,
} from '@onekeyhq/shared/types/device';

import {
  desktopBluetoothAtom,
  hardwareForceTransportAtom,
} from '../../states/jotai/atoms/desktopBluetooth';
import {
  EHardwareUiStateAction,
  hardwareUiStateAtom,
} from '../../states/jotai/atoms/hardware';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

export class HardwareConnectionManager {
  private static instance: HardwareConnectionManager | null = null;

  private backgroundApi: IBackgroundApi;

  private actualTransportType: EHardwareTransportType | null = null;

  private isRequestingBluetoothPermission = false;

  private constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    this.backgroundApi = backgroundApi;
  }

  static getInstance({
    backgroundApi,
  }: {
    backgroundApi: IBackgroundApi;
  }): HardwareConnectionManager {
    if (!HardwareConnectionManager.instance) {
      HardwareConnectionManager.instance = new HardwareConnectionManager({
        backgroundApi,
      });
    }
    return HardwareConnectionManager.instance;
  }

  static resetInstance(): void {
    HardwareConnectionManager.instance = null;
  }

  private async requestBluetoothPermission(): Promise<boolean> {
    try {
      // use servicePromise to wait for user to grant permission
      const permissionResult = await new Promise<boolean>((resolve, reject) => {
        const promiseId = this.backgroundApi.servicePromise.createCallback({
          resolve,
          reject,
        });

        // toggle bluetooth permission dialog
        void hardwareUiStateAtom.set({
          action: EHardwareUiStateAction.DeviceChecking,
          connectId: '',
          payload: {
            uiRequestType:
              EHardwareUiStateAction.DESKTOP_REQUEST_BLUETOOTH_PERMISSION,
            eventType:
              EHardwareUiStateAction.DESKTOP_REQUEST_BLUETOOTH_PERMISSION,
            deviceType: EDeviceType.Unknown,
            deviceMode: EOneKeyDeviceMode.normal,
            deviceId: '',
            connectId: '',
            rawPayload: {},
            promiseId: promiseId.toString(),
          },
        });
      });

      console.log(
        'HardwareConnectionManager requestBluetoothPermission permissionResult -> :',
        permissionResult,
      );

      return permissionResult;
    } catch (error) {
      console.error(
        'HardwareConnectionManager requestBluetoothPermission error -> :',
        error,
      );
      return false;
    }
  }

  async detectUSBDeviceAvailability(): Promise<boolean> {
    if (!platformEnv.isSupportDesktopBle) {
      return true;
    }

    try {
      const response = await axios.post(
        'http://localhost:21320/enumerate',
        null,
        {
          timeout: 3000,
        },
      );

      const devices = response.data as unknown[];
      const isAvailable = Array.isArray(devices) && devices.length > 0;
      return isAvailable;
    } catch (error) {
      return false;
    }
  }

  async detectBluetoothAvailability(
    hardwareCallContext?: IHardwareCallContext,
  ): Promise<boolean> {
    if (!platformEnv.isSupportDesktopBle) {
      return false;
    }

    const enableDesktopBluetooth =
      await this.backgroundApi.serviceSetting.getEnableDesktopBluetooth();

    if (!enableDesktopBluetooth) {
      console.log(
        '🔍 detectBluetoothAvailability global Bluetooth is disabled: ',
        enableDesktopBluetooth,
      );
      return false;
    }

    const desktopBluetoothSettings = await desktopBluetoothAtom.get();

    if (!desktopBluetoothSettings.isRequestedPermission) {
      console.log(
        'HardwareConnectionManager detectBluetoothAvailability desktopBluetoothSettings.isRequestedPermission -> :',
        desktopBluetoothSettings.isRequestedPermission,
      );

      if (this.isRequestingBluetoothPermission) {
        console.log(
          '❌ detectBluetoothAvailability isRequestingBluetoothPermission -> :',
          this.isRequestingBluetoothPermission,
        );
        return false;
      }

      this.isRequestingBluetoothPermission = true;

      try {
        const result = await this.requestBluetoothPermission();
        return result;
      } finally {
        this.isRequestingBluetoothPermission = false;
        // Update state to show checking device step instead of calling showCheckingDeviceDialog
        void this.backgroundApi.serviceHardwareUI.showCheckingDeviceDialog({
          connectId: '',
        });
      }
    }

    console.log('🔍 detectBluetoothAvailability');

    try {
      // Use desktop API to check Bluetooth availability
      if (!globalThis?.desktopApi?.nobleBle?.checkAvailability) {
        console.log('❌ detectBluetoothAvailability: no desktopApi');
        return false;
      }

      try {
        // first call to ensure nobleBle is initialized
        await globalThis?.desktopApi?.nobleBle?.checkAvailability();
      } catch {
        // ignore error
      }

      const bleAvailableState =
        await globalThis?.desktopApi?.nobleBle?.checkAvailability();

      console.log(
        '🔍 detectBluetoothAvailability bleAvailableState: ',
        bleAvailableState,
      );

      // Skip dialog for USER_INTERACTION_NO_BLE_DIALOG context
      if (
        bleAvailableState?.state === 'unauthorized' &&
        hardwareCallContext !==
          EHardwareCallContext.USER_INTERACTION_NO_BLE_DIALOG
      ) {
        // Show bluetooth permission unauthorized dialog
        await hardwareUiStateAtom.set({
          action: EHardwareUiStateAction.DeviceChecking,
          connectId: '',
          payload: {
            eventType: EHardwareUiStateAction.BLUETOOTH_PERMISSION_UNAUTHORIZED,
            uiRequestType:
              EHardwareUiStateAction.BLUETOOTH_PERMISSION_UNAUTHORIZED,
            deviceType: 'unknown' as any,
            deviceId: '',
            connectId: '',
            deviceMode: 'normal' as any,
            rawPayload: bleAvailableState,
          },
        });
        await timerUtils.wait(50);
      }

      return Boolean(bleAvailableState?.available);
    } catch (error) {
      console.log('❌ detectBluetoothAvailability error: ', error);
      return false;
    }
  }

  async determineOptimalTransportType(
    hardwareCallContext?: IHardwareCallContext,
  ): Promise<EHardwareTransportType> {
    const currentSettingType =
      await this.backgroundApi.serviceSetting.getHardwareTransportType();

    // For desktop, check if USB devices are available
    if (platformEnv.isSupportDesktopBle) {
      const usbAvailable = await this.detectUSBDeviceAvailability();

      if (usbAvailable) {
        return EHardwareTransportType.Bridge;
      }

      // No USB devices, check if Bluetooth is available before fallback
      const bluetoothAvailable = await this.detectBluetoothAvailability(
        hardwareCallContext,
      );

      if (bluetoothAvailable) {
        // Bluetooth is available, fallback to DesktopWebBle for seamless wireless connection
        return EHardwareTransportType.DesktopWebBle;
      }

      return EHardwareTransportType.Bridge;
    }

    return currentSettingType;
  }

  shouldSwitchTransportType = memoizee(
    async ({
      connectId,
      hardwareCallContext,
    }: {
      connectId?: string;
      hardwareCallContext?: IHardwareCallContext;
    }): Promise<{
      shouldSwitch: boolean;
      targetType: EHardwareTransportType;
    }> => {
      // Get force transport type from global atom first
      const hardwareForceTransportAtomState =
        await hardwareForceTransportAtom.get();
      const forceTransportType =
        hardwareForceTransportAtomState.forceTransportType;

      console.log('🔍 shouldSwitchTransportType called with:', {
        hardwareCallContext,
        forceTransportType,
        operationId: hardwareForceTransportAtomState.operationId,
      });

      // If a specific transport type is forced (e.g., for onboarding), use it directly
      if (forceTransportType) {
        console.log(
          '🔒 Using forced transport type from atom:',
          forceTransportType,
        );
        const shouldSwitch = this.actualTransportType !== forceTransportType;
        return {
          shouldSwitch,
          targetType: forceTransportType,
        };
      }

      // quick detect mini device
      const isMiniDevice = connectId && connectId.startsWith('MI');
      // mini device should always use bridge transport type
      if (isMiniDevice) {
        return {
          shouldSwitch: false,
          targetType: EHardwareTransportType.Bridge,
        };
      }

      // only if context is not background task or sdk initialization, we will detect optimal transport type
      if (
        [
          EHardwareCallContext.BACKGROUND_TASK,
          EHardwareCallContext.SDK_INITIALIZATION,
          EHardwareCallContext.SILENT_CALL,
        ].includes(hardwareCallContext || EHardwareCallContext.USER_INTERACTION)
      ) {
        console.log(
          '❌ Skip transport type detection: ',
          hardwareCallContext || EHardwareCallContext.USER_INTERACTION,
        );
        const currentSettingType =
          await this.backgroundApi.serviceSetting.getHardwareTransportType();
        return {
          shouldSwitch: false,
          targetType: currentSettingType,
        };
      }

      const optimalType = await this.determineOptimalTransportType(
        hardwareCallContext,
      );
      const shouldSwitch = this.actualTransportType !== optimalType;

      console.log(
        `🔍 CACHE RESULT: shouldSwitch=${
          shouldSwitch ? 'true' : 'false'
        }, targetType=${optimalType}, context=${
          hardwareCallContext || 'undefined'
        }`,
      );
      return {
        shouldSwitch,
        targetType: optimalType,
      };
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 2 }),
      max: 1,
      normalizer: (args) => `${args[0].hardwareCallContext || 'default'}`,
    },
  );

  async getCurrentTransportType(): Promise<EHardwareTransportType> {
    const currentTransportType =
      await this.backgroundApi.serviceSetting.getHardwareTransportType();
    return this.actualTransportType || currentTransportType;
  }

  setCurrentTransportType(transportType: EHardwareTransportType): void {
    // Only clear cache when transport type actually changes
    if (this.actualTransportType !== transportType) {
      void this.backgroundApi.serviceSetting.setHardwareTransportType(
        transportType,
      );
      this.actualTransportType = transportType;
      // Clear cache when transport type changes to ensure fresh detection
      try {
        void this.shouldSwitchTransportType.clear();
      } catch {
        // Ignore cache clear errors
      }
    }
  }
}
