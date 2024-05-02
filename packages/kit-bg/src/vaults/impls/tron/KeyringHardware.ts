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
  override coreApi = coreChainApi.tron.hd;

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const chainId = await this.getNetworkChainId();

    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const publicKeys = await this.baseGetDeviceAccountPublicKeys({
          params,
          usedIndexes,
          sdkGetPublicKeysFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            pathSuffix,
            coinName,
            showOnOnekeyFn,
          }) => {
            const sdk = await this.getHardwareSDKInstance();

            const response = await sdk.tronGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams, // passpharse params
              bundle: usedIndexes.map((index, arrIndex) => ({
                path: `${pathPrefix}/${pathSuffix.replace(
                  '{index}',
                  `${index}`,
                )}`,
                showOnOneKey: showOnOnekeyFn(arrIndex),
                chainId: Number(chainId),
              })),
            });
            return response;
          },
        });

        console.log('tron-buildAddressesInfo', publicKeys);

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < publicKeys.length; i += 1) {
          const item = publicKeys[i];
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
