import { isNil } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { FirmwareVersionTooLow } from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { generateConnectSrc } from '@onekeyhq/shared/src/hardware/instance';
import type { EOnekeyDomain } from '@onekeyhq/shared/types';

import localDb from '../../dbs/local/localDb';

import { ServiceHardwareManagerBase } from './ServiceHardwareManagerBase';

import type { IDBDeviceSettings as IDBDeviceDbSettings } from '../../dbs/local/types';
import type { DeviceSettingsParams } from '@onekeyfe/hd-core';
import type { Success } from '@onekeyfe/hd-transport';

export type ISetInputPinOnSoftwareParams = {
  walletId: string;
  inputPinOnSoftware: boolean;
};

export type ISetPassphraseEnabledParams = {
  walletId: string;
  passphraseEnabled: boolean;
};

export type IGetDeviceAdvanceSettingsParams = { walletId: string };

export class DeviceSettingsManager extends ServiceHardwareManagerBase {
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
  async applySettingsToDevice(
    connectId: string,
    settings: DeviceSettingsParams,
  ) {
    const hardwareSDK = await this.getSDKInstance();

    return convertDeviceResponse(() =>
      hardwareSDK?.deviceSettings(connectId, settings),
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
      },
    );
  }

  @backgroundMethod()
  async setPassphraseEnabled({
    walletId,
    passphraseEnabled,
  }: ISetPassphraseEnabledParams) {
    const device = await localDb.getWalletDevice({ walletId });
    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      () =>
        this.applySettingsToDevice(device.connectId, {
          usePassphrase: passphraseEnabled,
        }),
      {
        deviceParams: {
          dbDevice: device,
        },
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

  @backgroundMethod()
  async updateSDKSettings({
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
