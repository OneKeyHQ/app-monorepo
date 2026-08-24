import {
  EDeviceType,
  type HardwareConnectProtocol,
  ONEKEY_WEBUSB_FILTER,
} from '@onekeyfe/hd-shared';
import axios from 'axios';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
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

  private async getDesktopUsbSetting(
    connectProtocol?: HardwareConnectProtocol,
  ): Promise<'webusb' | 'bridge' | undefined> {
    try {
      const dev = await this.backgroundApi.serviceDevSetting.getDevSetting();
      return deviceUtils.getDesktopUsbTransportType({
        usbCommunicationMode: dev?.settings?.usbCommunicationMode,
        connectProtocol,
      }) === EHardwareTransportType.Bridge
        ? 'bridge'
        : 'webusb';
    } catch {
      return deviceUtils.getDesktopUsbTransportType({ connectProtocol }) ===
        EHardwareTransportType.Bridge
        ? 'bridge'
        : 'webusb';
    }
  }

  async getTransportTypeForChannel({
    transportType,
    connectProtocol,
  }: {
    transportType: 'usb' | 'ble';
    connectProtocol?: HardwareConnectProtocol;
  }): Promise<EHardwareTransportType> {
    if (transportType === 'ble') {
      return platformEnv.isSupportDesktopBle
        ? EHardwareTransportType.DesktopWebBle
        : EHardwareTransportType.BLE;
    }

    const mode = await this.getDesktopUsbSetting(connectProtocol);
    return mode === 'bridge'
      ? EHardwareTransportType.Bridge
      : EHardwareTransportType.WEBUSB;
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

  // WebUSB detection
  async detectWebUSBAvailability(_connectId?: string): Promise<boolean> {
    if (!platformEnv.isSupportDesktopBle) return true;
    try {
      const usb = globalThis?.navigator?.usb;
      if (!usb || typeof usb.getDevices !== 'function') return false;
      const list = (await usb.getDevices()) || [];
      const onekeyDevices = (Array.isArray(list) ? list : []).filter((dev) => {
        const isOneKey = ONEKEY_WEBUSB_FILTER?.some(
          (d) => dev?.vendorId === d.vendorId && dev?.productId === d.productId,
        );
        // The SDK uses serialNumber as the WebUSB device path. Authorized
        // devices without one cannot be acquired by the transport.
        const hasSerialNumber =
          typeof dev?.serialNumber === 'string' &&
          dev.serialNumber.trim().length > 0;
        return isOneKey && hasSerialNumber;
      });
      return onekeyDevices.length > 0;
    } catch {
      return false;
    }
  }

  async detectBridgeAvailability(_connectId?: string): Promise<boolean> {
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

      const devices = response.data as Array<{ path?: unknown }>;
      if (!Array.isArray(devices)) {
        return false;
      }
      return devices.length > 0;
    } catch (_error) {
      return false;
    }
  }

  // Checking USB availability based on DevSetting
  async detectUSBDeviceAvailability(
    connectId?: string,
    connectProtocol?: HardwareConnectProtocol,
  ): Promise<boolean> {
    if (!platformEnv.isSupportDesktopBle) return true;
    const mode = await this.getDesktopUsbSetting(connectProtocol);
    if (mode === 'bridge') {
      return this.detectBridgeAvailability(connectId);
    }
    return this.detectWebUSBAvailability(connectId);
  }

  // Trezor-scoped USB presence: the global probe counts OneKey USB/Bridge
  // devices, which can be true while this Trezor is BLE-only. WebUSB only.
  async detectTrezorUSBDeviceAvailability(): Promise<boolean> {
    if (!platformEnv.isSupportDesktopBle) return true;
    try {
      const usb = globalThis?.navigator?.usb;
      if (!usb || typeof usb.getDevices !== 'function') return false;
      const { TREZOR_WEBUSB_FILTERS } =
        await import('@onekeyfe/hwk-trezor-connector-webusb');
      const list = (await usb.getDevices()) || [];
      return (Array.isArray(list) ? list : []).some((dev) =>
        TREZOR_WEBUSB_FILTERS.some(
          (f) => dev?.vendorId === f.vendorId && dev?.productId === f.productId,
        ),
      );
    } catch {
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
    connectId?: string,
    connectProtocol?: HardwareConnectProtocol,
  ): Promise<EHardwareTransportType> {
    const currentSettingType =
      await this.backgroundApi.serviceSetting.getHardwareTransportType();

    if (platformEnv.isSupportDesktopBle) {
      const mode = await this.getDesktopUsbSetting(connectProtocol);
      if (hardwareCallContext === EHardwareCallContext.UPDATE_FIRMWARE) {
        return mode === 'bridge'
          ? EHardwareTransportType.Bridge
          : EHardwareTransportType.WEBUSB;
      }
      const usbAvailable = await this.detectUSBDeviceAvailability(
        connectId,
        connectProtocol,
      );
      if (usbAvailable) {
        return mode === 'bridge'
          ? EHardwareTransportType.Bridge
          : EHardwareTransportType.WEBUSB;
      }

      // No USB devices, check if Bluetooth is available before fallback
      const bluetoothAvailable =
        await this.detectBluetoothAvailability(hardwareCallContext);
      if (bluetoothAvailable) {
        return EHardwareTransportType.DesktopWebBle;
      }

      return mode === 'bridge'
        ? EHardwareTransportType.Bridge
        : EHardwareTransportType.WEBUSB;
    }

    return currentSettingType;
  }

  shouldSwitchTransportType = memoizee(
    async ({
      connectId,
      connectProtocol,
      hardwareCallContext,
    }: {
      connectId?: string;
      connectProtocol?: HardwareConnectProtocol;
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
      const normalizedForceTransportType = forceTransportType
        ? deviceUtils.normalizeHardwareTransportTypeForPlatform({
            transportType: forceTransportType,
            connectProtocol,
          })
        : undefined;

      // quick detect mini device
      const isMiniDevice = connectId && connectId.startsWith('MI');

      // If a specific transport type is forced (e.g., for onboarding), use it directly
      if (
        normalizedForceTransportType &&
        (!isMiniDevice ||
          normalizedForceTransportType === EHardwareTransportType.WEBUSB ||
          normalizedForceTransportType === EHardwareTransportType.Bridge)
      ) {
        const shouldSwitch =
          this.actualTransportType !== normalizedForceTransportType;
        return {
          shouldSwitch,
          targetType: normalizedForceTransportType,
        };
      }

      // Mini does not support BLE, so it must always use the configured USB transport.
      if (isMiniDevice) {
        const usbSetting = await this.getDesktopUsbSetting(connectProtocol);
        const targetType =
          usbSetting === 'webusb'
            ? EHardwareTransportType.WEBUSB
            : EHardwareTransportType.Bridge;
        return {
          shouldSwitch: this.actualTransportType !== targetType,
          targetType,
        };
      }

      // only if context is not background task or sdk initialization, we will detect optimal transport type
      if (
        [
          EHardwareCallContext.BACKGROUND_TASK,
          EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
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
        connectId,
        connectProtocol,
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
      normalizer: (args) =>
        JSON.stringify([
          args[0].hardwareCallContext || 'default',
          args[0].connectProtocol || '',
          args[0].connectId?.startsWith('MI') ? 'mini' : 'other',
        ]),
    },
  );

  async resolveTransportType(params: {
    connectId?: string;
    connectProtocol?: HardwareConnectProtocol;
    hardwareCallContext?: IHardwareCallContext;
  }): Promise<{
    shouldSwitch: boolean;
    targetType: EHardwareTransportType;
  }> {
    const result = await this.shouldSwitchTransportType(params);
    await this.setCurrentTransportType(result.targetType);
    return result;
  }

  async getCurrentTransportType(): Promise<EHardwareTransportType> {
    const currentTransportType =
      await this.backgroundApi.serviceSetting.getHardwareTransportType();
    return this.actualTransportType || currentTransportType;
  }

  async setCurrentTransportType(
    transportType: EHardwareTransportType,
  ): Promise<void> {
    // Only clear cache when transport type actually changes
    if (this.actualTransportType !== transportType) {
      // 先更新运行时状态，避免持久化期间的并发调用继续使用旧传输。
      this.actualTransportType = transportType;
      // Clear cache when transport type changes to ensure fresh detection
      try {
        void this.shouldSwitchTransportType.clear();
      } catch {
        // Ignore cache clear errors
      }
      if (
        typeof this.backgroundApi.serviceSetting?.setHardwareTransportType ===
        'function'
      ) {
        await this.backgroundApi.serviceSetting.setHardwareTransportType(
          transportType,
        );
      }
    }
  }
}
