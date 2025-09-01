import { ResourceType, type Success } from '@onekeyfe/hd-transport';
import { isNil } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  FirmwareVersionTooLow,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import deviceHomeScreenUtils from '@onekeyhq/shared/src/utils/deviceHomeScreenUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';

import { ServiceHardwareManagerBase } from './ServiceHardwareManagerBase';

import type {
  IDBDevice,
  IDBDeviceSettings as IDBDeviceDbSettings,
} from '../../dbs/local/types';
import type {
  DeviceSettingsParams,
  DeviceUploadResourceParams,
} from '@onekeyfe/hd-core';

export type ISetInputPinOnSoftwareParams = {
  walletId: string;
  inputPinOnSoftware: boolean;
};

export type ISetPassphraseEnabledParams = {
  walletId: string;
  connectId?: string;
  featuresDeviceId?: string;
  passphraseEnabled: boolean;
};

export type IGetDeviceAdvanceSettingsParams = { walletId: string };
export type IGetDeviceLabelParams = { walletId: string };
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

export class DeviceSettingsManager extends ServiceHardwareManagerBase {
  @backgroundMethod()
  async changePin(connectId: string, remove = false): Promise<Success> {
    const compatibleConnectId =
      await this.serviceHardware.getCompatibleConnectId({
        connectId,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      });
    const hardwareSDK = await this.getSDKInstance({
      connectId: compatibleConnectId,
    });

    return convertDeviceResponse(() =>
      hardwareSDK?.deviceChangePin(compatibleConnectId, {
        remove,
      }),
    );
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
  }: ISetDeviceHomeScreenParams) {
    const device = await localDb.getDevice(dbDeviceId);

    const { nameHex, screenHex, thumbnailHex, resType, isUserUpload } =
      screenItem;

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
            nftMetaData: '',
          };
          // upload wallpaper resource will automatically set the home screen
          await convertDeviceResponse(() =>
            hardwareSDK.deviceUploadResource(
              compatibleConnectId,
              uploadResParams,
            ),
          );
        } else {
          // Pro、Touch: built-in wallpaper
          // Classic、mini、1s、pure: custom upload and built-in wallpaper
          if (!finallyScreenHex && !isMonochrome) {
            // empty string will clear the home screen(classic,mini)
            throw new OneKeyLocalError('Invalid home screen hex');
          }
          await this.applySettingsToDevice(device.connectId, {
            homescreen: finallyScreenHex,
          });
        }
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
    let device: IDBDevice | undefined;
    if (walletId) {
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
      () =>
        this.applySettingsToDevice(device.connectId, {
          usePassphrase: passphraseEnabled,
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
  async setInputPinOnSoftware({
    walletId,
    inputPinOnSoftware,
  }: ISetInputPinOnSoftwareParams) {
    const device = await localDb.getWalletDevice({ walletId });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: dbDeviceId, deviceId, connectId } = device;

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
