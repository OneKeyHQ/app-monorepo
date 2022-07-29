import {
  BleReleaseInfoEvent,
  CoreMessage,
  DEVICE,
  DeviceSettingsParams,
  FIRMWARE,
  FIRMWARE_EVENT,
  IDeviceType,
  LOG_EVENT,
  ReleaseInfoEvent,
  UiResponseEvent,
  getDeviceType,
} from '@onekeyfe/hd-core';
import axios from 'axios';

import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import { DevicePayload } from '@onekeyhq/engine/src/types/device';
import { setHardwarePopup } from '@onekeyhq/kit/src/store/reducers/hardware';
import { setDeviceUpdates } from '@onekeyhq/kit/src/store/reducers/settings';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import {
  BridgeTimeoutError,
  InitIframeLoadFail,
  InitIframeTimeout,
} from '@onekeyhq/kit/src/utils/hardware/errors';
import { getHardwareSDKInstance } from '@onekeyhq/kit/src/utils/hardware/hardwareInstance';
import {
  BLEFirmwareInfo,
  SYSFirmwareInfo,
} from '@onekeyhq/kit/src/utils/updates/type';
import type { FirmwareType } from '@onekeyhq/kit/src/views/Hardware/UpdateFirmware/Updating';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { FirmwareDownloadFailed } from '../../utils/hardware/errors';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceHardware extends ServiceBase {
  connectedDeviceType: IDeviceType = 'classic';

  registeredEvents = false;

  tryCount = 0;

  stopConnect = false;

  featursCache: Record<string, IOneKeyDeviceFeatures> = {};

  @backgroundMethod()
  async getSDKInstance() {
    return getHardwareSDKInstance().then((instance) => {
      if (!this.registeredEvents) {
        this.registeredEvents = true;

        instance.on('UI_EVENT', (e) => {
          const { type, payload } = e;

          setTimeout(() => {
            const { device, type: eventType } = payload || {};
            const { deviceType, connectId, deviceId, features } = device || {};
            const { bootloader_mode: bootLoaderMode } = features || {};

            this.backgroundApi.dispatch(
              setHardwarePopup({
                uiRequest: type,
                payload: {
                  type: eventType,
                  deviceType,
                  deviceId,
                  deviceConnectId: connectId,
                  deviceBootLoaderMode: !!bootLoaderMode,
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
              const wallets = await this.backgroundApi.engine.getWallets();
              const device =
                await this.backgroundApi.engine.getHWDeviceByDeviceId(
                  features.device_id,
                );
              if (!device) return;
              const wallet = wallets.find(
                (w) => w.associatedDevice === device.id,
              );
              if (!wallet) return;
              this.featursCache[wallet.id] = features;
              this.syncDeviceLabel(features, wallet.id);
            } catch {
              // empty
            }
          },
        );

        instance.on(FIRMWARE_EVENT, (messages: CoreMessage) => {
          if (messages.type === FIRMWARE.RELEASE_INFO) {
            console.log('FIRMWARE.RELEASE_INFO: ', messages);
            this._checkFirmwareUpdate(messages.payload as unknown as any);
          }
          if (messages.type === FIRMWARE.BLE_RELEASE_INFO) {
            console.log('FIRMWARE.BLE_RELEASE_INFO: ', messages);
            this._checkBleFirmwareUpdate(messages.payload as unknown as any);
          }
        });
      }
      return instance;
    });
  }

  @backgroundMethod()
  async getFeatursByWalletId(walletId: string) {
    return Promise.resolve(this.featursCache[walletId] ?? null);
  }

  @backgroundMethod()
  async updateFeaturesCache(walletId: string, payload: Record<string, any>) {
    if (!this.featursCache[walletId]) return;
    this.featursCache[walletId] = {
      ...this.featursCache[walletId],
      ...payload,
    };
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
      } catch (e) {
        if (e instanceof OneKeyHardwareError && !e.data.reconnect) {
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
  async downloadFirmware(url: string | undefined) {
    if (!url) return Promise.reject(new FirmwareDownloadFailed());

    const response = await axios.request({
      url,
      withCredentials: false,
      responseType: 'arraybuffer',
    });

    if (+response.status === 200) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const firmware = Buffer.from(await response.data).toString('hex');

      if (!firmware) return Promise.reject(new FirmwareDownloadFailed());
      return firmware;
    }

    return Promise.reject(new FirmwareDownloadFailed());
  }

  @backgroundMethod()
  async installFirmware(
    connectId: string,
    firmwareType: FirmwareType,
    binaryStr: string | undefined,
  ) {
    const binary = binaryStr
      ? this._toArrayBuffer(Buffer.from(binaryStr, 'hex'))
      : undefined;
    if (!binary) return Promise.reject(new FirmwareDownloadFailed());

    const hardwareSDK = await this.getSDKInstance();

    // @ts-expect-error
    return hardwareSDK
      .firmwareUpdate(platformEnv.isNative ? connectId : undefined, {
        updateType: firmwareType,
        binary,
      })
      .then((response) => {
        if (!response.success) {
          return Promise.reject(
            deviceUtils.convertDeviceError(response.payload),
          );
        }
        if (firmwareType === 'firmware') {
          return response.payload;
        }

        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(response.payload);
          }, 10 * 1000);
        });
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
  async updateDevicePayload(deviceId: string, payload: DevicePayload) {
    await this.backgroundApi.engine.updateDevicePayload(deviceId, payload);
    return this.backgroundApi.engine.getHWDeviceByDeviceId(deviceId);
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

  @backgroundMethod()
  async _checkFirmwareUpdate(
    payload: ReleaseInfoEvent['payload'] & { features: IOneKeyDeviceFeatures },
  ): Promise<void> {
    const connectId = await this.getConnectId(payload.features);
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
      default:
        hasSysUpgrade = true;
        break;
    }

    const { dispatch } = this.backgroundApi;
    dispatch(
      setDeviceUpdates({
        connectId,
        type: 'firmware',
        value: {
          forceFirmware: hasFirmwareForce,
          firmware: hasSysUpgrade ? firmware : undefined,
        },
      }),
    );

    // dev
    const settings: { devMode: any } =
      this.backgroundApi.appSelector((s) => s.settings) || {};
    const { enable, updateDeviceSys } = settings.devMode || {};
    if (enable) {
      dispatch(
        setDeviceUpdates({
          connectId,
          type: 'firmware',
          value: {
            forceFirmware: hasFirmwareForce,
            firmware: updateDeviceSys || hasSysUpgrade ? firmware : undefined,
          },
        }),
      );
    }
  }

  @backgroundMethod()
  async _checkBleFirmwareUpdate(
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
      default:
        hasBleUpgrade = true;
        break;
    }

    const { dispatch } = this.backgroundApi;
    dispatch(
      setDeviceUpdates({
        connectId,
        type: 'ble',
        value: {
          forceBle: hasBleForce,
          ble: hasBleUpgrade ? bleFirmware : undefined,
        },
      }),
    );

    // dev
    const settings: { devMode: any } =
      this.backgroundApi.appSelector((s) => s.settings) || {};
    const { enable, updateDeviceBle } = settings.devMode || {};
    if (enable) {
      dispatch(
        setDeviceUpdates({
          connectId,
          type: 'ble',
          value: {
            forceBle: hasBleForce,
            ble: updateDeviceBle || hasBleUpgrade ? bleFirmware : undefined,
          },
        }),
      );
    }
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
}

export default ServiceHardware;
