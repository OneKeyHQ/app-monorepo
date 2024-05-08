/* eslint-disable @typescript-eslint/no-unused-vars */
import type { IEncodedTxNear } from '@onekeyhq/core/src/chains/near/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import {
  baseEncode,
  deserializeSignedTransaction,
  deserializeTransaction,
  nearApiJs,
  serializeTransaction,
} from './utils';

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
            publicKey: `ed25519:${baseEncode(
              Buffer.from(address ?? '', 'hex'),
            )}`,
          };
          ret.push(addressInfo);
        }
        return ret;
      },
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, deviceParams } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxNear;
    const sdk = await this.getHardwareSDKInstance();
    const path = await this.vault.getAccountPath();
    const { deviceCommonParams, dbDevice } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = dbDevice;

    const result = await convertDeviceResponse(async () =>
      sdk.nearSignTransaction(connectId, deviceId, {
        path,
        rawTx: Buffer.from(encodedTx, 'base64').toString('hex'),
        ...deviceCommonParams,
      }),
    );

    const { signature } = result;

    const nativeTx = deserializeTransaction(encodedTx);

    return {
      txid: serializeTransaction(nativeTx, {
        encoding: 'sha256_bs58',
      }),
      encodedTx,
      rawTx: serializeTransaction(
        new nearApiJs.transactions.SignedTransaction({
          transaction: nativeTx,
          signature: new nearApiJs.transactions.Signature({
            keyType: nativeTx.publicKey.keyType,
            data: Buffer.from(signature, 'hex'),
          }),
        }),
      ),
    };
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new Error('Method not implemented.');
  }
}
