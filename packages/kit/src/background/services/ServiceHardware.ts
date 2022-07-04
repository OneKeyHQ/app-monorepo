import { IDeviceType, UiResponseEvent, getDeviceType } from '@onekeyfe/hd-core';

import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import {
  ConnectTimeout,
  NeedOneKeyBridge,
} from '@onekeyhq/kit/src/utils/hardware/errors';
import { getHardwareSDKInstance } from '@onekeyhq/kit/src/utils/hardware/hardwareInstance';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { setHardwarePopup } from '../../store/reducers/hardware';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase, { IServiceBaseProps } from './ServiceBase';

type IPollFn<T> = (time?: number) => T;

const MAX_CONNECT_TRY_COUNT = 5;
const POLL_INTERVAL = 1000;
const POLL_INTERVAL_RATE = 1.5;

@backgroundClass()
class ServiceHardware extends ServiceBase {
  connectedDeviceType: IDeviceType = 'classic';

  tryCount = 0;

  constructor({ backgroundApi }: IServiceBaseProps) {
    super({ backgroundApi });
    getHardwareSDKInstance().then((instance) => {
      instance.on('UI_EVENT', (e) => {
        const { type, payload } = e;

        this.backgroundApi.dispatch(
          setHardwarePopup({
            uiRequest: type,
            payload: payload ?? undefined,
          }),
        );
      });
    });
  }

  async getSDKInstance() {
    return getHardwareSDKInstance();
  }

  @backgroundMethod()
  async searchDevices() {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK?.searchDevices();
  }

  @backgroundMethod()
  async connect(connectId: string) {
    try {
      const result = await this.getFeatures(connectId);
      return result !== null;
    } catch (e) {
      if (e instanceof OneKeyHardwareError && !e.reconnect) {
        return Promise.reject(e);
      }
    }
  }

  @backgroundMethod()
  async getFeatures(connectId: string) {
    const HardwareSDK = await this.getSDKInstance();
    const response = await HardwareSDK?.getFeatures(connectId);

    if (response.success) {
      this.connectedDeviceType = getDeviceType(response.payload);
      return response.payload;
    }

    const deviceError = deviceUtils.convertDeviceError(response.payload);

    return Promise.reject(deviceError);
  }

  @backgroundMethod()
  async ensureConnected(connectId: string) {
    let tryCount = 0;
    let connected = false;
    const poll: IPollFn<Promise<IOneKeyDeviceFeatures>> = async (
      time = POLL_INTERVAL,
    ) => {
      if (connected) {
        return Promise.resolve({} as IOneKeyDeviceFeatures);
      }
      tryCount += 1;
      try {
        const feature = await this.getFeatures(connectId);
        if (feature) {
          connected = true;
          return await Promise.resolve(feature);
        }
      } catch (e) {
        if (e instanceof OneKeyHardwareError && !e.reconnect) {
          return Promise.reject(e);
        }

        if (tryCount > MAX_CONNECT_TRY_COUNT) {
          return Promise.reject(e);
        }
      }

      if (tryCount > MAX_CONNECT_TRY_COUNT) {
        return Promise.reject(new ConnectTimeout());
      }
      return new Promise(
        (resolve: (p: Promise<IOneKeyDeviceFeatures>) => void) =>
          setTimeout(() => resolve(poll(time * POLL_INTERVAL_RATE)), time),
      );
    };

    const checkBridge = await this.checkBridge();
    if (!checkBridge) {
      return Promise.reject(new NeedOneKeyBridge());
    }

    return poll();
  }

  @backgroundMethod()
  async cancel(connectId: string) {
    return (await this.getSDKInstance()).cancel(connectId);
  }

  @backgroundMethod()
  async sendUiResponse(response: UiResponseEvent) {
    return (await this.getSDKInstance()).uiResponse(response);
  }

  @backgroundMethod()
  async checkBridge() {
    if (!this._hasUseBridge()) {
      return Promise.resolve(true);
    }

    const HardwareSDK = await this.getSDKInstance();
    const transportRelease = await HardwareSDK?.checkTransportRelease();

    if (!transportRelease.success) {
      switch (transportRelease.payload.error) {
        case 'Init_IframeTimeout':
        case 'Init_IframeLoadFail':
          return Promise.resolve(true);
        default:
          return Promise.resolve(false);
      }
    }

    return Promise.resolve(true);
  }

  _hasUseBridge() {
    return (
      platformEnv.isDesktop || platformEnv.isWeb || platformEnv.isExtension
    );
  }
}

export default ServiceHardware;
