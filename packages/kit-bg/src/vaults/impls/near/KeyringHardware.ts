/* eslint-disable @typescript-eslint/no-unused-vars */
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.near.hd;

  override prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const nearAddresses = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            pathSuffix,
            coinName,
            showOnOnekeyFn,
          }) => {
            const sdk = await this.getHardwareSDKInstance();

            const response = await sdk.nearGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle: usedIndexes.map((index, arrIndex) => ({
                path: `${pathPrefix}/${pathSuffix.replace(
                  '{index}',
                  `${index}`,
                )}`,
                showOnOneKey: showOnOnekeyFn(arrIndex),
              })),
            });
            return response;
          },
        });

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < nearAddresses.length; i += 1) {
          const item = nearAddresses[i];
          const { path, address } = item;
          const { normalizedAddress } = await this.vault.validateAddress(
            address ?? '',
          );
          const addressInfo: ICoreApiGetAddressItem = {
            address: normalizedAddress || address || '',
            path,
            publicKey: '',
          };
          ret.push(addressInfo);
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
