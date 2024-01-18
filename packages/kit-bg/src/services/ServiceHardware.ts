import {
  type CoreApi,
  type DeviceSettingsParams,
  type DeviceUploadResourceParams,
  UI_RESPONSE,
  type UiResponseEvent,
} from '@onekeyfe/hd-core';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  BridgeTimeoutError,
  InitIframeLoadFail,
  InitIframeTimeout,
  OneKeyHardwareError,
} from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  CoreSDKLoader,
  generateConnectSrc,
  getHardwareSDKInstance,
} from '@onekeyhq/shared/src/hardware/instance';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EOnekeyDomain,
  IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types';

import { settingsPersistAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceHardware extends ServiceBase {
  registeredEvents = false;

  featuresCache: Record<string, IOneKeyDeviceFeatures> = {};

  async getSDKInstance() {
    const { hardwareConnectSrc } = await settingsPersistAtom.get();
    const instance = await getHardwareSDKInstance({
      isPreRelease: false,
      hardwareConnectSrc,
    });
    // TODO re-register events when hardwareConnectSrc or isPreRelease changed
    await this.registerSdkEvents(instance);
    return instance;
  }

  async registerSdkEvents(instance: CoreApi) {
    if (!this.registeredEvents) {
      this.registeredEvents = true;
      const {
        UI_EVENT,
        DEVICE,
        // LOG_EVENT,
        // FIRMWARE,
        // FIRMWARE_EVENT,
        // UI_REQUEST,
      } = await CoreSDKLoader();
      instance.on(UI_EVENT, (e) => {
        const { type, payload } = e;
        console.log('=>>>> UI_EVENT: ', type, payload);
      });
      instance.on(DEVICE.FEATURES, (features: IOneKeyDeviceFeatures) => {
        if (!features || !features.device_id) return;

        // TODO: save features cache
        console.log('todo: features cache');
      });
    }
  }

  @backgroundMethod()
  async getFeaturesByWalletId(walletId: string) {
    return Promise.resolve(this.featuresCache[walletId] ?? null);
  }

  @backgroundMethod()
  async updateFeaturesCache(walletId: string, payload: Record<string, any>) {
    if (!this.featuresCache[walletId]) return;
    this.featuresCache[walletId] = {
      ...this.featuresCache[walletId],
      ...payload,
    };
    return Promise.resolve(true);
  }

  @backgroundMethod()
  async removeFeaturesCache(walletId: string) {
    if (this.featuresCache[walletId]) {
      delete this.featuresCache[walletId];
    }
    return Promise.resolve(true);
  }

  @backgroundMethod()
  async searchDevices() {
    const hardwareSDK = await this.getSDKInstance();
    const response = await hardwareSDK?.searchDevices();
    return response;
    // if (response.success) {
    //   return response.payload;
    // }
    // const deviceError = convertDeviceError(response.payload);
    // return Promise.reject(deviceError);
  }

  @backgroundMethod()
  async connect(connectId: string) {
    if (platformEnv.isNative) {
      try {
        const result = await this.getFeatures(connectId);
        return result !== null;
      } catch (e: any) {
        const { data } = e || {};
        const { reconnect } = data || {};
        if (e instanceof OneKeyHardwareError && !reconnect) {
          return Promise.reject(e);
        }
      }
    } else {
      /**
       * USB does not need the extra getFeatures call
       */
      return Promise.resolve(true);
    }
  }

  @backgroundMethod()
  async getFeatures(connectId?: string) {
    const hardwareSDK = await this.getSDKInstance();
    const response = await hardwareSDK?.getFeatures(connectId);

    if (response.success) {
      return response.payload;
    }
    const deviceError = convertDeviceError(response.payload);
    return Promise.reject(deviceError);
  }

  @backgroundMethod()
  async unlockDevice({ connectId }: { connectId: string }) {
    // only unlock device when device is locked
    return this.getPassphraseStateBase({
      connectId,
      forceInputPassphrase: false,
      useEmptyPassphrase: true,
    });
  }

  @backgroundMethod()
  async getPassphraseState({
    connectId,
    forceInputPassphrase,
  }: {
    connectId: string;
    forceInputPassphrase: boolean;
  }) {
    return this.getPassphraseStateBase({ connectId, forceInputPassphrase });
  }

  @backgroundMethod()
  async getPassphraseStateBase({
    connectId,
    forceInputPassphrase,
    useEmptyPassphrase,
  }: {
    connectId: string;
    forceInputPassphrase: boolean; // not working?
    useEmptyPassphrase?: boolean;
  }) {
    const hardwareSDK = await this.getSDKInstance();
    const response = await hardwareSDK?.getPassphraseState(connectId, {
      initSession: forceInputPassphrase, // always re-input passphrase on device
      useEmptyPassphrase,
      // deriveCardano, // TODO gePassphraseState different if networkImpl === IMPL_ADA ?
    });

    if (response.success) {
      return response.payload ?? undefined;
    }

    const deviceError = convertDeviceError(response.payload);

    return Promise.reject(deviceError);
  }

  @backgroundMethod()
  async inputPassphraseOnDevice() {
    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: {
        value: '',
        passphraseOnDevice: true,
        save: false,
      },
    });
  }

  @backgroundMethod()
  async inputPinOnDevice() {
    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PIN,
      payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
    });
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
  async rebootToBootloader(connectId: string) {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK?.deviceUpdateReboot(connectId).then((response) => {
      if (!response.success) {
        return Promise.reject(convertDeviceError(response.payload));
      }
      return response;
    });
  }

  @backgroundMethod()
  async rebootToBoardloader(connectId: string) {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK
      ?.deviceRebootToBoardloader(connectId)
      .then((response) => {
        if (!response.success) {
          return Promise.reject(convertDeviceError(response.payload));
        }
        return response;
      });
  }

  @backgroundMethod()
  async getDeviceCertWithSig(connectId: string, dataHex: string) {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK
      ?.deviceVerify(connectId, { dataHex })
      .then((response) => {
        if (!response.success) {
          return Promise.reject(convertDeviceError(response.payload));
        }
        return response.payload;
      });
  }

  @backgroundMethod()
  async changePin(connectId: string, remove = false) {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK
      ?.deviceChangePin(connectId, {
        remove,
      })
      .then((response) => {
        if (!response.success) {
          return Promise.reject(convertDeviceError(response.payload));
        }
        return response;
      });
  }

  @backgroundMethod()
  async applySettings(connectId: string, settings: DeviceSettingsParams) {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK?.deviceSettings(connectId, settings).then((response) => {
      if (!response.success) {
        return Promise.reject(convertDeviceError(response.payload));
      }
      return response;
    });
  }

  @backgroundMethod()
  async getDeviceSupportFeatures(connectId: string) {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK?.deviceSupportFeatures(connectId).then((response) => {
      if (!response.success) {
        return Promise.reject(convertDeviceError(response.payload));
      }
      return response.payload;
    });
  }

  @backgroundMethod()
  async checkBridge() {
    if (!this._hasUseBridge()) {
      return Promise.resolve(true);
    }

    const hardwareSDK = await this.getSDKInstance();
    const bridgeStatus = await hardwareSDK?.checkBridgeStatus();

    if (!bridgeStatus.success) {
      const error = convertDeviceError(bridgeStatus.payload);
      if (
        error instanceof InitIframeLoadFail ||
        error instanceof InitIframeTimeout
      ) {
        return Promise.resolve(true);
      }
      /**
       * Sometimes we need to capture the Bridge timeout error
       * it does not mean that the user does not have bridge installed
       */
      if (error instanceof BridgeTimeoutError) {
        return Promise.resolve(error);
      }

      return Promise.resolve(false);
    }

    return Promise.resolve(bridgeStatus.payload);
  }

  _hasUseBridge() {
    return (
      platformEnv.isDesktop || platformEnv.isWeb || platformEnv.isExtension
    );
  }

  @backgroundMethod()
  async uploadResource(connectId: string, params: DeviceUploadResourceParams) {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK
      ?.deviceUploadResource(connectId, params)
      .then((response) => {
        if (!response.success) {
          return Promise.reject(convertDeviceError(response.payload));
        }
        return response;
      });
  }

  @backgroundMethod()
  async checkBootloaderRelease(
    connectId: string,
    willUpdateFirmwareVersion: string,
  ) {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK
      ?.checkBootloaderRelease(platformEnv.isNative ? connectId : undefined, {
        willUpdateFirmwareVersion,
      })
      .then((response) => {
        if (!response.success) {
          return Promise.reject(convertDeviceError(response.payload));
        }
        return response.payload;
      });
  }

  @backgroundMethod()
  async updateBootloaderForClassicAndMini(connectId: string) {
    // const { dispatch } = this.backgroundApi;
    // dispatch(setUpdateFirmwareStep(''));
    const hardwareSDK = await this.getSDKInstance();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const listener = (data: any) => {
      // dispatch(setUpdateFirmwareStep(get(data, 'data.message', '')));
    };
    hardwareSDK.on('ui-firmware-tip', listener);
    try {
      const response = await hardwareSDK.firmwareUpdateV2(
        platformEnv.isNative ? connectId : undefined,
        {
          updateType: 'firmware',
          platform: platformEnv.symbol ?? 'web',
          isUpdateBootloader: true,
        },
      );
      return response;
    } finally {
      hardwareSDK.off('ui-firmware-tip', listener);
    }
  }

  @backgroundMethod()
  async checkBridgeRelease(
    connectId: string,
    willUpdateFirmwareVersion: string,
  ) {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK
      ?.checkBridgeRelease(platformEnv.isNative ? connectId : undefined, {
        willUpdateFirmwareVersion,
      })
      .then((response) => {
        if (!response.success) {
          return Promise.reject(convertDeviceError(response.payload));
        }
        return response.payload;
      });
  }

  @backgroundMethod()
  async updateSettings({
    hardwareConnectSrc,
  }: {
    hardwareConnectSrc?: EOnekeyDomain;
  }) {
    try {
      const hardwareSDK = await this.getSDKInstance();
      const connectSrc = generateConnectSrc(hardwareConnectSrc);
      if (hardwareSDK && hardwareSDK.updateSettings) {
        const res = await hardwareSDK?.updateSettings({ connectSrc });
        console.log('Switch hardware connect src success', res);
      }
    } catch (e) {
      console.log('Switch hardware connect src setting failed', e);
    }
  }
}

export default ServiceHardware;
