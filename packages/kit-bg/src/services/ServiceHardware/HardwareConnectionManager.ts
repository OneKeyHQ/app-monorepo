import axios from 'axios';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

export class HardwareConnectionManager {
  private backgroundApi: IBackgroundApi;

  private actualTransportType: EHardwareTransportType | null = null;

  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    this.backgroundApi = backgroundApi;
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

  async determineOptimalTransportType(): Promise<EHardwareTransportType> {
    const currentSettingType =
      await this.backgroundApi.serviceSetting.getHardwareTransportType();

    // For desktop, check if USB devices are available
    if (platformEnv.isSupportDesktopBle) {
      const usbAvailable = await this.detectUSBDeviceAvailability();

      if (usbAvailable) {
        return EHardwareTransportType.Bridge;
      }

      // No USB devices, fallback to DesktopWebBle for seamless wireless connection
      return EHardwareTransportType.DesktopWebBle;
    }

    return currentSettingType;
  }

  shouldSwitchTransportType = memoizee(
    async (): Promise<{
      shouldSwitch: boolean;
      targetType: EHardwareTransportType;
    }> => {
      const optimalType = await this.determineOptimalTransportType();
      const shouldSwitch = this.actualTransportType !== optimalType;

      console.log(
        `🔍 CACHE RESULT: shouldSwitch=${
          shouldSwitch ? 'true' : 'false'
        }, targetType=${optimalType}`,
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
