import {
  CoreApi,
  IDeviceType,
  UiResponseEvent,
  getDeviceType,
} from '@onekeyfe/hd-core';
import axios from 'axios';

import {
  OneKeyHardwareAbortError,
  OneKeyHardwareError,
} from '@onekeyhq/engine/src/errors';
import { setHardwarePopup } from '@onekeyhq/kit/src/store/reducers/hardware';
import { setDeviceUpdates } from '@onekeyhq/kit/src/store/reducers/settings';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import {
  ConnectTimeout,
  InitIframeLoadFail,
  InitIframeTimeout,
  NeedOneKeyBridge,
} from '@onekeyhq/kit/src/utils/hardware/errors';
import { getHardwareSDKInstance } from '@onekeyhq/kit/src/utils/hardware/hardwareInstance';
import {
  BLEFirmwareInfo,
  SYSFirmwareInfo,
} from '@onekeyhq/kit/src/utils/updates/type';
import type { FirmwareType } from '@onekeyhq/kit/src/views/Hardware/UpdateFirmware/Updating';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { FirmwareDownloadFailed } from '../../utils/hardware/errors';
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

  stopConnect = false;

  constructor({ backgroundApi }: IServiceBaseProps) {
    super({ backgroundApi });
    getHardwareSDKInstance().then((instance) => {
      instance.on('UI_EVENT', (e) => {
        const { type, payload } = e;

        setTimeout(() => {
          const { device, type: eventType } = payload || {};
          const { deviceType, connectId, features } = device || {};
          const { bootloader_mode: bootLoaderMode } = features || {};

          this.backgroundApi.dispatch(
            setHardwarePopup({
              uiRequest: type,
              payload: {
                type: eventType,
                deviceType,
                deviceConnectId: connectId,
                deviceBootLoaderMode: !!bootLoaderMode,
              },
            }),
          );
        }, 0);
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
      if (e instanceof OneKeyHardwareError && !e.data.reconnect) {
        return Promise.reject(e);
      }
    }
  }

  @backgroundMethod()
  async getFeatures(
    connectId: string,
    options?: {
      skipCheckUpdate?: boolean;
    },
  ) {
    const hardwareSDK = await this.getSDKInstance();
    const response = await hardwareSDK?.getFeatures(connectId);

    if (response.success) {
      // this.backgroundApi.dispatch(addConnectedConnectId(connectId));

      if (!options?.skipCheckUpdate) {
        const existsFocused = await this._checkDeviceUpdate(
          hardwareSDK,
          connectId,
        );

        if (existsFocused) {
          return null;
        }
      }

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
      if (this.stopConnect) {
        return Promise.reject(new OneKeyHardwareAbortError());
      }
      tryCount += 1;
      try {
        const feature = await this.getFeatures(connectId);
        if (feature) {
          connected = true;
          return await Promise.resolve(feature);
        }
      } catch (e) {
        if (e instanceof OneKeyHardwareError && !e.data.reconnect) {
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

    this.startPolling();
    return poll();
  }

  @backgroundMethod()
  stopPolling() {
    this.stopConnect = true;
  }

  startPolling() {
    this.stopConnect = false;
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
    console.log(`DownloadFirmware error: ${url} ${response.statusText}`);
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
    console.log('installFirmware', connectId, firmwareType, binary.byteLength);

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

  async _checkDeviceUpdate(sdk: CoreApi, connectId: string): Promise<boolean> {
    const checkBleResult = await sdk.checkBLEFirmwareRelease(connectId);

    let bleFirmware: BLEFirmwareInfo | undefined;
    let firmware: SYSFirmwareInfo | undefined;

    let hasBleUpgrade = false;
    let hasSysUpgrade = false;

    let hasFirmwareForce = false;
    let hasBleForce = false;

    if (checkBleResult.success) {
      bleFirmware = checkBleResult.payload.release;
      switch (checkBleResult.payload.status) {
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
    }

    const checkResult = await sdk.checkFirmwareRelease(connectId);

    if (checkResult.success) {
      firmware = checkResult.payload.release;
      switch (checkResult.payload.status) {
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
    }

    const { dispatch } = this.backgroundApi;
    dispatch(
      setDeviceUpdates({
        connectId,
        value: {
          forceFirmware: hasFirmwareForce,
          forceBle: hasBleForce,
          ble: hasBleUpgrade ? bleFirmware : undefined,
          firmware: hasSysUpgrade ? firmware : undefined,
        },
      }),
    );

    // dev
    const settings: { devMode: any } =
      this.backgroundApi.appSelector((s) => s.settings) || {};
    const { enable, updateDeviceBle, updateDeviceSys } = settings.devMode || {};
    if (enable) {
      dispatch(
        setDeviceUpdates({
          connectId,
          value: {
            forceFirmware: hasFirmwareForce,
            forceBle: hasBleForce,
            ble: updateDeviceBle || hasBleUpgrade ? bleFirmware : undefined,
            firmware: updateDeviceSys || hasSysUpgrade ? firmware : undefined,
          },
        }),
      );
    }

    return Promise.resolve(hasFirmwareForce || hasBleForce);
  }
}

export default ServiceHardware;
