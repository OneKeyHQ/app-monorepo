/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { slicePathTemplate } from '@onekeyhq/core/src/utils';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { HardwareSDK } from '@onekeyhq/shared/src/hardware/instance';
import {
  EConfirmOnDeviceType,
  type IDeviceResponse,
  type IGetDeviceAccountDataParams,
} from '@onekeyhq/shared/types/device';

import { EVaultKeyringTypes } from '../types';

import { KeyringBase } from './KeyringBase';

import type { IPrepareHardwareAccountsParams } from '../types';

export type IWalletPassphraseState = {
  passphraseState?: string;
  useEmptyPassphrase?: boolean;
};

export abstract class KeyringHardwareBase extends KeyringBase {
  override keyringType: EVaultKeyringTypes = EVaultKeyringTypes.hardware;

  async getHardwareSDKInstance() {
    // Since the sdk instance can not pass the serializable testing in backgroundApiProxy
    // The direct call to backgroundApi is used here
    // This is a special case and direct access to backgroundApi is not recommended elsewhere.
    const sdk =
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      await global?.$backgroundApiProxy?.backgroundApi?.serviceHardware?.getSDKInstance?.();
    return (sdk as typeof HardwareSDK) ?? HardwareSDK;
  }

  async baseGetDeviceAccountData<T>({
    params,
    usedIndexes,
    sdkGetDataFn,
    errorMessage,
  }: {
    params: IPrepareHardwareAccountsParams;
    usedIndexes: number[];
    sdkGetDataFn: (
      option: IGetDeviceAccountDataParams,
    ) => IDeviceResponse<Array<T>>;
    errorMessage: string;
  }): Promise<T[]> {
    const { deriveInfo, deviceParams } = params;
    const { dbDevice, confirmOnDevice } = deviceParams;
    const { connectId, deviceId } = dbDevice;
    const { template, coinName } = deriveInfo;
    const { pathPrefix, pathSuffix } = slicePathTemplate(template);

    const showOnOnekeyFn = (arrIndex: number) => {
      if (confirmOnDevice === EConfirmOnDeviceType.EveryItem) {
        return true;
      }

      if (confirmOnDevice === EConfirmOnDeviceType.LastItem) {
        return arrIndex === usedIndexes[usedIndexes.length - 1];
      }

      return false;
    };

    const result = await convertDeviceResponse(async () =>
      sdkGetDataFn({
        connectId,
        deviceId,
        pathPrefix,
        pathSuffix,
        coinName,
        showOnOnekeyFn,
      }),
    );

    if (!result || result.length !== usedIndexes.length) {
      throw new OneKeyInternalError(errorMessage);
    }
    return result;
  }

  async baseGetDeviceAccountPublicKeys<T>({
    params,
    usedIndexes,
    sdkGetPublicKeysFn,
  }: {
    params: IPrepareHardwareAccountsParams;
    usedIndexes: number[];
    sdkGetPublicKeysFn: (
      option: IGetDeviceAccountDataParams,
    ) => IDeviceResponse<Array<T>>;
  }): Promise<T[]> {
    return this.baseGetDeviceAccountData({
      params,
      usedIndexes,
      sdkGetDataFn: sdkGetPublicKeysFn,
      errorMessage: 'Unable to get public keys.',
    });
  }

  async baseGetDeviceAccountAddresses<T>({
    params,
    usedIndexes,
    sdkGetAddressFn,
  }: {
    params: IPrepareHardwareAccountsParams;
    usedIndexes: number[];
    sdkGetAddressFn: (
      option: IGetDeviceAccountDataParams,
    ) => IDeviceResponse<Array<T>>;
  }): Promise<T[]> {
    return this.baseGetDeviceAccountData({
      params,
      usedIndexes,
      sdkGetDataFn: sdkGetAddressFn,
      errorMessage: 'Unable to get addresses.',
    });
  }
}
