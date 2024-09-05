/* eslint-disable @typescript-eslint/no-unused-vars */
import type { IEncodedTxAlph } from '@onekeyhq/core/src/chains/alph/types';
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

import { serializeUnsignedTransaction } from './sdkAlph/utils';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.alph.hd;

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
            const response = await sdk.alephiumGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle: usedIndexes.map((index, arrIndex) => ({
                path: `${pathPrefix}/${pathSuffix.replace(
                  '{index}',
                  `${index}`,
                )}`,
                showOnOneKey: showOnOnekeyFn(arrIndex),
                includePublicKey: true,
              })),
            });
            return response;
          },
        });

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < addresses.length; i += 1) {
          const item = addresses[i];
          const { path, address, publicKey } = item;
          const addressInfo: ICoreApiGetAddressItem = {
            address: address ?? '',
            publicKey: publicKey ?? '',
            path,
            xpub: '',
            addresses: {},
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
    const encodedTx = unsignedTx.encodedTx as IEncodedTxAlph;
    if (!account.pub) {
      throw new OneKeyInternalError('Account pub not found');
    }
    const { unsignedTx: rawTx } = await serializeUnsignedTransaction({
      tx: encodedTx,
      publicKey: account.pub,
      backgroundApi: this.vault.backgroundApi,
      networkId: this.vault.networkId,
    });
    const hwParams = {
      ...deviceCommonParams,
      path: account.path,
      rawTx,
    };
    const res = await convertDeviceResponse(() =>
      sdk.alephiumSignTransaction(connectId, deviceId, hwParams),
    );
    if (!res.signature) {
      throw new OneKeyInternalError('Failed to sign transaction');
    }
    return {
      txid: '',
      rawTx: JSON.stringify({
        unsignedTx: rawTx,
        signature: res.signature,
      }),
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
    const messageHex = Buffer.from(messages[0].message).toString('hex');
    const res = await convertDeviceResponse(() =>
      sdk.alephiumSignMessage(connectId, deviceId, {
        ...deviceCommonParams,
        path: account.path,
        messageHex,
        messageType: messages[0].type as any,
      }),
    );
    if (!res.signature) {
      throw new OneKeyInternalError('Failed to sign message');
    }
    return [res.signature];
  }
}
