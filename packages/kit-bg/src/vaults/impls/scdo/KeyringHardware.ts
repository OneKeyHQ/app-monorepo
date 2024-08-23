/* eslint-disable @typescript-eslint/no-unused-vars */
import type { IEncodedTxScdo } from '@onekeyhq/core/src/chains/scdo/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
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
            console.log(
              connectId,
              deviceId,
              pathPrefix,
              pathSuffix,
              showOnOnekeyFn,
            );
            return {
              'event': 'RESPONSE_EVENT',
              'type': 'RESPONSE_EVENT',
              'id': 8,
              'success': true,
              'payload': [
                {
                  'path': "m/44'/541'/0'/0/0",
                  'address': '1S0118a02f993fc7a4348fd36b7f7a596948f02b31',
                },
              ],
            };
            // const sdk = await this.getHardwareSDKInstance();
            // const response = await sdk.cosmosGetAddress(connectId, deviceId, {
            //   ...params.deviceParams.deviceCommonParams,
            //   bundle: usedIndexes.map((index, arrIndex) => ({
            //     path: `${pathPrefix}/${pathSuffix.replace(
            //       '{index}',
            //       `${index}`,
            //     )}`,
            //     showOnOneKey: showOnOnekeyFn(arrIndex),
            //   })),
            // });
            // return response;
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
    // const res = await convertDeviceResponse(() =>
    //   sdk.aptosSignTransaction(connectId, deviceId, {
    //     ...deviceCommonParams,
    //     path: account.path,
    //     rawTx: '',
    //   }),
    // );
    const res = {
      signature: Buffer.from(new Array(64).fill(0)).toString('base64'),
    };
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
    console.log(deviceCommonParams, connectId, deviceId, sdk, account.path);
    // const res = await convertDeviceResponse(() =>
    //   sdk.aptosSignTransaction(connectId, deviceId, {
    //     ...deviceCommonParams,
    //     path: account.path,
    //     rawTx: '',
    //   }),
    // );
    const res = {
      signature: Buffer.from(new Array(64).fill(0)).toString('base64'),
    };
    return [res.signature];
  }
}
