/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { slicePathTemplate } from '@onekeyhq/core/src/utils';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  OneKeyInternalError,
  UnsupportedAddressTypeError,
} from '@onekeyhq/shared/src/errors';
import {
  convertDeviceError,
  convertDeviceResponse,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { HardwareSDK } from '@onekeyhq/shared/src/hardware/instance';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IDeviceResponse,
  IGetDeviceAccountDataParams,
  IHardwareGetPubOrAddressExtraInfo,
} from '@onekeyhq/shared/types/device';
import { EConfirmOnDeviceType } from '@onekeyhq/shared/types/device';

import { EVaultKeyringTypes } from '../types';

import { KeyringBase } from './KeyringBase';

import type {
  IHwAllNetworkPrepareAccountsItem,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
} from '../types';

export type IWalletPassphraseState = {
  passphraseState?: string;
  useEmptyPassphrase?: boolean;
};

export abstract class KeyringHardwareBase extends KeyringBase {
  override keyringType: EVaultKeyringTypes = EVaultKeyringTypes.hardware;

  hwSdkNetwork: IHwSdkNetwork | undefined;

  async getHardwareSDKInstance({ connectId }: { connectId: string }) {
    defaultLogger.account.accountCreatePerf.getHardwareSDKInstance();

    // Since the sdk instance can not pass the serializable testing in backgroundApiProxy
    // The direct call to backgroundApi is used here
    // This is a special case and direct access to backgroundApi is not recommended elsewhere.
    const sdk =
      await appGlobals?.$backgroundApiProxy?.backgroundApi?.serviceHardware?.getSDKInstance?.(
        {
          connectId,
        },
      );
    const r = (sdk as typeof HardwareSDK) ?? HardwareSDK;

    defaultLogger.account.accountCreatePerf.getHardwareSDKInstanceDone();

    return r;
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
    const { deriveInfo, deviceParams, chainExtraParams } = params;
    const { dbDevice, confirmOnDevice } = deviceParams;
    const { connectId, deviceId } = dbDevice;
    const { template, coinName } = deriveInfo;
    const { pathPrefix, pathSuffix } = slicePathTemplate(template);
    const { receiveAddressPath } = chainExtraParams ?? {};

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
        template,
        coinName,
        receiveAddressPath,
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

  async getAllNetworkPrepareAccounts<
    T extends {
      __hwExtraInfo__: IHardwareGetPubOrAddressExtraInfo | undefined;
    },
  >({
    hwSdkNetwork,
    params,
    usedIndexes,
    buildPath,
    buildResultAccount,
  }: {
    hwSdkNetwork: IHwSdkNetwork | undefined;
    params: IPrepareHardwareAccountsParams;
    usedIndexes: number[];
    buildPath: (p: { index: number }) => string | Promise<string>;
    buildResultAccount: (p: {
      account: IHwAllNetworkPrepareAccountsItem;
      index: number;
    }) => T;
  }): Promise<
    | {
        success: true;
        payload: T[];
      }
    | undefined
  > {
    if (!hwSdkNetwork) {
      return undefined;
    }
    const { hwAllNetworkPrepareAccountsResponse } = params;
    if (hwAllNetworkPrepareAccountsResponse) {
      try {
        const resultAccounts: T[] = [];
        for (const index of usedIndexes) {
          const path: string = await buildPath({
            index,
          });
          // const account = hwAllNetworkPrepareAccountsResponse?.find(
          //   (item) =>
          //     item.network && item.path === path && item.network === hwSdkNetwork,
          // );
          const account = await hwAllNetworkPrepareAccountsResponse.getItem({
            path,
            hwSdkNetwork,
          });
          if (account && account.success && account.payload) {
            const resultAccount = buildResultAccount({ account, index });
            if (resultAccount) {
              resultAccount.__hwExtraInfo__ = {
                rootFingerprint: account?.payload?.rootFingerprint,
              };

              // TODO remove this
              // resultAccount.__hwExtraInfo__ = undefined;
              // if (index % 2 === 1) {
              //   resultAccount.__hwExtraInfo__ = {
              //     rootFingerprint: 1111,
              //   };
              // }
            }
            resultAccounts.push(resultAccount);
          }
        }
        if (resultAccounts.length === usedIndexes.length) {
          return {
            success: true,
            payload: resultAccounts,
          };
        }

        // if result length not match to indexes, throw first error item
        const hasErrorItem =
          await hwAllNetworkPrepareAccountsResponse.getFirstErrorItem();
        if (
          hasErrorItem &&
          !hasErrorItem?.success &&
          hasErrorItem?.payload?.error
        ) {
          if (
            // response.payload.code === HardwareErrorCode.RuntimeError &&
            hasErrorItem?.payload?.error?.indexOf(
              'Failure_DataError,Forbidden key path',
            ) !== -1
          ) {
            throw new UnsupportedAddressTypeError();
          }
          throw convertDeviceError(hasErrorItem.payload);
          // throw new OneKeyInternalError(hasErrorItem.payload.error);
        }
        throw new OneKeyInternalError('SDK GetAllNetworkAccounts Failed');
      } finally {
        // do not destroy hwAllNetworkPrepareAccountsResponse here,
        // it will be destroyed in onFinally callback of ServiceBatchCreateAccount
        // hwAllNetworkPrepareAccountsResponse?.destroy();
      }
    }
  }
}
