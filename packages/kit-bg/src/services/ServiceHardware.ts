/* eslint-disable no-nested-ternary */
import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { get } from 'lodash';

import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import type { DevicePayload } from '@onekeyhq/engine/src/types/device';
import {
  addConnectedConnectId,
  removeConnectedConnectId,
  setHardwarePopup,
  setPreviousAddress,
  setUpdateFirmwareStep,
  updateDevicePassphraseOpenedState,
} from '@onekeyhq/kit/src/store/reducers/hardware';
import {
  setDeviceUpdates,
  setDeviceVersion,
  setVerification,
} from '@onekeyhq/kit/src/store/reducers/settings';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import {
  BridgeTimeoutError,
  FirmwareVersionTooLow,
  InitIframeLoadFail,
  InitIframeTimeout,
} from '@onekeyhq/kit/src/utils/hardware/errors';
import { wait } from '@onekeyhq/kit/src/utils/helper';
import type {
  BLEFirmwareInfo,
  SYSFirmwareInfo,
} from '@onekeyhq/kit/src/utils/updates/type';
import type { FirmwareType } from '@onekeyhq/kit/src/views/Hardware/UpdateFirmware/Updating';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  CoreSDKLoader,
  generateConnectSrc,
  getHardwareSDKInstance,
} from '@onekeyhq/shared/src/device/hardwareInstance';
import { isPassphraseWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  EOnekeyDomain,
  IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types';

import ServiceBase from './ServiceBase';

import type {
  BleReleaseInfoEvent,
  CoreMessage,
  DeviceSendSupportFeatures,
  DeviceSettingsParams,
  DeviceSupportFeaturesPayload,
  DeviceUploadResourceParams,
  IDeviceType,
  KnownDevice,
  ReleaseInfoEvent,
  Success,
  UiResponseEvent,
  Unsuccessful,
} from '@onekeyfe/hd-core';

type ConnectedEvent = { device: KnownDevice };

@backgroundClass()
class ServiceHardware extends ServiceBase {
  connectedDeviceType: IDeviceType = 'classic';

  registeredEvents = false;

  tryCount = 0;

  stopConnect = false;

  featuresCache: Record<string, IOneKeyDeviceFeatures> = {};

  async getSDKInstance() {
    const { enable, preReleaseUpdate } =
      this.backgroundApi.store.getState().settings.devMode || {};

    const { hardwareConnectSrc } = this.backgroundApi.store.getState().settings;
    const isPreRelease = preReleaseUpdate && enable;

    return getHardwareSDKInstance({
      isPreRelease: isPreRelease ?? false,
      hardwareConnectSrc,
    }).then(async (instance) => {
      if (!this.registeredEvents) {
        this.registeredEvents = true;

        const {
          LOG_EVENT,
          DEVICE,
          FIRMWARE,
          FIRMWARE_EVENT,
          UI_REQUEST,
          supportInputPinOnSoftware,
        } = await CoreSDKLoader();
        instance.on('UI_EVENT', (e) => {
          const { type, payload } = e;

          setTimeout(() => {
            const { device, type: eventType, passphraseState } = payload || {};
            const { deviceType, connectId, deviceId, features } = device || {};
            const { bootloader_mode: bootLoaderMode } = features || {};
            const inputPinOnSoftware = supportInputPinOnSoftware(features);

            this.backgroundApi.dispatch(
              setHardwarePopup({
                uiRequest: type,
                payload: {
                  type: eventType,
                  deviceType,
                  deviceId,
                  deviceConnectId: connectId,
                  deviceBootLoaderMode: !!bootLoaderMode,
                  passphraseState,
                  supportInputPinOnSoftware: inputPinOnSoftware.support,
                },
              }),
            );
          }, 0);
        });

        instance.on(LOG_EVENT, (messages: CoreMessage) => {
          if (Array.isArray(messages?.payload)) {
            debugLogger.hardwareSDK.info(messages.payload.join(' '));
          }
        });

        instance.on(
          DEVICE.FEATURES,
          async (features: IOneKeyDeviceFeatures) => {
            if (!features || !features.device_id) return;

            try {
              const device =
                await this.backgroundApi.engine.getHWDeviceByDeviceId(
                  features.device_id,
                );
              if (!device) return;

              try {
                const wallets = await this.backgroundApi.engine.getWallets();
                const wallet = wallets.find(
                  (w) =>
                    w.associatedDevice === device.id && !isPassphraseWallet(w),
                );
                if (wallet) {
                  this.featuresCache[wallet.id] = features;
                  this.syncDeviceLabel(features, wallet.id);
                }
              } catch {
                // ignore
              }

              this._checkPassphraseEnableStatus(device.id, features);
            } catch {
              // empty
            }
          },
        );

        instance.on(FIRMWARE_EVENT, (messages: CoreMessage) => {
          if (messages.type === FIRMWARE.RELEASE_INFO) {
            this._checkFirmwareUpdate(messages.payload as unknown as any);
          }
          if (messages.type === FIRMWARE.BLE_RELEASE_INFO) {
            this._checkBleFirmwareUpdate(messages.payload as unknown as any);
          }
        });

        instance.on(
          DEVICE.SUPPORT_FEATURES,
          (features: DeviceSupportFeaturesPayload) => {
            this._checkDeviceSettings(features);
          },
        );

        instance.on(DEVICE.CONNECT, ({ device }: ConnectedEvent) => {
          if (device.connectId) {
            this.backgroundApi.dispatch(
              addConnectedConnectId(device.connectId),
            );
          }
        });

        instance.on(DEVICE.DISCONNECT, ({ device }: ConnectedEvent) => {
          if (device.connectId) {
            this.backgroundApi.dispatch(
              removeConnectedConnectId(device.connectId),
            );
          }
        });
        instance.on(UI_REQUEST.PREVIOUS_ADDRESS_RESULT, (payload) => {
          this.backgroundApi.dispatch(setPreviousAddress(payload));
        });
      }
      return instance;
    });
  }

  /*
    if (platformEnv.isExtensionBackgroundServiceWorker) {
      chrome.runtime.onMessage.addListener(
        (msg: IOffscreenApiHardwareEvent, sender, sendResponse) => {
          // TODO check sender origin
          // eslint-disable-next-line @typescript-eslint/require-await
          if (msg && msg.type === OFFSCREEN_API_HARDWARE_EVENT) {
            if (HardwareSDK) {
              const eventParams = msg.payload;
              HardwareSDK.emit(eventParams.event, { ...eventParams });
            }
          }
          // **** return true to indicate that sendResponse is async
          // return true;
        },
      );
    }
  */
  @backgroundMethod()
  async passHardwareEventsFromOffscreenToBackground(eventMessage: CoreMessage) {
    const sdk = await this.getSDKInstance();
    sdk.emit(eventMessage.event, eventMessage);
  }

  @backgroundMethod()
  async getFeatursByWalletId(walletId: string) {
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
  async cleanFeaturesCache(walletId: string) {
    if (this.featuresCache[walletId]) {
      delete this.featuresCache[walletId];
    }
    return Promise.resolve(true);
  }

  @backgroundMethod()
  async searchDevices() {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK?.searchDevices();
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
    const { getDeviceType } = await CoreSDKLoader();
    const response = await hardwareSDK?.getFeatures(connectId);

    if (response.success) {
      // this.backgroundApi.dispatch(addConnectedConnectId(connectId));

      this.connectedDeviceType = getDeviceType(response.payload);
      return response.payload;
    }

    const deviceError = deviceUtils.convertDeviceError(response.payload);

    return Promise.reject(deviceError);
  }

  @backgroundMethod()
  async unlockDevice(connectId: string) {
    // only unlock device when device is locked
    return this.getPassphraseState(connectId, true);
  }

  @backgroundMethod()
  async getPassphraseState(
    connectId: string,
    useEmptyPassphrase?: boolean,
    deriveCardano?: boolean,
  ) {
    const hardwareSDK = await this.getSDKInstance();
    const response = await hardwareSDK?.getPassphraseState(connectId, {
      initSession: true,
      useEmptyPassphrase,
      deriveCardano,
    });

    if (response.success) {
      return response.payload ?? undefined;
    }

    const deviceError = deviceUtils.convertDeviceError(response.payload);

    return Promise.reject(deviceError);
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
        return Promise.reject(deviceUtils.convertDeviceError(response.payload));
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
          return Promise.reject(
            deviceUtils.convertDeviceError(response.payload),
          );
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
          return Promise.reject(
            deviceUtils.convertDeviceError(response.payload),
          );
        }
        return response.payload;
      });
  }

  @backgroundMethod()
  async autoUpdateFirmware(
    connectId: string,
    firmwareType: FirmwareType,
    deviceType: IDeviceType | undefined,
  ) {
    const { dispatch } = this.backgroundApi;
    dispatch(setUpdateFirmwareStep(''));

    const hardwareSDK = await this.getSDKInstance();

    const listener = (data: any) => {
      dispatch(setUpdateFirmwareStep(get(data, 'data.message', '')));
    };
    hardwareSDK.on('ui-firmware-tip', listener);

    // dev
    const settings = this.backgroundApi.appSelector((s) => s.settings);
    const enable = settings?.devMode?.enable ?? false;
    const updateDeviceRes = settings?.devMode?.updateDeviceRes ?? false;

    const forcedUpdateRes = enable && updateDeviceRes;
    const version = settings.deviceUpdates?.[connectId][firmwareType]?.version;

    try {
      const response = await hardwareSDK.firmwareUpdateV2(
        platformEnv.isNative ? connectId : undefined,
        {
          updateType: firmwareType,
          forcedUpdateRes,
          version,
          platform: platformEnv.symbol ?? 'web',
        },
      );

      // update bootloader
      const isTouch = deviceType === 'touch' || deviceType === 'pro';
      if (isTouch && response.success && firmwareType === 'firmware') {
        const updateBootRes = await this.updateBootloader(connectId);
        if (!updateBootRes.success) return updateBootRes;
      }

      return response;
    } finally {
      hardwareSDK.off('ui-firmware-tip', listener);
    }
  }

  @backgroundMethod()
  async ensureDeviceExist(
    connectId: string,
    maxTryCount = 10,
    bootloaderMode = false,
  ) {
    return new Promise((resolve) => {
      let tryCount = 0;
      deviceUtils.startDeviceScan(
        (response) => {
          tryCount += 1;
          if (tryCount > maxTryCount) {
            deviceUtils.stopScan();
            resolve(false);
          }
          if (!response.success) {
            return;
          }
          const deviceExist = bootloaderMode
            ? // bootloader mode does not have connect id for classic
              (response.payload ?? []).length > 0
            : (response.payload ?? []).find((d) =>
                equalsIgnoreCase(d.connectId, connectId),
              );
          if (deviceExist) {
            deviceUtils.stopScan();
            resolve(true);
          }
        },
        () => {},
        1,
        3000,
        Number.MAX_VALUE,
      );
    });
  }

  updateBootloader(
    connectId: string,
  ): Promise<Unsuccessful | Success<boolean>> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      const hardwareSDK = await this.getSDKInstance();
      // restart count down
      await wait(8000);
      let tryCount = 0;
      //  polling device when restart success
      const DISCONNECT_ERROR = 'Request failed with status code';
      const excute = async () => {
        const isFoundDevice = await this.ensureDeviceExist(connectId);
        if (!isFoundDevice) {
          resolve({
            success: false,
            payload: {
              error: 'Device Not Found',
              code: HardwareErrorCode.DeviceNotFound,
            },
          });
        }
        const res = await hardwareSDK.deviceUpdateBootloader(connectId, {});
        if (!res.success) {
          if (
            res.payload.error.indexOf(DISCONNECT_ERROR) > -1 &&
            tryCount < 3
          ) {
            tryCount += 1;
            await excute();
          } else {
            resolve(res);
            return;
          }
        }
        resolve(res as unknown as Success<boolean>);
      };

      excute();
    });
  }

  /**
   * Change the pin of the hardware wallet
   * @param remove {boolean}
   * @returns {Promise<Success>}
   * @throws {OneKeyHardwareError}
   */
  @backgroundMethod()
  async changePin(connectId: string, remove = false) {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK
      ?.deviceChangePin(connectId, {
        remove,
      })
      .then((response) => {
        if (!response.success) {
          return Promise.reject(
            deviceUtils.convertDeviceError(response.payload),
          );
        }
        return response;
      });
  }

  /**
   * apply settings to the hardware wallet
   */
  @backgroundMethod()
  async applySettings(connectId: string, settings: DeviceSettingsParams) {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK?.deviceSettings(connectId, settings).then((response) => {
      if (!response.success) {
        return Promise.reject(deviceUtils.convertDeviceError(response.payload));
      }
      return response;
    });
  }

  @backgroundMethod()
  async setOnDeviceInputPin(
    connectId: string,
    deviceId: string,
    onDeviceInputPin: boolean,
  ) {
    // If open PIN input on the App
    // Check whether the hardware supports it
    if (!onDeviceInputPin) {
      const payload = await this.getDeviceSupportFeatures(connectId);

      if (!payload.inputPinOnSoftware?.support)
        throw new FirmwareVersionTooLow({
          connectId,
          deviceId,
          params: {
            require: payload.inputPinOnSoftware?.require,
          },
        });
    }

    return this.updateDevicePayload(deviceId, {
      onDeviceInputPin,
    });
  }

  @backgroundMethod()
  async getDeviceSupportFeatures(connectId: string) {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK?.deviceSupportFeatures(connectId).then((response) => {
      if (!response.success) {
        return Promise.reject(deviceUtils.convertDeviceError(response.payload));
      }
      return response.payload;
    });
  }

  @backgroundMethod()
  async updateDevicePayload(deviceId: string, payload: DevicePayload) {
    await this.backgroundApi.engine.updateDevicePayload(deviceId, payload);
    return this.backgroundApi.engine.getHWDeviceByDeviceId(deviceId);
  }

  @backgroundMethod()
  async getDevicePayload(deviceId: string): Promise<DevicePayload> {
    return (await this.backgroundApi.engine.getHWDeviceByDeviceId(deviceId))
      .payload;
  }

  @backgroundMethod()
  async checkBridge() {
    if (!this._hasUseBridge()) {
      return Promise.resolve(true);
    }

    const hardwareSDK = await this.getSDKInstance();
    const bridgeStatus = await hardwareSDK?.checkBridgeStatus();

    if (!bridgeStatus.success) {
      const error = deviceUtils.convertDeviceError(bridgeStatus.payload);
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

  _toArrayBuffer(buf: Buffer) {
    const arrayBuffer = new ArrayBuffer(buf.length);
    const view = new Uint8Array(arrayBuffer);
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < buf.length; ++i) {
      view[i] = buf[i];
    }
    return arrayBuffer;
  }

  @backgroundMethod()
  async getConnectId(features: IOneKeyDeviceFeatures) {
    const deviceId = features.device_id;
    if (!deviceId) return null;
    try {
      const device = await this.backgroundApi.engine.getHWDeviceByDeviceId(
        deviceId,
      );
      if (!device) return null;
      return device.mac;
    } catch {
      return null;
    }
  }

  private async _checkDeviceSettings(
    payload: DeviceSendSupportFeatures['payload'],
  ) {
    try {
      const { inputPinOnSoftware, device } = payload;
      const { deviceId } = device || {};

      if (deviceId && !inputPinOnSoftware.support) {
        await this.updateDevicePayload(deviceId, {
          onDeviceInputPin: true,
        });
      } else if (deviceId && inputPinOnSoftware.support) {
        const devicePayload = await this.getDevicePayload(deviceId);

        if (!devicePayload || devicePayload.onDeviceInputPin === undefined) {
          await this.updateDevicePayload(deviceId, {
            onDeviceInputPin: false,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  private _checkPassphraseEnableStatus(
    deviceId: string,
    features: IOneKeyDeviceFeatures,
  ) {
    try {
      if (typeof features.passphrase_protection === 'boolean') {
        this.backgroundApi.dispatch(
          updateDevicePassphraseOpenedState({
            deviceId,
            opened: features.passphrase_protection,
          }),
        );
      }
    } catch {
      // ignore
    }
  }

  @backgroundMethod()
  async checkFirmwareUpdate(connectId: string) {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK?.checkFirmwareRelease(connectId).then((response) => {
      if (!response.success) {
        return Promise.reject(deviceUtils.convertDeviceError(response.payload));
      }
      this._checkFirmwareUpdate({
        ...(response.payload as unknown as any),
        connectId,
      });

      const { status } = response.payload;
      if (status === 'unknown' || status === 'none' || status === 'valid') {
        return null;
      }
      return response.payload;
    });
  }

  @backgroundMethod()
  private async _checkFirmwareUpdate(
    payload: ReleaseInfoEvent['payload'] & {
      features?: IOneKeyDeviceFeatures;
      connectId?: string;
    },
  ): Promise<void> {
    let connectId: string | null = null;
    if (payload.connectId) {
      connectId = payload.connectId;
    } else if (payload.features) {
      connectId = await this.getConnectId(payload.features);
    }
    if (!connectId) return;

    const firmware: SYSFirmwareInfo | undefined = payload.release;
    let hasSysUpgrade = false;
    let hasFirmwareForce = false;

    switch (payload.status) {
      case 'required':
        hasFirmwareForce = true;
        hasSysUpgrade = true;
        break;
      case 'valid':
      case 'none':
        hasSysUpgrade = false;
        break;
      case 'outdated':
        hasSysUpgrade = true;
        break;
      default:
        hasSysUpgrade = false;
        break;
    }

    const actions: any[] = [];

    // dev
    const settings = this.backgroundApi.appSelector((s) => s.settings) ?? {};
    const enable = settings?.devMode?.enable ?? false;
    const updateDeviceSys = settings?.devMode?.updateDeviceSys ?? false;
    const alwaysUpgrade = !!enable && !!updateDeviceSys;

    actions.push(
      setDeviceUpdates({
        connectId,
        type: 'firmware',
        value: {
          forceFirmware: hasFirmwareForce,
          firmware: alwaysUpgrade || hasSysUpgrade ? firmware : undefined,
        },
      }),
    );

    // check device version and set verified
    const currentVersion = settings?.hardware?.versions?.[connectId];
    if (
      currentVersion == null ||
      payload.features?.onekey_version !== currentVersion
    ) {
      actions.push(
        setDeviceVersion({
          connectId,
          version: payload.features?.onekey_version ?? '0.0.0',
        }),
      );
      actions.push(setVerification({ connectId, verified: false }));
    }

    const { dispatch } = this.backgroundApi;
    dispatch(...actions);
  }

  @backgroundMethod()
  private async _checkBleFirmwareUpdate(
    payload: BleReleaseInfoEvent['payload'] & {
      features: IOneKeyDeviceFeatures;
    },
  ) {
    const connectId = await this.getConnectId(payload.features);
    if (!connectId) return;

    const bleFirmware: BLEFirmwareInfo | undefined = payload.release;

    let hasBleUpgrade = false;

    let hasBleForce = false;

    switch (payload.status) {
      case 'required':
        hasBleForce = true;
        hasBleUpgrade = true;
        break;
      case 'valid':
      case 'none':
        hasBleUpgrade = false;
        break;
      case 'outdated':
        hasBleUpgrade = true;
        break;
      default:
        hasBleUpgrade = false;
        break;
    }

    // dev
    const settings = this.backgroundApi.appSelector((s) => s.settings) ?? {};
    const enable = settings?.devMode?.enable ?? false;
    const updateDeviceBle = settings?.devMode?.updateDeviceBle ?? false;
    const alwaysUpgrade = !!enable && !!updateDeviceBle;

    const { dispatch } = this.backgroundApi;
    dispatch(
      setDeviceUpdates({
        connectId,
        type: 'ble',
        value: {
          forceBle: hasBleForce,
          ble: alwaysUpgrade || hasBleUpgrade ? bleFirmware : undefined,
        },
      }),
    );
  }

  @backgroundMethod()
  async syncDeviceLabel(features: IOneKeyDeviceFeatures, walletId: string) {
    const { engine } = this.backgroundApi;
    const { label } = features;
    try {
      const wallet = await engine.getWallet(walletId);
      const correctLabel = typeof label === 'string' && label.length > 0;
      if (correctLabel && label !== wallet.name && wallet.associatedDevice) {
        await engine.updateWalletName(walletId, label ?? wallet.name);
        await this.backgroundApi.serviceAccount.initWallets();
      }
    } catch {
      // empty
    }
  }

  @backgroundMethod()
  async uploadResource(connectId: string, params: DeviceUploadResourceParams) {
    const hardwareSDK = await this.getSDKInstance();
    return hardwareSDK
      ?.deviceUploadResource(connectId, params)
      .then((response) => {
        if (!response.success) {
          return Promise.reject(
            deviceUtils.convertDeviceError(response.payload),
          );
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
          return Promise.reject(
            deviceUtils.convertDeviceError(response.payload),
          );
        }
        return response.payload;
      });
  }

  @backgroundMethod()
  async updateBootloaderForClassicAndMini(connectId: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(setUpdateFirmwareStep(''));
    const hardwareSDK = await this.getSDKInstance();
    const listener = (data: any) => {
      dispatch(setUpdateFirmwareStep(get(data, 'data.message', '')));
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
          return Promise.reject(
            deviceUtils.convertDeviceError(response.payload),
          );
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
        debugLogger.hardwareSDK.debug(
          'Switch hardware connect src success',
          res,
        );
      }
    } catch (e) {
      debugLogger.hardwareSDK.debug(
        'Switch hardware connect src setting failed',
        e,
      );
    }
  }
}

export default ServiceHardware;
