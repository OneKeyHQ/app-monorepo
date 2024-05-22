/* eslint-disable @typescript-eslint/no-unused-vars */
import { BCS } from 'aptos';

import type { ISignMessageRequest } from '@onekeyhq/core/src/chains/aptos/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { buildSignedTx, generateUnsignedTransaction } from './utils';

import type VaultAptos from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.aptos.hd;

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const chainId = await this.getNetworkChainId();
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const list = await this.baseGetDeviceAccountAddresses({
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
            const response = await sdk.aptosGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams, // passpharse params
              bundle: usedIndexes.map((index, arrIndex) => {
                const i = pathSuffix.replace('{index}', `${index}`);
                return {
                  path: `${pathPrefix}/${i}`,
                  /**
                   * Search accounts not show detail at device.Only show on device when add accounts into wallet.
                   */
                  showOnOneKey: showOnOnekeyFn(arrIndex),
                  chainId: Number(chainId),
                };
              }),
            });
            return response;
          },
        });

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < list.length; i += 1) {
          const item = list[i];
          const { path, address, publicKey } = item;
          const { normalizedAddress } = await this.vault.validateAddress(
            address || '',
          );
          const addressInfo: ICoreApiGetAddressItem = {
            address: normalizedAddress || address || '',
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
    const { unsignedTx, deviceParams } = params;
    const { dbDevice, deviceCommonParams } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = checkIsDefined(dbDevice);
    const rawTxn = await generateUnsignedTransaction(
      (this.vault as VaultAptos).client,
      params.unsignedTx,
    );
    const serializer = new BCS.Serializer();
    rawTxn.serialize(serializer);
    const sdk = await this.getHardwareSDKInstance();
    const account = await this.vault.getAccount();
    const res = await convertDeviceResponse(() =>
      sdk.aptosSignTransaction(connectId, deviceId, {
        ...deviceCommonParams,
        path: account.path,
        rawTx: bufferUtils.bytesToHex(serializer.getBytes()),
      }),
    );
    const result = await buildSignedTx(
      rawTxn,
      checkIsDefined(account.pub),
      res.signature,
    );
    return {
      ...result,
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
    return Promise.all(
      messages.map(async (message) => {
        const res = await convertDeviceResponse(() => {
          const messageRequest: ISignMessageRequest = JSON.parse(
            message.message,
          );
          return sdk.aptosSignMessage(connectId, deviceId, {
            ...deviceCommonParams,
            path: account.path,
            payload: {
              message: messageRequest.message,
              address: messageRequest.address,
              application: messageRequest.application,
              chainId: messageRequest?.chainId?.toString(),
              nonce: messageRequest?.nonce?.toString(),
            },
          });
        });
        return res.signature;
      }),
    );
  }
}
