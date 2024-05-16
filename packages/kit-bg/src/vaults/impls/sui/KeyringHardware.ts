import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyHardwareError } from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.sui.hd;

  async getPublicKey(
    connectId: string,
    deviceId: string,
    paths: Array<string>,
    deviceParams: IDeviceSharedCallParams,
  ): Promise<Array<string>> {
    let response;
    const sdk = await this.getHardwareSDKInstance();
    try {
      response = await sdk.suiGetPublicKey(connectId, deviceId, {
        bundle: paths.map((path) => ({ path })),
        ...deviceParams.deviceCommonParams,
      });
    } catch (error: any) {
      console.log(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success) {
      console.error(response.payload);
      throw convertDeviceError(response.payload);
    }

    const pubKeys = response.payload
      .map((result) => result.publicKey)
      .filter((item: string | undefined): item is string => !!item);

    return pubKeys;
  }

  override prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const paths: string[] = [];
        const addressesInfo = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            showOnOnekeyFn,
          }) => {
            const sdk = await this.getHardwareSDKInstance();
            paths.push(
              ...usedIndexes.map((index) => `${pathPrefix}/${index}'/0'/0'`),
            );
            const response = await sdk.suiGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle: paths.map((path, arrIndex) => ({
                path,
                showOnOneKey: showOnOnekeyFn(arrIndex),
              })),
            });

            return response;
          },
        });

        const includePublicKey = addressesInfo.every(
          (item) => !!item.publicKey,
        );
        let publicKeys: string[] = [];
        const { dbDevice } = params.deviceParams;
        const { connectId, deviceId } = dbDevice;
        if (!includePublicKey) {
          publicKeys = await this.getPublicKey(
            connectId,
            deviceId,
            paths,
            params.deviceParams,
          );
        }

        const ret: ICoreApiGetAddressItem[] = [];
        const index = 0;
        for (const addressInfo of addressesInfo) {
          const { address, path, publicKey } = addressInfo;
          if (!address) {
            throw new OneKeyHardwareError('Address is empty');
          }
          const item: ICoreApiGetAddressItem = {
            address: hexUtils.addHexPrefix(address),
            path,
            publicKey: publicKey || publicKeys[index] || '',
          };
          ret.push(item);
        }
        return ret;
      },
    });
  }

  override signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new Error('Method not implemented.');
  }
}
