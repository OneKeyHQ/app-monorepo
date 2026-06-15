import { ResourceType, type Success } from '@onekeyfe/hd-transport';
import { isNil } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  FirmwareVersionTooLow,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import deviceHomeScreenUtils from '@onekeyhq/shared/src/utils/deviceHomeScreenUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import {
  EHardwareCallContext,
  EHardwareVendor,
  type IDeviceResponseResult,
  type IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import {
  buildTrezorBleFallbackOptions,
  callTrezorWithBleFallback,
  getTrezorAdapterFromBackgroundApi,
} from '../../vaults/base/trezorTransportUtils';

import { ServiceHardwareManagerBase } from './ServiceHardwareManagerBase';

import type { TrezorDeviceSettingsParams } from './adapters/types';
import type {
  IDBDevice,
  IDBDeviceSettings as IDBDeviceDbSettings,
} from '../../dbs/local/types';
import type { IWithHardwareProcessingControlParams } from '../ServiceHardwareUI/ServiceHardwareUI';
import type {
  CoreApi,
  DeviceSettingsParams,
  DeviceUploadResourceParams,
  DeviceUploadResourceResponse,
} from '@onekeyfe/hd-core';
import type { Response as ThirdPartyResponse } from '@onekeyfe/hwk-adapter-core';

export type ISetInputPinOnSoftwareParams = {
  walletId: string;
  inputPinOnSoftware: boolean;
};

export type IBaseDeviceProcessingParams = {
  walletId?: string;
  connectId?: string;
  featuresDeviceId?: string;
};

export type ISetAutoLockDelayMsParams = IBaseDeviceProcessingParams & {
  autoLockDelayMs: number;
};

export type ISetAutoShutDownDelayMsParams = IBaseDeviceProcessingParams & {
  autoShutdownDelayMs: number;
};

export type ISetLanguageParams = IBaseDeviceProcessingParams & {
  language: string;
};

export type ISetHapticFeedbackParams = IBaseDeviceProcessingParams & {
  hapticFeedback: boolean;
};

export type ISetPassphraseEnabledParams = IBaseDeviceProcessingParams & {
  passphraseEnabled: boolean;
};

export type IWipeDeviceParams = IBaseDeviceProcessingParams;

export type IGetDeviceAdvanceSettingsParams = { walletId: string };
export type IGetDeviceLabelParams = { walletId: string };
export type IChangePinParams = IBaseDeviceProcessingParams & {
  remove: boolean;
};
export type ISetDeviceLabelParams = { walletId: string; label: string };

export type IHardwareHomeScreenData = {
  id: string;
  wallpaperType?: 'default' | 'cobranding';
  resType: 'system' | 'prebuilt' | 'custom'; // system: system image, prebuilt: prebuilt image, custom: user upload image

  // Service image config
  url?: string; // preview image url
  nameHex?: string; // Pro、Touch: image name hex, only system res type
  screenHex?: string; // Classic、mini、1s、pure: image hex, only prebuilt res type

  // software generated image
  thumbnailHex?: string; // Pro、Touch：thumb image hex by resize
  blurScreenHex?: string; // Pro、Touch：blur image hex by blur effect

  // User upload config
  uri?: string; // image base64 by upload & crop
  isUserUpload?: boolean;
};

export type ISetDeviceHomeScreenParams = {
  dbDeviceId: string;
  screenItem: IHardwareHomeScreenData;
};
export type IDeviceHomeScreenSizeInfo = {
  width: number;
  height: number;
  radius?: number;
};
export type IDeviceHomeScreenConfig = {
  names: string[];
  size?: IDeviceHomeScreenSizeInfo;
  thumbnailSize?: IDeviceHomeScreenSizeInfo;
};

type IWithDeviceProcessingParams = {
  debugMethodName?: string;
  walletId?: string;
  connectId?: string;
  featuresDeviceId?: string;
  hardwareCallContext?: EHardwareCallContext;
  dbDevice?: IDBDevice;
  params?: IWithHardwareProcessingControlParams;
};

type ITrezorDeviceSettingsAction = (params: {
  connectId: string;
  device: IDBDevice;
}) => Promise<ThirdPartyResponse<Record<string, unknown>>>;

export class DeviceSettingsManager extends ServiceHardwareManagerBase {
  private async _getDeviceForSettings({
    walletId,
    connectId,
    featuresDeviceId,
    dbDevice,
  }: Pick<
    IWithDeviceProcessingParams,
    'walletId' | 'connectId' | 'featuresDeviceId' | 'dbDevice'
  >): Promise<IDBDevice> {
    let device = dbDevice;
    if (!device && walletId) {
      device = await localDb.getWalletDevice({ walletId });
    }
    if (!device && (connectId || featuresDeviceId)) {
      device = await localDb.getDeviceByQuery({
        connectId,
        featuresDeviceId,
      });
    }
    if (!device) {
      throw new OneKeyLocalError('Device not found');
    }
    return device;
  }

  private _isTrezorDevice(device: IDBDevice | undefined): boolean {
    return (
      device?.vendor === EHardwareVendor.trezor ||
      device?.settings?.vendor === EHardwareVendor.trezor
    );
  }

  private async _withTrezorDeviceProcessing({
    walletId,
    connectId,
    featuresDeviceId,
    dbDevice,
    debugMethodName,
    params,
    action,
    preciseUpdateFields,
  }: Pick<
    IWithDeviceProcessingParams,
    | 'walletId'
    | 'connectId'
    | 'featuresDeviceId'
    | 'dbDevice'
    | 'debugMethodName'
    | 'params'
  > & {
    action: ITrezorDeviceSettingsAction;
    preciseUpdateFields?: Partial<IOneKeyDeviceFeatures>;
  }): Promise<Success> {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice,
    });

    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        const response = await callTrezorWithBleFallback(
          device,
          async (targetConnectId) =>
            action({ connectId: targetConnectId, device }),
          buildTrezorBleFallbackOptions(this.backgroundApi),
        );
        if (!response.success) {
          throw convertThirdPartyDeviceError(response.payload, {
            vendor: 'Trezor',
          });
        }
        if (preciseUpdateFields && device.featuresInfo) {
          await localDb.updateDevice({
            features: device.featuresInfo,
            preciseUpdateFields,
          });
        }
        return { message: 'Success' };
      },
      {
        deviceParams: {
          dbDevice: device,
        },
        ...params,
        debugMethodName:
          debugMethodName || 'deviceSettings.withTrezorDeviceProcessing',
      },
    );
  }

  private async _applyTrezorSettings({
    walletId,
    connectId,
    featuresDeviceId,
    dbDevice,
    debugMethodName,
    settings,
    preciseUpdateFields,
  }: Pick<
    IWithDeviceProcessingParams,
    | 'walletId'
    | 'connectId'
    | 'featuresDeviceId'
    | 'dbDevice'
    | 'debugMethodName'
  > & {
    settings: TrezorDeviceSettingsParams;
    preciseUpdateFields?: Partial<IOneKeyDeviceFeatures>;
  }): Promise<Success> {
    return this._withTrezorDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice,
      debugMethodName,
      preciseUpdateFields,
      action: async ({ connectId: targetConnectId }) => {
        const adapter = await getTrezorAdapterFromBackgroundApi(
          this.backgroundApi,
        );
        if (!adapter.deviceSettings) {
          throw new OneKeyLocalError('Trezor device settings not available');
        }
        return adapter.deviceSettings(targetConnectId, settings);
      },
    });
  }

  async _withDeviceProcessing<T>({
    walletId,
    connectId,
    featuresDeviceId,
    dbDevice,
    hardwareCallContext,
    debugMethodName,
    action,
    params,
  }: IWithDeviceProcessingParams & {
    action: (
      hardwareSDK: CoreApi,
      connectId: string,
      device: IDBDevice,
    ) => Promise<IDeviceResponseResult<T>>;
  }): Promise<T> {
    let device = dbDevice;
    if (!device && walletId) {
      device = await localDb.getWalletDevice({ walletId });
    }
    if (!device) {
      if (connectId || featuresDeviceId) {
        device = await localDb.getDeviceByQuery({
          connectId,
          featuresDeviceId,
        });
      }
    }
    if (!device) {
      throw new OneKeyLocalError('Device not found');
    }

    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        const compatibleConnectId =
          await this.serviceHardware.getCompatibleConnectId({
            connectId: device.connectId,
            hardwareCallContext:
              hardwareCallContext || EHardwareCallContext.USER_INTERACTION,
          });
        const hardwareSDK = await this.getSDKInstance({
          connectId: compatibleConnectId,
        });
        return convertDeviceResponse(() =>
          action(hardwareSDK, compatibleConnectId, device),
        );
      },
      {
        deviceParams: {
          dbDevice: device,
        },
        ...params,
        debugMethodName:
          debugMethodName || 'deviceSettings.withDeviceProcessing',
      },
    );
  }

  @backgroundMethod()
  async changePin({
    walletId,
    connectId,
    featuresDeviceId,
    remove,
  }: IChangePinParams): Promise<Success> {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    if (this._isTrezorDevice(device)) {
      return this._withTrezorDeviceProcessing({
        walletId,
        connectId,
        featuresDeviceId,
        dbDevice: device,
        debugMethodName: 'deviceSettings.changePin.trezor',
        action: async ({ connectId: targetConnectId }) => {
          const adapter = await getTrezorAdapterFromBackgroundApi(
            this.backgroundApi,
          );
          if (!adapter.changePin) {
            throw new OneKeyLocalError('Trezor change PIN not available');
          }
          return adapter.changePin(targetConnectId, { remove });
        },
      });
    }
    return this._withDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.changePin',
      action: async (hardwareSDK, compatibleConnectId, _device) =>
        hardwareSDK?.deviceChangePin(compatibleConnectId, {
          remove,
        }),
    });
  }

  @backgroundMethod()
  async applySettingsToDevice(
    connectId: string,
    settings: DeviceSettingsParams,
  ) {
    const compatibleConnectId =
      await this.serviceHardware.getCompatibleConnectId({
        connectId,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      });
    const hardwareSDK = await this.getSDKInstance({
      connectId: compatibleConnectId,
    });

    return convertDeviceResponse(() =>
      hardwareSDK?.deviceSettings(compatibleConnectId, settings),
    );
  }

  @backgroundMethod()
  async getDeviceAdvanceSettings({
    walletId,
  }: IGetDeviceAdvanceSettingsParams): Promise<{
    passphraseEnabled: boolean;
    inputPinOnSoftware: boolean;
    inputPinOnSoftwareSupport: boolean;
  }> {
    const dbDevice = await localDb.getWalletDevice({ walletId });

    if (this._isTrezorDevice(dbDevice)) {
      return {
        passphraseEnabled: Boolean(
          dbDevice.featuresInfo?.passphrase_protection,
        ),
        inputPinOnSoftware: false,
        inputPinOnSoftwareSupport: false,
      };
    }

    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        // touch or Pro should unlock device first, otherwise features?.passphrase_protection will return undefined
        await this.serviceHardware.unlockDevice({
          connectId: dbDevice.connectId,
        });

        const features = await this.serviceHardware.getFeaturesByWallet({
          walletId,
        });
        const supportFeatures =
          await this.serviceHardware.getDeviceSupportFeatures(
            dbDevice.connectId,
          );
        const inputPinOnSoftwareSupport = Boolean(
          supportFeatures?.inputPinOnSoftware?.support,
        );
        const passphraseEnabled = Boolean(features?.passphrase_protection);
        const inputPinOnSoftware = Boolean(
          dbDevice?.settings?.inputPinOnSoftware,
        );
        return {
          passphraseEnabled,
          inputPinOnSoftware,
          inputPinOnSoftwareSupport,
        };
      },
      {
        deviceParams: {
          dbDevice,
        },
        hideCheckingDeviceLoading: true,
        debugMethodName: 'deviceSettings.getDeviceSupportFeatures',
      },
    );
  }

  @backgroundMethod()
  async getDeviceLabel({ walletId }: IGetDeviceLabelParams) {
    const device = await localDb.getWalletDevice({ walletId });
    if (this._isTrezorDevice(device)) {
      return device.featuresInfo?.label || device.name || 'Unknown';
    }
    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        const compatibleConnectId =
          await this.serviceHardware.getCompatibleConnectId({
            connectId: device.connectId,
            hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
          });
        const features =
          await this.backgroundApi.serviceHardware.getFeaturesWithoutCache({
            connectId: compatibleConnectId,
            hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
          });
        await this.backgroundApi.serviceHardwareUI.closeHardwareUiStateDialog({
          connectId: compatibleConnectId,
          skipDeviceCancel: true,
          deviceResetToHome: false,
        });
        const label = await deviceUtils.buildDeviceLabel({
          features,
        });
        return label || 'Unknown';
      },
      {
        deviceParams: {
          dbDevice: device,
        },
        debugMethodName: 'deviceSettings.applySettingsToDevice',
      },
    );
  }

  @backgroundMethod()
  async setDeviceLabel({ walletId, label }: ISetDeviceLabelParams) {
    const device = await localDb.getWalletDevice({ walletId });
    if (this._isTrezorDevice(device)) {
      return this._applyTrezorSettings({
        walletId,
        dbDevice: device,
        debugMethodName: 'deviceSettings.setDeviceLabel.trezor',
        settings: { label },
        preciseUpdateFields: { label },
      });
    }
    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      () =>
        this.applySettingsToDevice(device.connectId, {
          label,
        }),
      {
        deviceParams: {
          dbDevice: device,
        },
        debugMethodName: 'deviceSettings.applySettingsToDevice',
      },
    );
  }

  @backgroundMethod()
  async setDeviceHomeScreen({
    dbDeviceId,
    screenItem,
  }: ISetDeviceHomeScreenParams): Promise<DeviceUploadResourceResponse> {
    const device = await localDb.getDevice(dbDeviceId);

    const {
      nameHex,
      screenHex,
      thumbnailHex,
      blurScreenHex,
      resType,
      isUserUpload,
    } = screenItem;

    const isMonochrome = deviceHomeScreenUtils.isMonochromeScreen(
      device.deviceType,
    );
    const isCustomScreen = resType === 'custom' || isUserUpload;

    // Pro、Touch: custom upload wallpaper
    const needUploadResource = isCustomScreen && !isMonochrome;

    const finallyScreenHex = screenHex || nameHex || '';
    const finallyThumbnailHex: string | undefined = thumbnailHex;

    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        // pro touch custom upload wallpaper
        if (needUploadResource) {
          if (!finallyThumbnailHex) {
            throw new OneKeyLocalError(
              'Upload screen item error: thumbnailHex not defined',
            );
          }

          const compatibleConnectId =
            await this.serviceHardware.getCompatibleConnectId({
              connectId: device.connectId,
              featuresDeviceId: device.deviceId,
              hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
            });
          const hardwareSDK = await this.getSDKInstance({
            connectId: compatibleConnectId,
          });
          const uploadResParams: DeviceUploadResourceParams = {
            resType: ResourceType.WallPaper,
            suffix: 'jpeg',
            dataHex: finallyScreenHex,
            thumbnailDataHex: finallyThumbnailHex,
            blurDataHex: blurScreenHex ?? '',
            nftMetaData: '',
          };
          // upload wallpaper resource will automatically set the home screen
          return convertDeviceResponse(() =>
            hardwareSDK.deviceUploadResource(
              compatibleConnectId,
              uploadResParams,
            ),
          );
        }
        // Pro、Touch: built-in wallpaper
        // Classic、mini、1s、pure: custom upload and built-in wallpaper
        if (!finallyScreenHex && !isMonochrome) {
          // empty string will clear the home screen(classic,mini)
          throw new OneKeyLocalError('Invalid home screen hex');
        }
        const response = await this.applySettingsToDevice(device.connectId, {
          homescreen: finallyScreenHex,
        });
        return {
          ...response,
          applyScreen: true,
        };
      },
      {
        deviceParams: {
          dbDevice: device,
        },
        debugMethodName: 'deviceSettings.applySettingsToDevice',
      },
    );
  }

  @backgroundMethod()
  async setPassphraseEnabled({
    walletId,
    connectId,
    featuresDeviceId,
    passphraseEnabled,
  }: ISetPassphraseEnabledParams) {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    if (this._isTrezorDevice(device)) {
      return this._applyTrezorSettings({
        walletId,
        connectId,
        featuresDeviceId,
        dbDevice: device,
        debugMethodName: 'deviceSettings.setPassphraseEnabled.trezor',
        settings: { use_passphrase: passphraseEnabled },
        preciseUpdateFields: {
          passphrase_protection: passphraseEnabled,
        },
      });
    }
    return this._withDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.setPassphraseEnabled',
      action: async (sdk, compatibleConnectId, targetDevice) =>
        sdk
          .deviceSettings(compatibleConnectId, {
            usePassphrase: passphraseEnabled,
          })
          .then(async (res) => {
            if (res.success && targetDevice.featuresInfo) {
              await localDb.updateDevice({
                features: targetDevice.featuresInfo,
                preciseUpdateFields: {
                  passphrase_protection: passphraseEnabled,
                },
              });
            }
            return res;
          }),
    });
  }

  @backgroundMethod()
  async setAutoLockDelayMs({
    walletId,
    connectId,
    featuresDeviceId,
    autoLockDelayMs,
  }: ISetAutoLockDelayMsParams) {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    if (this._isTrezorDevice(device)) {
      return this._applyTrezorSettings({
        walletId,
        connectId,
        featuresDeviceId,
        dbDevice: device,
        debugMethodName: 'deviceSettings.setAutoLockDelayMs.trezor',
        settings: { auto_lock_delay_ms: autoLockDelayMs },
        preciseUpdateFields: {
          auto_lock_delay_ms: autoLockDelayMs,
        },
      });
    }
    return this._withDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.setAutoLockDelayMs',
      action: async (sdk, compatibleConnectId, targetDevice) =>
        sdk
          .deviceSettings(compatibleConnectId, {
            autoLockDelayMs,
          })
          .then(async (res) => {
            if (res.success && targetDevice.featuresInfo) {
              await localDb.updateDevice({
                features: targetDevice.featuresInfo,
                preciseUpdateFields: {
                  auto_lock_delay_ms: autoLockDelayMs,
                },
              });
            }
            return res;
          }),
    });
  }

  @backgroundMethod()
  async setAutoShutDownDelayMs({
    walletId,
    connectId,
    featuresDeviceId,
    autoShutdownDelayMs,
  }: ISetAutoShutDownDelayMsParams) {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    if (this._isTrezorDevice(device)) {
      throw new OneKeyLocalError('Trezor auto shutdown settings not available');
    }
    return this._withDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.setAutoShutDownDelayMs',
      action: async (sdk, compatibleConnectId, targetDevice) =>
        sdk
          .deviceSettings(compatibleConnectId, {
            autoShutdownDelayMs,
          })
          .then(async (res) => {
            if (res.success && targetDevice.featuresInfo) {
              await localDb.updateDevice({
                features: targetDevice.featuresInfo,
                preciseUpdateFields: {
                  auto_shutdown_delay_ms: autoShutdownDelayMs,
                },
              });
            }
            return res;
          }),
    });
  }

  @backgroundMethod()
  async setLanguage({
    walletId,
    connectId,
    featuresDeviceId,
    language,
  }: ISetLanguageParams) {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    if (this._isTrezorDevice(device)) {
      return this._applyTrezorSettings({
        walletId,
        connectId,
        featuresDeviceId,
        dbDevice: device,
        debugMethodName: 'deviceSettings.setLanguage.trezor',
        settings: { language },
        preciseUpdateFields: {
          language,
        },
      });
    }
    return this._withDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.setLanguage',
      action: async (sdk, compatibleConnectId, targetDevice) =>
        sdk
          .deviceSettings(compatibleConnectId, {
            language,
          })
          .then(async (res) => {
            if (res.success && targetDevice.featuresInfo) {
              await localDb.updateDevice({
                features: targetDevice.featuresInfo,
                preciseUpdateFields: {
                  language,
                },
              });
            }
            return res;
          }),
    });
  }

  @backgroundMethod()
  async setBrightness({
    walletId,
    connectId,
    featuresDeviceId,
  }: IBaseDeviceProcessingParams) {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    if (this._isTrezorDevice(device)) {
      return this._withTrezorDeviceProcessing({
        walletId,
        connectId,
        featuresDeviceId,
        dbDevice: device,
        debugMethodName: 'deviceSettings.setBrightness.trezor',
        action: async ({ connectId: targetConnectId }) => {
          const adapter = await getTrezorAdapterFromBackgroundApi(
            this.backgroundApi,
          );
          if (!adapter.setBrightness) {
            throw new OneKeyLocalError(
              'Trezor brightness settings not available',
            );
          }
          return adapter.setBrightness(targetConnectId);
        },
      });
    }
    return this._withDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.setBrightness',
      action: async (sdk, compatibleConnectId, _device) =>
        sdk.deviceSettings(compatibleConnectId, {
          changeBrightness: true,
        }),
    });
  }

  @backgroundMethod()
  async setHapticFeedback({
    walletId,
    connectId,
    featuresDeviceId,
    hapticFeedback,
  }: ISetHapticFeedbackParams) {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    if (this._isTrezorDevice(device)) {
      return this._applyTrezorSettings({
        walletId,
        connectId,
        featuresDeviceId,
        dbDevice: device,
        debugMethodName: 'deviceSettings.setHapticFeedback.trezor',
        settings: { haptic_feedback: hapticFeedback },
        preciseUpdateFields: {
          haptic_feedback: hapticFeedback,
        },
      });
    }
    return this._withDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.setHapticFeedback',
      action: async (sdk, compatibleConnectId, targetDevice) =>
        sdk
          .deviceSettings(compatibleConnectId, {
            hapticFeedback,
          })
          .then(async (res) => {
            if (res.success && targetDevice.featuresInfo) {
              await localDb.updateDevice({
                features: targetDevice.featuresInfo,
                preciseUpdateFields: {
                  haptic_feedback: hapticFeedback,
                },
              });
            }
            return res;
          }),
    });
  }

  @backgroundMethod()
  async wipeDevice({
    walletId,
    connectId,
    featuresDeviceId,
  }: IWipeDeviceParams) {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    if (this._isTrezorDevice(device)) {
      const response = await this._withTrezorDeviceProcessing({
        walletId,
        connectId,
        featuresDeviceId,
        dbDevice: device,
        debugMethodName: 'deviceSettings.wipeDevice.trezor',
        action: async ({ connectId: targetConnectId }) => {
          const adapter = await getTrezorAdapterFromBackgroundApi(
            this.backgroundApi,
          );
          if (!adapter.wipeDevice) {
            throw new OneKeyLocalError('Trezor wipe not available');
          }
          return adapter.wipeDevice(targetConnectId);
        },
      });
      await localDb.clearTrezorDeviceThpState({ dbDeviceId: device.id });
      return response;
    }
    return this._withDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.wipeDevice',
      action: async (sdk, compatibleConnectId, targetDevice) => {
        const response = await sdk.deviceWipe(compatibleConnectId);
        if (
          response.success &&
          (targetDevice.vendor === EHardwareVendor.trezor ||
            targetDevice.settings?.vendor === EHardwareVendor.trezor)
        ) {
          await localDb.clearTrezorDeviceThpState({
            dbDeviceId: targetDevice.id,
          });
        }
        return response;
      },
    });
  }

  @backgroundMethod()
  async setInputPinOnSoftware({
    walletId,
    inputPinOnSoftware,
  }: ISetInputPinOnSoftwareParams) {
    const device = await localDb.getWalletDevice({ walletId });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: dbDeviceId, deviceId, connectId } = device;
    if (this._isTrezorDevice(device)) {
      if (inputPinOnSoftware) {
        throw new OneKeyLocalError(
          'Trezor software PIN input is not available',
        );
      }
      await localDb.updateDeviceDbSettings({
        dbDeviceId,
        settings: {
          ...device.settings,
          inputPinOnSoftware: false,
          inputPinOnSoftwareSupport: false,
        },
      });
      return;
    }

    let minSupportVersion: string | undefined = '';
    let inputPinOnSoftwareSupport: boolean | undefined;

    // If open PIN input on the App
    // Check whether the hardware supports it
    if (inputPinOnSoftware && !device.settings?.inputPinOnSoftwareSupport) {
      const supportFeatures =
        await this.serviceHardware.getDeviceSupportFeatures(connectId);

      if (!supportFeatures?.inputPinOnSoftware?.support) {
        // eslint-disable-next-line no-param-reassign
        inputPinOnSoftware = false;
        minSupportVersion = supportFeatures?.inputPinOnSoftware?.require;
        inputPinOnSoftwareSupport = false;
      } else {
        inputPinOnSoftwareSupport = true;
      }
    }

    const settings: IDBDeviceDbSettings = {
      ...device.settings,
      inputPinOnSoftware,
    };
    if (!isNil(inputPinOnSoftwareSupport)) {
      settings.inputPinOnSoftwareSupport = inputPinOnSoftwareSupport;
    }

    await localDb.updateDeviceDbSettings({
      dbDeviceId,
      settings,
    });

    if (minSupportVersion) {
      const error = new FirmwareVersionTooLow({
        payload: undefined as any,
        info: {
          0: minSupportVersion,
        },
      });
      // error.payload?.code
      throw error;
    }
  }
}
