import type { IEncodedTxScdo } from '@onekeyhq/core/src/chains/scdo/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import {
  hash,
  serializeSignedTransaction,
  serializeUnsignedTransaction,
} from './utils';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.evm.hd;

  override prepareAccounts(
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
            showOnOnekeyFn,
          }) => {
            const sdk = await this.getHardwareSDKInstance();
            const response = await sdk.scdoGetAddress(connectId, deviceId, {
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
        const addressRelPath = '0/0';
        for (let i = 0; i < addresses.length; i += 1) {
          const item = addresses[i];
          const { path, address } = item;
          const addressInfo: ICoreApiGetAddressItem = {
            address: address ?? '',
            publicKey: '',
            path,
            relPath: addressRelPath,
            xpub: '',
            addresses: {
              [addressRelPath]: address ?? '',
            },
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
    const { dbDevice, deviceCommonParams } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = checkIsDefined(dbDevice);
    const sdk = await this.getHardwareSDKInstance();
    const account = await this.vault.getAccount();
    console.log(deviceCommonParams, connectId, deviceId, sdk, account.path);
    const encodedTx = unsignedTx.encodedTx as IEncodedTxScdo;
    const signingTx = serializeUnsignedTransaction(encodedTx);
    const txHash = hash(signingTx);
    const res = await convertDeviceResponse(() =>
      sdk.scdoSignTransaction(connectId, deviceId, {
        ...deviceCommonParams,
        path: account.path,
        nonce: encodedTx.AccountNonce.toString(),
        gasPrice: encodedTx.GasPrice.toString(),
        gasLimit: encodedTx.GasLimit.toString(),
        to: encodedTx.To,
        value: encodedTx.Amount.toString(),
        timestamp: encodedTx.Timestamp.toString(),
        data: encodedTx.Payload,
        txType: encodedTx.Type,
      }),
    );
    if (!res.signature) {
      throw new OneKeyInternalError('Failed to sign transaction');
    }
    const rawTx = serializeSignedTransaction(encodedTx, txHash, res.signature);
    return {
      txid: txHash,
      rawTx,
      encodedTx: unsignedTx.encodedTx,
      signature: res.signature,
    };
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const { messages, deviceParams } = params;
    const { dbDevice, deviceCommonParams } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = checkIsDefined(dbDevice);
    const sdk = await this.getHardwareSDKInstance();
    const account = await this.vault.getAccount();
    const res = await convertDeviceResponse(() =>
      sdk.scdoSignMessage(connectId, deviceId, {
        ...deviceCommonParams,
        path: account.path,
        messageHex: messages[0].message,
      }),
    );
    if (!res.signature) {
      throw new OneKeyInternalError('Failed to sign message');
    }
    return [res.signature];
  }
}
