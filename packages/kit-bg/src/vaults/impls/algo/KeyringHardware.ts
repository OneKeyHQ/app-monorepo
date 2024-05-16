/* eslint-disable @typescript-eslint/no-unused-vars */
import { isArray } from 'lodash';

import type {
  IEncodedTxAlgo,
  IEncodedTxGroupAlgo,
} from '@onekeyhq/core/src/chains/algo/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import sdkAlgo from './sdkAlgo';

import type { ISdkAlgoEncodedTransaction } from './sdkAlgo';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.algo.hd;

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const addresses = await this.baseGetDeviceAccountAddresses({
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

            const response = await sdk.algoGetAddress(connectId, deviceId, {
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

        console.log('algo-buildAddressesInfo', addresses);

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < addresses.length; i += 1) {
          const item = addresses[i];
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

  async _signAlgoTx({
    encodedTx,
    deviceParams,
  }: {
    encodedTx: IEncodedTxAlgo;
    deviceParams?: IDeviceSharedCallParams;
  }) {
    const sdk = await this.getHardwareSDKInstance();
    const path = await this.vault.getAccountPath();
    const { deviceCommonParams, dbDevice } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = dbDevice;

    const transaction = sdkAlgo.Transaction.from_obj_for_encoding(
      sdkAlgo.decodeObj(
        Buffer.from(encodedTx, 'base64'),
      ) as ISdkAlgoEncodedTransaction,
    );

    const result = await convertDeviceResponse(async () =>
      sdk.nearSignTransaction(connectId, deviceId, {
        path,
        rawTx: transaction.bytesToSign().toString('hex'),
        ...deviceCommonParams,
      }),
    );

    const { signature } = result;

    return {
      txid: transaction.txID(),
      rawTx: Buffer.from(
        sdkAlgo.encodeObj({
          sig: Buffer.from(signature, 'hex'),
          txn: transaction.get_obj_for_encoding(),
        }),
      ).toString('base64'),
    };
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, deviceParams } = params;
    const encodedTx = unsignedTx.encodedTx as
      | IEncodedTxAlgo
      | IEncodedTxGroupAlgo;

    if (isArray(encodedTx)) {
      const signedTxs = [];
      for (let i = 0; i < encodedTx.length; i += 1) {
        const tx = encodedTx[i];
        const signedTx = await this._signAlgoTx({
          encodedTx: tx,
          deviceParams,
        });
        signedTxs.push(signedTx);
      }
      return {
        encodedTx: unsignedTx.encodedTx,
        txid: signedTxs.map((tx) => tx.txid).join(','),
        rawTx: signedTxs.map((tx) => tx.rawTx).join(','),
      };
    }

    const signedTx = await this._signAlgoTx({
      encodedTx,
      deviceParams,
    });

    return {
      encodedTx: unsignedTx.encodedTx,
      txid: signedTx.txid,
      rawTx: signedTx.rawTx,
    };
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new Error('Method not implemented.');
  }
}
