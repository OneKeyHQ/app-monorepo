import { Semaphore } from 'async-mutex';
import { uniq } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { makeTimeoutPromise } from '@onekeyhq/shared/src/background/backgroundUtils';
import { HARDWARE_SDK_VERSION } from '@onekeyhq/shared/src/config/appConfig';
import * as deviceErrors from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  CoreSDKLoader,
  getHardwareSDKInstance,
} from '@onekeyhq/shared/src/hardware/instance';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IBleFirmwareReleasePayload,
  IFirmwareReleasePayload,
  IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types/device';
import { EOneKeyDeviceMode } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import {
  EHardwareUiStateAction,
  hardwareUiStateAtom,
  hardwareUiStateCompletedAtom,
  settingsPersistAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import { DeviceSettingsManager } from './DeviceSettingsManager';
import { HardwareVerifyManager } from './HardwareVerifyManager';
import serviceHardwareUtils from './serviceHardwareUtils';

import type {
  IGetDeviceAdvanceSettingsParams,
  IGetDeviceLabelParams,
  ISetDeviceLabelParams,
  ISetInputPinOnSoftwareParams,
  ISetPassphraseEnabledParams,
} from './DeviceSettingsManager';
import type {
  IFirmwareAuthenticateParams,
  IShouldAuthenticateFirmwareParams,
} from './HardwareVerifyManager';
import type { IHardwareUiPayload } from '../../states/jotai/atoms';
import type {
  CommonParams,
  CoreApi,
  CoreMessage,
  DeviceUploadResourceParams,
  Features,
  IDeviceType,
  KnownDevice,
  SearchDevice,
  UiEvent,
} from '@onekeyfe/hd-core';

export type IDeviceGetFeaturesOptions = {
  connectId: string | undefined;
  params?: CommonParams & {
    allowEmptyConnectId?: boolean;
  };
};

@backgroundClass()
class ServiceHardware extends ServiceBase {
  hardwareVerifyManager: HardwareVerifyManager = new HardwareVerifyManager({
    backgroundApi: this.backgroundApi,
  });

  deviceSettingsManager: DeviceSettingsManager = new DeviceSettingsManager({
    backgroundApi: this.backgroundApi,
  });

  private registeredEvents = false;

  checkSdkVersionValid() {
    if (process.env.NODE_ENV !== 'production') {
      const {
        version: version1,
      } = require('@onekeyfe/hd-ble-sdk/package.json');
      const { version: version2 } = require('@onekeyfe/hd-core/package.json');
      const { version: version3 } = require('@onekeyfe/hd-shared/package.json');
      const {
        version: version4,
      } = require('@onekeyfe/hd-transport/package.json');
      const {
        version: version5,
      } = require('@onekeyfe/hd-web-sdk/package.json');
      const allVersions = {
        version1,
        version2,
        version3,
        version4,
        version5,
        HARDWARE_SDK_VERSION,
      };
      const versions = uniq(Object.values(allVersions));
      if (versions.length > 1) {
        throw new Error(
          `Hardware SDK versions not equal: ${JSON.stringify(allVersions)}`,
        );
      }
    }
  }

  async getSDKInstance() {
    this.checkSdkVersionValid();

    const { hardwareConnectSrc } = await settingsPersistAtom.get();
    const isPreRelease =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'usePreReleaseConfig',
      );
    const debugMode =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'showDeviceDebugLogs',
      );
    try {
      const instance = await getHardwareSDKInstance({
        // https://data.onekey.so/pre-config.json?noCache=1714090312200
        // https://data.onekey.so/config.json?nocache=0.8336416330053136
        isPreRelease: isPreRelease === true,
        hardwareConnectSrc,
        debugMode,
      });
      // TODO re-register events when hardwareConnectSrc or isPreRelease changed
      await this.registerSdkEvents(instance);
      return instance;
    } catch (error) {
      // always show error toast when sdk init, so user can report to us
      void this.backgroundApi.serviceApp.showToast({
        method: 'error',
        title: (error as Error)?.message || 'Hardware SDK init failed',
      });
      throw error;
    }
  }

  private async specialProcessingEvent({
    originEvent,
    usedPayload,
  }: {
    originEvent: UiEvent;
    usedPayload: IHardwareUiPayload;
  }): Promise<{
    uiRequestType: EHardwareUiStateAction;
    payload: IHardwareUiPayload;
  }> {
    const { supportInputPinOnSoftware: supportInputPinOnSoftwareSdk } =
      await CoreSDKLoader();

    let newUiRequestType = originEvent.type as EHardwareUiStateAction;
    const newPayload = usedPayload;

    // Handler Request Pin
    // If the user set is to enter pin on the device, change the event to enter pin on the hardware
    if (originEvent.type === EHardwareUiStateAction.REQUEST_PIN) {
      const dbDevice = await localDb.getDeviceByQuery({
        connectId: newPayload.connectId,
      });

      if (
        dbDevice?.deviceType &&
        ['touch', 'pro'].includes(dbDevice?.deviceType)
      ) {
        newUiRequestType = EHardwareUiStateAction.EnterPinOnDevice;
      } else {
        const { device } = originEvent.payload || {};
        const { features } = device || {};

        const inputPinOnSoftware = supportInputPinOnSoftwareSdk(features);
        const supportInputPinOnSoftware =
          dbDevice?.settings?.inputPinOnSoftware !== false &&
          inputPinOnSoftware.support;

        if (!supportInputPinOnSoftware) {
          await this.backgroundApi.serviceHardwareUI.showEnterPinOnDevice();
          newUiRequestType = EHardwareUiStateAction.EnterPinOnDevice;
        }
      }
    }

    if (originEvent.type === EHardwareUiStateAction.FIRMWARE_TIP) {
      newPayload.firmwareTipData = originEvent.payload.data;
    }

    if (originEvent.type === EHardwareUiStateAction.FIRMWARE_PROGRESS) {
      newPayload.firmwareProgress = originEvent.payload.progress;
    }

    return {
      uiRequestType: newUiRequestType,
      payload: newPayload,
    };
  }

  async registerSdkEvents(instance: CoreApi) {
    if (!this.registeredEvents) {
      this.registeredEvents = true;
      const {
        UI_EVENT,
        DEVICE,
        LOG_EVENT,
        FIRMWARE,
        FIRMWARE_EVENT,
        // UI_REQUEST,
      } = await CoreSDKLoader();
      instance.on(UI_EVENT, async (e) => {
        const originEvent = e as UiEvent;
        const { type: uiRequestType, payload } = e;
        // console.log('=>>>> UI_EVENT: ', uiRequestType, payload);

        const { device, type: eventType, passphraseState } = payload || {};
        const { deviceType, connectId, deviceId, features } = device || {};
        const deviceMode = await this.getDeviceModeFromFeatures({
          features: features || {},
        });
        const isBootloaderMode = deviceMode === EOneKeyDeviceMode.bootloader;

        const usedPayload: IHardwareUiPayload = {
          uiRequestType,
          eventType,
          deviceType,
          deviceId,
          connectId,
          deviceMode,
          isBootloaderMode: Boolean(isBootloaderMode),
          passphraseState,
          rawPayload: payload,
        };

        const { uiRequestType: newUiRequestType, payload: newPayload } =
          await this.specialProcessingEvent({
            originEvent,
            usedPayload,
          });

        // >>> mock hardware forceInputOnDevice
        // if (usedPayload) {
        //   usedPayload.supportInputPinOnSoftware = false;
        // }

        // skip ui-close_window event, which cause infinite loop
        //  ( emit ui-close_window -> Dialog close -> sdk cancel -> emit ui-close_window )
        if (
          ![
            // skip events
            EHardwareUiStateAction.CLOSE_UI_WINDOW,
            EHardwareUiStateAction.PREVIOUS_ADDRESS,
          ].includes(newUiRequestType)
        ) {
          // show hardware ui dialog
          await hardwareUiStateAtom.set({
            action: newUiRequestType,
            connectId,
            payload: newPayload,
          });
        }
        await hardwareUiStateCompletedAtom.set({
          action: newUiRequestType,
          connectId,
          payload: newPayload,
        });
      });

      instance.on(DEVICE.FEATURES, (features: IOneKeyDeviceFeatures) => {
        if (!features || !features.device_id) return;

        // TODO: save features to dbDevice
        serviceHardwareUtils.hardwareLog('features update', features);

        void localDb.updateDevice({
          features,
        });
      });

      // TODO how to emit this event?
      // call getFeatures() or checkFirmwareRelease();
      instance.on(FIRMWARE_EVENT, (messages: CoreMessage) => {
        if (messages.type === FIRMWARE.RELEASE_INFO) {
          const payload: IFirmwareReleasePayload = {
            ...messages.payload,
            features: messages?.payload?.device?.features,
            connectId: messages?.payload?.device?.connectId ?? undefined,
          };
          serviceHardwareUtils.hardwareLog(
            'FIRMWARE_EVENT>RELEASE_INFO: ',
            payload,
          );
          void this.backgroundApi.serviceFirmwareUpdate.setFirmwareUpdateInfo(
            payload,
          );
        }
        if (messages.type === FIRMWARE.BLE_RELEASE_INFO) {
          const payload: IBleFirmwareReleasePayload = {
            ...messages.payload,
            features: messages?.payload?.device?.features,
            connectId: messages?.payload?.device?.connectId ?? undefined,
          };
          serviceHardwareUtils.hardwareLog(
            'FIRMWARE_EVENT>BLE_RELEASE_INFO: ',
            payload,
          );
          void this.backgroundApi.serviceFirmwareUpdate.setBleFirmwareUpdateInfo(
            payload,
          );
        }
      });

      instance.on(
        LOG_EVENT,
        (messages: { event: string; type: string; payload: string[] }) => {
          const messageType =
            messages.payload.length > 0 ? messages.payload[0] : '';

          if (
            messageType.includes('@onekey/hd-core') ||
            messageType.includes('@onekey/hd-transport') ||
            messageType.includes('@onekey/hd-ble-transport')
          ) {
            defaultLogger.hardware.sdkLog.log(
              messages.event,
              messages.payload.join(' '),
            );
          }
        },
      );
    }
  }

  @backgroundMethod()
  async passHardwareEventsFromOffscreenToBackground(eventMessage: CoreMessage) {
    const sdk = await this.getSDKInstance();
    sdk.emit(eventMessage.event, eventMessage);
  }

  // startDeviceScan
  // TODO use convertDeviceResponse()
  @backgroundMethod()
  async searchDevices() {
    const hardwareSDK = await this.getSDKInstance();
    const response = await hardwareSDK?.searchDevices();
    console.log('searchDevices response: ', response);
    return response;
    // if (response.success) {
    //   return response.payload;
    // }
    // const deviceError = convertDeviceError(response.payload);
    // return Promise.reject(deviceError);
  }

  private connectDevice = (connectId: string) =>
    this.getFeaturesWithoutCache({
      connectId,
    });

  private handlerConnectError = async (
    e: any,
    options?: {
      connectId?: string;
      awaitBonded?: boolean;
      reconnect?: boolean;
    },
  ): Promise<Features | undefined> => {
    const error: deviceErrors.OneKeyHardwareError | undefined =
      e as deviceErrors.OneKeyHardwareError;

    const connectId = options?.connectId;
    if (
      platformEnv.isNativeAndroid &&
      error instanceof deviceErrors.DeviceNotBonded &&
      options?.awaitBonded &&
      connectId
    ) {
      const checkBonded = await deviceUtils.checkDeviceBonded(connectId);
      if (checkBonded) {
        console.log('Android device was bonded, will connect');
        try {
          return await this.connectDevice(connectId);
        } catch (innerError: any) {
          // only handler error
          return this.handlerConnectError(innerError);
        }
      }
    }

    if (
      error instanceof deviceErrors.OneKeyHardwareError &&
      !error?.reconnect
    ) {
      throw error;
    }
    // TODO handle reconnect?
  };

  @backgroundMethod()
  async connect({
    device,
    awaitBonded,
  }: {
    device: SearchDevice;
    awaitBonded?: boolean;
  }): Promise<Features | undefined> {
    const { connectId } = device;
    if (!connectId) {
      throw new Error('hardware connect ERROR: connectId is undefined');
    }

    if (platformEnv.isNative) {
      try {
        return await this.connectDevice(connectId);
      } catch (e: any) {
        return this.handlerConnectError(e, {
          connectId,
          reconnect: false,
          awaitBonded,
        });
      }
    } else {
      /**
       * USB does not need the extra getFeatures call
       */
      try {
        return await this.connectDevice(connectId);
      } catch (e: any) {
        return (device as KnownDevice).features;
      }
    }
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
  async cancelByWallet({ walletId }: { walletId: string | undefined }) {
    try {
      if (walletId && accountUtils.isHwWallet({ walletId })) {
        const device =
          await this.backgroundApi.serviceAccount.getWalletDeviceSafe({
            walletId,
          });
        if (device?.connectId) {
          await this.cancel(device.connectId);
        }
      }
    } catch (error) {
      //
    }
  }

  @backgroundMethod()
  async cancel(
    connectId: string | undefined,
    {
      forceDeviceResetToHome,
    }: {
      forceDeviceResetToHome?: boolean;
    } = {},
  ) {
    const sdk = await this.getSDKInstance();
    // sdk.cancel() always cause device re-emit UI_EVENT:  ui-close_window

    // cancel the hardware process
    // (cancel not working on enter pin on device mode, use getFeatures() later)
    try {
      sdk.cancel(connectId);
    } catch (e: any) {
      const { message } = e || {};
      console.log('sdk cancel error: ', message);
    }

    console.log('sdk call cancel device: ', connectId);

    // mute getFeatures error
    try {
      // force hardware drop process
      if (forceDeviceResetToHome) {
        console.log('sdk call cancel device getFeatures: ', connectId);
        await this.getFeaturesWithoutCache({
          connectId,
          params: {
            retryCount: 0,
          },
        }); // TODO move to sdk.cancel()
      }
    } catch (error) {
      // ignore
    }
  }

  // TODO run firmwareAuthenticate() check bootloader mode by features
  async getDeviceModeFromFeatures({
    features,
  }: {
    features: IOneKeyDeviceFeatures;
  }): Promise<EOneKeyDeviceMode> {
    return deviceUtils.getDeviceModeFromFeatures({ features });
  }

  async getConnectIdFromFeatures({
    features,
  }: {
    features: IOneKeyDeviceFeatures;
  }): Promise<string | undefined> {
    if (features) {
      const dbDevice = await localDb.getDeviceByQuery({
        features,
      });
      if (dbDevice?.connectId) {
        return dbDevice?.connectId;
      }
    }

    // TODO get connectId from SDK: connectId = getDeviceUUID() only works on usb sdk
    // connectId: DataManager.isBleConnect(env) ? this.mainId || null : getDeviceUUID(this.features),
    // TODO uuid is equal to connectId in ble sdk?
    // const connectId = getDeviceUUID(features);
    // if (connectId) {
    //   return connectId;
    // }

    return undefined;
  }

  async getDeviceTypeFromFeatures({
    features,
  }: {
    features: IOneKeyDeviceFeatures;
  }): Promise<IDeviceType> {
    return deviceUtils.getDeviceTypeFromFeatures({ features });
  }

  @backgroundMethod()
  async getDeviceSupportFeatures(connectId: string) {
    const hardwareSDK = await this.getSDKInstance();
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceSupportFeatures(connectId),
    );
  }

  _getFeaturesLowLevel = async (options: IDeviceGetFeaturesOptions) => {
    const { connectId, params } = options;
    serviceHardwareUtils.hardwareLog('call getFeatures()', connectId);
    if (!params?.allowEmptyConnectId && !connectId) {
      throw new Error('hardware getFeatures ERROR: connectId is undefined');
    }
    const hardwareSDK = await this.getSDKInstance();
    const features = await convertDeviceResponse(() =>
      hardwareSDK?.getFeatures(connectId, params),
    );
    return features;
  };

  _getFeaturesWithTimeout = makeTimeoutPromise({
    asyncFunc: this._getFeaturesLowLevel,
    // todo remove: sdk guarantees not to block this method
    timeout: timerUtils.getTimeDurationMs({ seconds: 60 }),
    timeoutRejectError: new deviceErrors.DeviceMethodCallTimeout(),
  });

  getFeaturesMutex = new Semaphore(1);

  _getFeaturesWithMutex = async (
    options: IDeviceGetFeaturesOptions,
  ): Promise<IOneKeyDeviceFeatures> => {
    const features = await this.getFeaturesMutex.runExclusive(async () => {
      const r = await this._getFeaturesWithTimeout(options);
      return r;
    });
    return features;
  };

  _getFeaturesWithCache = memoizee(
    async (options: IDeviceGetFeaturesOptions) => {
      const features = await this._getFeaturesWithMutex(options);
      return features;
    },
    {
      promise: true,
      max: 10,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 15 }),
      normalizer: (args) => args[0]?.connectId || '',
    },
  );

  @backgroundMethod()
  async getFeatures(options: IDeviceGetFeaturesOptions) {
    const features = await this._getFeaturesWithCache(options);
    return features;
  }

  @backgroundMethod()
  async getFeaturesWithoutCache(options: IDeviceGetFeaturesOptions) {
    const features = await this._getFeaturesWithMutex(options);
    return features;
  }

  @backgroundMethod()
  async getFeaturesByWallet({ walletId }: { walletId: string }) {
    const device = await this.backgroundApi.serviceAccount.getWalletDevice({
      walletId,
    });
    return this.getFeatures({ connectId: device.connectId });
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
  async setInputPinOnSoftware(p: ISetInputPinOnSoftwareParams) {
    return this.deviceSettingsManager.setInputPinOnSoftware(p);
  }

  @backgroundMethod()
  async setPassphraseEnabled(p: ISetPassphraseEnabledParams) {
    return this.deviceSettingsManager.setPassphraseEnabled(p);
  }

  @backgroundMethod()
  async getDeviceAdvanceSettings(p: IGetDeviceAdvanceSettingsParams) {
    return this.deviceSettingsManager.getDeviceAdvanceSettings(p);
  }

  @backgroundMethod()
  async getDeviceLabel(p: IGetDeviceLabelParams) {
    return this.deviceSettingsManager.getDeviceLabel(p);
  }

  @backgroundMethod()
  async setDeviceLabel(p: ISetDeviceLabelParams) {
    return this.deviceSettingsManager.setDeviceLabel(p);
  }

  @backgroundMethod()
  async shouldAuthenticateFirmware(p: IShouldAuthenticateFirmwareParams) {
    return this.hardwareVerifyManager.shouldAuthenticateFirmware(p);
  }

  @backgroundMethod()
  async firmwareAuthenticate(p: IFirmwareAuthenticateParams) {
    return this.hardwareVerifyManager.firmwareAuthenticate(p);
  }

  @backgroundMethod()
  async uploadResource(connectId: string, params: DeviceUploadResourceParams) {
    const hardwareSDK = await this.getSDKInstance();
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceUploadResource(connectId, params),
    );
  }

  @backgroundMethod()
  async getLogs(): Promise<string[]> {
    const logs: string[] = ['===== device logs ====='];
    try {
      const hardwareSDK = await this.getSDKInstance();
      const messages = await convertDeviceResponse(() => hardwareSDK.getLogs());
      logs.push(...messages);
    } catch (error) {
      // ignore
    }
    return logs;
  }
}

export default ServiceHardware;
