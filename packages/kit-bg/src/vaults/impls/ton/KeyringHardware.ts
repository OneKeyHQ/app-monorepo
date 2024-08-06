/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  genAddressFromPublicKey,
  getStateInitFromEncodedTx,
  serializeSignedTx,
} from '@onekeyhq/core/src/chains/ton/sdkTon';
import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import {
  getAccountVersion,
  serializeUnsignedTransaction,
} from './sdkTon/utils';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.ton.hd;

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const { deriveInfo } = params;
    // const chainId = await this.getNetworkChainId();

    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const publicKeys = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            pathSuffix,
            showOnOnekeyFn,
          }) => {
            // const sdk = await this.getHardwareSDKInstance();

            // const response = await sdk.aptosGetAddress(connectId, deviceId, {
            //   ...params.deviceParams.deviceCommonParams,
            //   bundle: usedIndexes.map((index, arrIndex) => ({
            //     path: `${pathPrefix}/${pathSuffix.replace(
            //       '{index}',
            //       `${index}`,
            //     )}`,
            //     showOnOneKey: showOnOnekeyFn(arrIndex),
            //     chainId: Number(chainId),
            //   })),
            // });
            // return response;

            console.log('ton-getAddress', { connectId, deviceId });
            return {
              'event': 'RESPONSE_EVENT',
              'type': 'RESPONSE_EVENT',
              'id': 3,
              'success': true,
              'payload': [
                {
                  'path': "m/44'/607'/0'/0'/0'/0'",
                  'publicKey':
                    '899f2de9fb2472a17520575be94b2e6754bea1de95f0a79e5dfe9008c5898c2e',
                  'address': 'UQDuFJXD0qeh7XRgHIIshHVH7uh-IeF9v_f8Id4LqwoTXffI',
                },
              ],
            };
          },
        });

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < publicKeys.length; i += 1) {
          const item = publicKeys[i];
          const { path, publicKey } = item;
          const addr = await genAddressFromPublicKey(
            publicKey,
            deriveInfo.addressEncoding as 'v4R2',
          );
          const addressInfo: ICoreApiGetAddressItem = {
            address: addr.nonBounceAddress,
            path,
            publicKey: publicKey || '',
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
    const sdk = await this.getHardwareSDKInstance();
    const account = await this.vault.getAccount();
    const { unsignedTx, deviceParams } = params;
    const { dbDevice, deviceCommonParams } = checkIsDefined(deviceParams);
    const encodedTx = unsignedTx.encodedTx as IEncodedTxTon;
    const version = getAccountVersion(account.id);
    const serializeUnsignedTx = await serializeUnsignedTransaction({
      version,
      encodedTx,
      backgroundApi: this.vault.backgroundApi,
    });
    const unsignedRawTx = hexUtils.hexlify(
      await serializeUnsignedTx.signingMessage.toBoc(),
      {
        noPrefix: true,
      },
    );
    // const result = await convertDeviceResponse(async () => {
    //   const res = await sdk.cosmosSignTransaction(
    //     dbDevice.connectId,
    //     dbDevice.deviceId,
    //     {
    //       path: account.path,
    //       rawTx: unsignedRawTx,
    //       ...deviceCommonParams,
    //     },
    //   );
    //   return res;
    // });
    const result = {
      signature:
        '0000000000000000000000000000000000000000000000000000000000000000',
    };
    const signedTx = serializeSignedTx({
      fromAddress: encodedTx.fromAddress,
      signingMessage: serializeUnsignedTx.signingMessage,
      signature: bufferUtils.hexToBytes(result.signature),
      stateInit: getStateInitFromEncodedTx(encodedTx),
    });
    return {
      txid: '',
      rawTx: Buffer.from(await signedTx.toBoc()).toString('base64'),
      encodedTx,
    };
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new NotImplemented();
  }
}
