import { UI_RESPONSE } from '@onekeyfe/hd-core';

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
import {
  convertDeviceError,
  convertDeviceResponse,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  CoreSDKLoader,
  generateConnectSrc,
  getHardwareSDKInstance,
} from '@onekeyhq/shared/src/hardware/instance';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  EOnekeyDomain,
  IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

import {
  EHardwareUiStateAction,
  hardwareUiStateAtom,
  settingsPersistAtom,
} from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

import type { IHardwareUiPayload } from '../states/jotai/atoms';
import type {
  CoreApi,
  DeviceSettingsParams,
  DeviceUploadResourceParams,
  DeviceVerifySignature,
  Features,
  UiResponseEvent,
} from '@onekeyfe/hd-core';
import type { Success } from '@onekeyfe/hd-transport';

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
        supportInputPinOnSoftware,
      } = await CoreSDKLoader();
      instance.on(UI_EVENT, async (e) => {
        const { type, payload } = e;
        console.log('=>>>> UI_EVENT: ', type, payload);

        const { device, type: eventType, passphraseState } = payload || {};
        const { deviceType, connectId, deviceId, features } = device || {};
        const { bootloader_mode: isBootloaderMode } = features || {};
        const inputPinOnSoftware = supportInputPinOnSoftware(features);

        const usedPayload: IHardwareUiPayload = {
          uiRequestType: type,
          eventType,
          deviceType,
          deviceId,
          connectId,
          isBootloaderMode: Boolean(isBootloaderMode),
          passphraseState,
          supportInputPinOnSoftware: inputPinOnSoftware.support,
        };

        // >>> mock hardware forceInputOnDevice
        // if (usedPayload) {
        //   usedPayload.supportInputPinOnSoftware = false;
        // }

        // skip ui-close_window event, which cause infinite loop
        //  ( emit ui-close_window -> Dialog close -> sdk cancel -> emit ui-close_window )
        if (type !== EHardwareUiStateAction.CLOSE_UI_WINDOW) {
          await hardwareUiStateAtom.set({
            action: type,
            connectId,
            payload: usedPayload,
          });
        }
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
        const error: OneKeyHardwareError | undefined = e as OneKeyHardwareError;
        if (error instanceof OneKeyHardwareError && !error?.reconnect) {
          return Promise.reject(error);
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
  async getFeatures(connectId: string): Promise<Features> {
    const hardwareSDK = await this.getSDKInstance();

    return convertDeviceResponse(() => hardwareSDK?.getFeatures(connectId));
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
  }): Promise<string | undefined> {
    const hardwareSDK = await this.getSDKInstance();

    return convertDeviceResponse(() =>
      hardwareSDK?.getPassphraseState(connectId, {
        initSession: forceInputPassphrase, // always re-input passphrase on device
        useEmptyPassphrase,
        // deriveCardano, // TODO gePassphraseState different if networkImpl === IMPL_ADA ?
      }),
    );
  }

  @backgroundMethod()
  async cancel(connectId: string) {
    if (!connectId) {
      throw new Error('device cancel error: connectId is undefined');
    }
    const sdk = await this.getSDKInstance();
    // sdk.cancel() always cause device re-emit UI_EVENT:  ui-close_window

    // cancel the hardware process
    // (cancel not working on enter pin on device mode, use getFeatures() later)
    sdk.cancel(connectId);

    // mute getFeatures error
    try {
      // force hardware drop process
      await this.getFeatures(connectId); // TODO move to sdk.cancel()
    } catch (e) {
      //
    }
  }

  @backgroundMethod()
  async sendUiResponse(response: UiResponseEvent) {
    return (await this.getSDKInstance()).uiResponse(response);
  }

  @backgroundMethod()
  async rebootToBootloader(connectId: string): Promise<boolean> {
    const hardwareSDK = await this.getSDKInstance();
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceUpdateReboot(connectId),
    );
  }

  @backgroundMethod()
  async rebootToBoardloader(connectId: string): Promise<Success> {
    const hardwareSDK = await this.getSDKInstance();
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceRebootToBoardloader(connectId),
    );
  }

  @backgroundMethod()
  async getDeviceCertWithSig(
    connectId: string,
    dataHex: string,
  ): Promise<DeviceVerifySignature> {
    const hardwareSDK = await this.getSDKInstance();
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceVerify(connectId, { dataHex }),
    );
  }

  @backgroundMethod()
  async changePin(connectId: string, remove = false): Promise<Success> {
    const hardwareSDK = await this.getSDKInstance();

    return convertDeviceResponse(() =>
      hardwareSDK?.deviceChangePin(connectId, {
        remove,
      }),
    );
  }

  @backgroundMethod()
  async applySettings(connectId: string, settings: DeviceSettingsParams) {
    const hardwareSDK = await this.getSDKInstance();

    return convertDeviceResponse(() =>
      hardwareSDK?.deviceSettings(connectId, settings),
    );
  }

  @backgroundMethod()
  async getDeviceSupportFeatures(connectId: string) {
    const hardwareSDK = await this.getSDKInstance();

    return convertDeviceResponse(() =>
      hardwareSDK?.deviceSupportFeatures(connectId),
    );
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
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceUploadResource(connectId, params),
    );
  }

  @backgroundMethod()
  async checkBootloaderRelease(
    connectId: string,
    willUpdateFirmwareVersion: string,
  ) {
    const hardwareSDK = await this.getSDKInstance();
    return convertDeviceResponse(() =>
      hardwareSDK?.checkBootloaderRelease(
        platformEnv.isNative ? connectId : undefined,
        {
          willUpdateFirmwareVersion,
        },
      ),
    );
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
    return convertDeviceResponse(() =>
      hardwareSDK?.checkBridgeRelease(
        platformEnv.isNative ? connectId : undefined,
        {
          willUpdateFirmwareVersion,
        },
      ),
    );
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

  @backgroundMethod()
  async showCheckingDeviceDialog({ connectId }: { connectId: string }) {
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.DeviceChecking,
      connectId,
      payload: undefined,
    });

    // wait animation done
    await timerUtils.wait(300);
  }

  @backgroundMethod()
  async showDeviceProcessLoadingDialog({ connectId }: { connectId: string }) {
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.ProcessLoading,
      connectId,
      payload: undefined,
    });
    // wait animation done
    await timerUtils.wait(300);
  }

  @backgroundMethod()
  async showEnterPassphraseOnDeviceDialog() {
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
  async sendPassphraseToDevice({ passphrase }: { passphrase: string }) {
    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: {
        value: passphrase,
        passphraseOnDevice: false,
        save: false,
      },
    });
  }

  @backgroundMethod()
  async showEnterPinOnDeviceDialog({ connectId }: { connectId: string }) {
    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PIN,
      payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
    });
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.EnterPinOnDevice,
      connectId,
      payload: undefined,
    });
  }

  @backgroundMethod()
  async sendPinToDevice({ pin }: { pin: string }) {
    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PIN,
      payload: pin,
    });
  }

  @backgroundMethod()
  async closeHardwareUiStateDialog({
    skipCancel,
    delay,
    connectId,
    reason,
  }: {
    skipCancel?: boolean;
    delay?: number;
    connectId: string;
    reason?: string;
  }) {
    try {
      console.log(`closeHardwareUiStateDialog: ${reason || 'no reason'}`);
      if (delay) {
        await timerUtils.wait(delay);
      }
      await hardwareUiStateAtom.set(undefined);

      if (!skipCancel) {
        // do not wait cancel, may cause caller stuck
        void this.cancel(connectId);
      }
    } catch (error) {
      // closeHardwareUiStateDialog should be called safely, do not block caller
    }
  }

  async withHardwareProcessing<T>(
    fn: () => Promise<T>,
    {
      deviceParams,
      skipCancel,
    }: {
      deviceParams: IDeviceSharedCallParams | undefined;
      skipCancel?: boolean;
    },
  ): Promise<T> {
    // >>> mock hardware connectId
    // if (deviceParams?.dbDevice && deviceParams) {
    //   deviceParams.dbDevice.connectId = '11111';
    // }

    const device = deviceParams?.dbDevice;
    const connectId = device?.connectId;
    if (connectId) {
      await this.showCheckingDeviceDialog({
        connectId,
      });
    }
    try {
      const r = await fn();
      console.log('withHardwareProcessing done: ', r);
      return r;
    } catch (error) {
      console.error('withHardwareProcessing ERROR: ', error);
      throw error;
    } finally {
      if (connectId) {
        await this.closeHardwareUiStateDialog({
          delay: 300,
          connectId,
          skipCancel,
        });
      }
    }
  }
}

export default ServiceHardware;
