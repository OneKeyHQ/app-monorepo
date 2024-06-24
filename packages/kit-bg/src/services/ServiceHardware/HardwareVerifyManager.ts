import {
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyServerApiError } from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import localDb from '../../dbs/local/localDb';
import { settingsPersistAtom } from '../../states/jotai/atoms';

import { ServiceHardwareManagerBase } from './ServiceHardwareManagerBase';

import type {
  IDBDevice,
  IDBUpdateFirmwareVerifiedParams,
} from '../../dbs/local/types';
import type {
  DeviceVerifySignature,
  IDeviceType,
  SearchDevice,
} from '@onekeyfe/hd-core';

export type IShouldAuthenticateFirmwareParams = { device: SearchDevice };
export type IFirmwareAuthenticateParams = {
  device: SearchDevice | IDBDevice; // TODO split SearchDevice and IDBDevice
  skipDeviceCancel?: boolean;
};

const deviceCheckingCodes = [0, 10104, 10105, 10106, 10107];

export class HardwareVerifyManager extends ServiceHardwareManagerBase {
  @backgroundMethod()
  async getDeviceCertWithSig({
    connectId,
    dataHex,
  }: {
    connectId: string;
    dataHex: string;
  }): Promise<DeviceVerifySignature> {
    const hardwareSDK = await this.getSDKInstance();
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceVerify(connectId, { dataHex }),
    );
  }

  @backgroundMethod()
  async shouldAuthenticateFirmware({
    device,
  }: IShouldAuthenticateFirmwareParams) {
    const dbDevice: IDBDevice | undefined = await localDb.getExistingDevice({
      rawDeviceId: device.deviceId || '',
      uuid: device.uuid,
    });
    // const versionText = deviceUtils.getDeviceVersionStr(device);
    // return dbDevice?.verifiedAtVersion !== versionText;
    return !dbDevice?.verifiedAtVersion;
  }

  @backgroundMethod()
  async updateFirmwareVerified(params: IDBUpdateFirmwareVerifiedParams) {
    const result = await localDb.updateFirmwareVerified(params);
    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async firmwareAuthenticate({
    device,
    skipDeviceCancel,
  }: IFirmwareAuthenticateParams): Promise<{
    verified: boolean;
    device: SearchDevice | IDBDevice;
    payload: {
      deviceType: IDeviceType;
      data: string;
      cert: string;
      signature: string;
    };
    result:
      | {
          message?: string;
          data?: string;
          code?: number;
        }
      | undefined;
  }> {
    const { connectId, deviceType } = device;
    if (!connectId) {
      throw new Error(
        'firmwareAuthenticate ERROR: device connectId is undefined',
      );
    }
    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        const ts = Date.now();
        const settings = await settingsPersistAtom.get();
        const data = `${settings.instanceId}_${ts}_${stringUtils.randomString(
          12,
        )}`;
        const dataHex = bufferUtils.textToHex(data, 'utf-8');
        const verifySig: DeviceVerifySignature =
          // call sdk.deviceVerify()
          await this.getDeviceCertWithSig({
            connectId,
            dataHex,
          });
        const { cert, signature } = verifySig;
        // always close dialog only without cancel device
        await this.backgroundApi.serviceHardwareUI.closeHardwareUiStateDialog({
          skipDeviceCancel: true, // firmwareAuthenticate close dialog before api call
          connectId,
        });
        appEventBus.emit(
          EAppEventBusNames.HardwareVerifyAfterDeviceConfirm,
          undefined,
        );
        const client = await this.serviceHardware.getClient(
          EServiceEndpointEnum.Wallet,
        );

        const payload = {
          deviceType,
          data,
          cert,
          signature,
        };
        const resp = await client.post<{
          message?: string;
          data?: string;
          code?: number;
        }>(
          '/wallet/v1/hardware/verify',

          payload,
        );
        const result = resp.data;
        console.log('firmwareAuthenticate result: ', result, connectId);

        // result.message = 'false';

        // result.data = 'CLA45F0024'; // server return SN
        // SearchDevice.connectId (web sdk return SN, but ble sdk return uuid)

        if (
          typeof result.code !== 'number' ||
          !deviceCheckingCodes.includes(result.code)
        ) {
          throw new OneKeyServerApiError({
            code: result.code,
            message: result.message,
          });
        }

        const verified = result.code === 0;

        const dbDevice = device as IDBDevice;
        if (dbDevice?.id) {
          void this.updateFirmwareVerified({
            device: dbDevice,
            verifyResult: verified ? 'official' : 'unofficial',
          });
        }

        return {
          verified,
          device,
          payload,
          result,
        };
      },
      {
        deviceParams: { dbDevice: device as any },
        hideCheckingDeviceLoading: true,
        skipDeviceCancel,
      },
    );
  }
}
