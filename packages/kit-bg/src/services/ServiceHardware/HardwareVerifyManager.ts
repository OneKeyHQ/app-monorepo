import { EFirmwareType } from '@onekeyfe/hd-shared';

import {
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  OneKeyLocalError,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';
import type {
  IDeviceVerifyVersionCompareResult,
  IFetchFirmwareVerifyHashParams,
  IFirmwareVerifyInfo,
  IFirmwareVerifyResult,
  IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types/device';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IPrimeGiftDevice,
  IPrimeGiftVerifyV2Result,
} from '@onekeyhq/shared/types/prime/primeGiftTypes';

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
  OnekeyFeatures,
  SearchDevice,
} from '@onekeyfe/hd-core';

export type IShouldAuthenticateFirmwareParams = { device: SearchDevice };
export type IFirmwareAuthenticateParams = {
  device: SearchDevice | IDBDevice; // TODO split SearchDevice and IDBDevice
  skipDeviceCancel?: boolean;
};

const deviceCheckingCodes = new Set([10_104, 10_105, 10_106, 10_107]);

type FirmwareVerifyPayload = {
  data: string;
  dataHex: string;
};

type IHardwareVerifyV2Data = {
  sno: string;
  primeCode?: string;
  primeCodeStatus?: IPrimeGiftVerifyV2Result['status'];
};

function getFirmwareVerifyPayload({
  instanceId,
}: {
  instanceId: string;
}): FirmwareVerifyPayload {
  // Same challenge as Pro/Classic: wallet splits `data` on '_' and requires
  // a UUID v4 instanceId. Device gets the UTF-8 bytes; Pro2/Neo firmware
  // must accept this variable-length message the same way Pro does.
  const data = `${instanceId}_${Date.now()}_${stringUtils.randomString(12)}`;
  return {
    data,
    dataHex: bufferUtils.textToHex(data, 'utf-8'),
  };
}

function buildSkippedFirmwareAuthenticateResult(
  device: SearchDevice | IDBDevice,
): IFirmwareVerifyResult {
  return {
    verified: false,
    skipVerification: true,
    device,
    payload: {
      deviceType: device.deviceType,
      data: '',
      cert: '',
      signature: '',
    },
    result: {
      code: 0,
      message: 'Firmware authentication skipped',
    },
  };
}

function buildSkippedFirmwareHashResult(
  onekeyFeatures: OnekeyFeatures | undefined,
): IDeviceVerifyVersionCompareResult {
  const localVerifyInfos = onekeyFeatures
    ? deviceUtils.parseLocalDeviceVersions({ onekeyFeatures })
    : undefined;

  return {
    certificate: {
      isMatch: false,
      format: onekeyFeatures?.onekey_serial_no ?? '',
    },
    firmware: {
      isMatch: false,
      format: localVerifyInfos?.firmware.formatted ?? '',
      releaseUrl: localVerifyInfos?.firmware.releaseUrl,
    },
    bluetooth: {
      isMatch: false,
      format: localVerifyInfos?.bluetooth.formatted ?? '',
      releaseUrl: localVerifyInfos?.bluetooth.releaseUrl,
    },
    bootloader: {
      isMatch: false,
      format: localVerifyInfos?.bootloader.formatted ?? '',
      releaseUrl: localVerifyInfos?.bootloader.releaseUrl,
    },
  };
}

export class HardwareVerifyManager extends ServiceHardwareManagerBase {
  async firmwareAuthenticateForPrimeGift({
    device,
    serialNo,
  }: {
    device: IPrimeGiftDevice;
    serialNo: string;
  }): Promise<IPrimeGiftVerifyV2Result> {
    if (!device.connectId || !serialNo) {
      throw new OneKeyLocalError(
        appLocale.intl.formatMessage({
          id: ETranslations.prime_gift_connect_device__msg,
        }),
      );
    }
    const connectId = device.connectId;
    const dbDevice = await localDb.getExistingDevice({
      rawDeviceId: device.deviceId || '',
      uuid: serialNo,
    });
    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        const payload = await this.getFirmwareVerificationPayload({
          connectId,
          deviceType: device.deviceType,
        });
        const response = await this.requestFirmwareVerification(payload);
        const result = response.data;
        if (response.code !== 0) {
          throw new OneKeyServerApiError({
            code: response.code,
            message: response.message,
          });
        }
        return {
          code: result?.primeCode,
          status: result?.primeCodeStatus,
        };
      },
      {
        deviceParams: dbDevice
          ? { dbDevice: { ...dbDevice, connectId } }
          : undefined,
        hideCheckingDeviceLoading: true,
        debugMethodName: 'firmwareAuthenticateForPrimeGift',
      },
    );
  }

  private async requestFirmwareVerification(
    payload: IFirmwareVerifyResult['payload'],
  ) {
    const client = await this.serviceHardware.getClient(
      EServiceEndpointEnum.Wallet,
    );
    const response = await client.post<{
      code: number;
      message: string;
      data?: IHardwareVerifyV2Data | null;
    }>('/wallet/v1/hardware/verify-v2', payload);
    return response.data;
  }

  private async getFirmwareVerificationPayload({
    connectId,
    deviceType,
  }: {
    connectId: string;
    deviceType: IDeviceType;
  }): Promise<IFirmwareVerifyResult['payload']> {
    const { instanceId } = await settingsPersistAtom.get();
    const { data, dataHex } = getFirmwareVerifyPayload({ instanceId });
    const { cert, signature } = await this.getDeviceCertWithSig({
      connectId,
      dataHex,
    });
    await this.backgroundApi.serviceHardwareUI.closeHardwareUiStateDialog({
      skipDeviceCancel: true,
      connectId,
    });
    appEventBus.emit(
      EAppEventBusNames.HardwareVerifyAfterDeviceConfirm,
      undefined,
    );
    return { deviceType, data, cert, signature };
  }

  private isFirmwareVerificationEnabled(deviceType?: IDeviceType) {
    return deviceUtils.isFirmwareVerifySupported(deviceType);
  }

  @backgroundMethod()
  async getDeviceCertWithSig({
    connectId,
    dataHex,
  }: {
    connectId: string;
    dataHex: string;
  }): Promise<DeviceVerifySignature> {
    const compatibleConnectId =
      await this.serviceHardware.getCompatibleConnectId({
        connectId,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      });
    const hardwareSDK = await this.getSDKInstance({
      connectId: compatibleConnectId,
    });
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceVerify(compatibleConnectId, { dataHex }),
    );
  }

  @backgroundMethod()
  async shouldAuthenticateFirmware({
    device,
  }: IShouldAuthenticateFirmwareParams) {
    if (!this.isFirmwareVerificationEnabled(device.deviceType)) {
      return false;
    }

    const dbDevice: IDBDevice | undefined = await localDb.getExistingDevice({
      rawDeviceId: device.deviceId || '',
      uuid:
        (device as SearchDevice & { serialNo?: string | null }).serialNo ||
        device.uuid,
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
  }: IFirmwareAuthenticateParams): Promise<IFirmwareVerifyResult> {
    const { connectId, deviceType } = device;
    if (!this.isFirmwareVerificationEnabled(deviceType)) {
      return buildSkippedFirmwareAuthenticateResult(device);
    }

    if (!connectId) {
      throw new OneKeyLocalError(
        'firmwareAuthenticate ERROR: device connectId is undefined',
      );
    }
    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        const payload = await this.getFirmwareVerificationPayload({
          connectId,
          deviceType,
        });
        let result: NonNullable<IFirmwareVerifyResult['result']> = {};
        try {
          const response = await this.requestFirmwareVerification(payload);
          const serialNumber = response.data?.sno;
          if (
            response.code === 0 &&
            (typeof serialNumber !== 'string' || !serialNumber.trim())
          ) {
            throw new OneKeyLocalError(
              'Device verification returned an invalid serial number.',
            );
          }
          // Keep redemption codes inside the background service while preserving
          // the certificate serial format used by the genuine-check UI.
          result = {
            code: response.code,
            message: response.message,
            data: typeof serialNumber === 'string' ? serialNumber : undefined,
          };
        } catch (error) {
          if (
            error instanceof OneKeyServerApiError &&
            deviceCheckingCodes.has(error.code)
          ) {
            result = {
              code: error.code,
              message: error.message,
            };
          } else {
            throw error;
          }
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
        debugMethodName: 'firmwareAuthenticate.verify',
      },
    );
  }

  @backgroundMethod()
  async shouldAuthenticateFirmwareByHash({
    features,
  }: {
    features: IOneKeyDeviceFeatures | undefined;
  }) {
    const deviceType = features
      ? await deviceUtils.getDeviceTypeFromFeatures({ features })
      : undefined;
    if (!this.isFirmwareVerificationEnabled(deviceType)) {
      return false;
    }

    if (!features) {
      return false;
    }
    const verifyVersions =
      await deviceUtils.getDeviceVerifyVersionsFromFeatures({
        features,
      });
    if (!verifyVersions) {
      return false;
    }
    const result = await this.fetchFirmwareVerifyHash(verifyVersions);
    // server should return 3 firmware config
    if (!result || !Array.isArray(result) || result.length !== 3) {
      return false;
    }
    const isValid = result.every((firmware) => {
      if (
        firmware.type === 'system' &&
        firmware.version !== verifyVersions.firmwareVersion
      ) {
        console.log('System version mismatch:', {
          expected: verifyVersions.firmwareVersion,
          actual: firmware.version,
        });
        return false;
      }
      if (
        firmware.type === 'bluetooth' &&
        firmware.version !== verifyVersions.bluetoothVersion
      ) {
        console.log('Bluetooth version mismatch:', {
          expected: verifyVersions.bluetoothVersion,
          actual: firmware.version,
        });
        return false;
      }
      if (
        firmware.type === 'bootloader' &&
        firmware.version !== verifyVersions.bootloaderVersion
      ) {
        console.log('Bootloader version mismatch:', {
          expected: verifyVersions.bootloaderVersion,
          actual: firmware.version,
        });
        return false;
      }
      return true;
    });

    console.log('shouldAuthenticateFirmwareByHash isValid: ', isValid);
    return isValid;
  }

  @backgroundMethod()
  async fetchFirmwareVerifyHash(
    params: IFetchFirmwareVerifyHashParams,
  ): Promise<IFirmwareVerifyInfo[]> {
    if (!this.isFirmwareVerificationEnabled(params.deviceType)) {
      return [];
    }

    try {
      return await this.fetchFirmwareVerifyHashWithCache(params);
    } catch {
      return [];
    }
  }

  fetchFirmwareVerifyHashWithCache = memoizee(
    async (params: IFetchFirmwareVerifyHashParams) => {
      const client = await this.serviceHardware.getClient(
        EServiceEndpointEnum.Utility,
      );

      let firmwareType: 'universal' | 'btconly' = 'universal';
      if (params.firmwareType === EFirmwareType.BitcoinOnly) {
        firmwareType = 'btconly';
      }
      const resp = await client.get<{
        data: {
          firmwares: IFirmwareVerifyInfo[];
        };
      }>('/utility/v1/firmware/detail', {
        params: {
          deviceType: params.deviceType,
          system: params.firmwareVersion,
          bluetooth: params.bluetoothVersion,
          bootloader: params.bootloaderVersion,
          firmwareType,
        },
      });
      return resp.data.data.firmwares;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 2 }),
    },
  );

  @backgroundMethod()
  async verifyFirmwareHash({
    deviceType,
    onekeyFeatures,
  }: {
    deviceType: IDeviceType;
    onekeyFeatures: OnekeyFeatures | undefined;
  }): Promise<IDeviceVerifyVersionCompareResult> {
    if (!this.isFirmwareVerificationEnabled(deviceType)) {
      return buildSkippedFirmwareHashResult(onekeyFeatures);
    }

    const defaultResult = {
      certificate: {
        isMatch: true,
        format: onekeyFeatures?.onekey_serial_no ?? '',
      },
      firmware: { isMatch: false, format: '' },
      bluetooth: { isMatch: false, format: '' },
      bootloader: { isMatch: false, format: '' },
    };

    if (!onekeyFeatures) {
      return defaultResult;
    }

    const verifyVersions =
      await deviceUtils.getDeviceVerifyVersionsFromRawOnekeyFeatures({
        onekeyFeatures,
        deviceType,
      });
    if (!verifyVersions) {
      return defaultResult;
    }

    const result = await this.fetchFirmwareVerifyHash(verifyVersions);
    if (!result || !Array.isArray(result)) {
      return defaultResult;
    }
    const serverVerifyInfos = deviceUtils.parseServerVersionInfos({
      serverVerifyInfos: result,
    });
    const localVerifyInfos = deviceUtils.parseLocalDeviceVersions({
      onekeyFeatures,
    });

    const firmwareMatch = deviceUtils.compareDeviceVersions({
      local: localVerifyInfos.firmware.raw,
      remote: serverVerifyInfos.firmware.raw,
    });
    const bluetoothMatch = deviceUtils.compareDeviceVersions({
      local: localVerifyInfos.bluetooth.raw,
      remote: serverVerifyInfos.bluetooth.raw,
    });
    const bootloaderMatch = deviceUtils.compareDeviceVersions({
      local: localVerifyInfos.bootloader.raw,
      remote: serverVerifyInfos.bootloader.raw,
    });

    if (!firmwareMatch || !bluetoothMatch || !bootloaderMatch) {
      defaultLogger.hardware.verify.verifyFailed({
        local: localVerifyInfos,
        server: serverVerifyInfos,
      });
    }

    return {
      certificate: {
        isMatch: true,
        format: onekeyFeatures.onekey_serial_no ?? '',
      },
      firmware: {
        isMatch: firmwareMatch,
        format: serverVerifyInfos.firmware.formatted,
        releaseUrl: serverVerifyInfos.firmware.releaseUrl,
      },
      bluetooth: {
        isMatch: bluetoothMatch,
        format: serverVerifyInfos.bluetooth.formatted,
        releaseUrl: serverVerifyInfos.bluetooth.releaseUrl,
      },
      bootloader: {
        isMatch: bootloaderMatch,
        format: serverVerifyInfos.bootloader.formatted,
        releaseUrl: serverVerifyInfos.bootloader.releaseUrl,
      },
    };
  }
}
