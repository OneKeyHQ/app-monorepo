/* eslint-disable no-nested-ternary */
import { get } from 'lodash';

import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import type { DevicePayload } from '@onekeyhq/engine/src/types/device';
import {
  addConnectedConnectId,
  removeConnectedConnectId,
  setHardwarePopup,
  setUpdateFirmwareStep,
  updateDevicePassphraseOpenedState,
} from '@onekeyhq/kit/src/store/reducers/hardware';
import { setDeviceUpdates } from '@onekeyhq/kit/src/store/reducers/settings';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import {
  BridgeTimeoutError,
  FirmwareVersionTooLow,
  InitIframeLoadFail,
  InitIframeTimeout,
} from '@onekeyhq/kit/src/utils/hardware/errors';
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
  getHardwareSDKInstance,
} from '@onekeyhq/shared/src/device/hardwareInstance';
import { isPassphraseWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

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
  UiResponseEvent,
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
    return getHardwareSDKInstance().then(async (instance) => {
      if (!this.registeredEvents) {
        this.registeredEvents = true;

        const {
          LOG_EVENT,
          DEVICE,
          FIRMWARE,
          FIRMWARE_EVENT,
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

              try {
                if (typeof features.passphrase_protection === 'boolean') {
                  this.backgroundApi.dispatch(
                    updateDevicePassphraseOpenedState({
                      deviceId: device.id,
                      opened: features.passphrase_protection,
                    }),
                  );
                }
              } catch {
                // ignore
              }
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
      }
      return instance;
    });
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
  async getFeatures(connectId: string) {
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
  async getPassphraseState(connectId: string) {
    const hardwareSDK = await this.getSDKInstance();
    const response = await hardwareSDK?.getPassphraseState(connectId, {
      initSession: true,
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
  async autoUpdateFirmware(connectId: string, firmwareType: FirmwareType) {
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

    const checkBootRes = await hardwareSDK.checkBootloaderRelease(connectId);

    try {
      const response = await hardwareSDK.firmwareUpdateV2(connectId, {
        updateType: firmwareType,
        forcedUpdateRes,
        version,
        platform: platformEnv.symbol ?? 'web',
      });

      // update bootloader
      if (
        response.success &&
        checkBootRes.success &&
        checkBootRes.payload?.shouldUpdate
      ) {
        return await hardwareSDK.deviceUpdateBootloader(connectId);
      }

      return response;
    } finally {
      hardwareSDK.off('ui-firmware-tip', listener);
    }
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

    // dev
    const settings = this.backgroundApi.appSelector((s) => s.settings) ?? {};
    const enable = settings?.devMode?.enable ?? false;
    const updateDeviceSys = settings?.devMode?.updateDeviceSys ?? false;
    const alwaysUpgrade = !!enable && !!updateDeviceSys;

    const { dispatch } = this.backgroundApi;
    dispatch(
      setDeviceUpdates({
        connectId,
        type: 'firmware',
        value: {
          forceFirmware: hasFirmwareForce,
          firmware: alwaysUpgrade || hasSysUpgrade ? firmware : undefined,
        },
      }),
    );
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
}

export default ServiceHardware;
