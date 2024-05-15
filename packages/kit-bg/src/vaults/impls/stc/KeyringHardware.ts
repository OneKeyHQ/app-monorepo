/* eslint-disable @typescript-eslint/no-unused-vars */
import { arrayify } from '@ethersproject/bytes';
import { starcoin_types as StarcoinTypes, utils } from '@starcoin/starcoin';

import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyHardwareError } from '@onekeyhq/shared/src/errors';
import {
  convertDeviceError,
  convertDeviceResponse,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { buildSignedTx, buildUnsignedRawTx } from './utils';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.stc.hd;

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

            const response = await sdk.starcoinGetAddress(connectId, deviceId, {
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
        for (let i = 0; i < addresses.length; i += 1) {
          const item = addresses[i];
          const { path, address } = item;
          const addressInfo: ICoreApiGetAddressItem = {
            address: address || '',
            path,
            publicKey: '',
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
    const { senderPublicKey } = unsignedTx.payload ?? {};

    if (!senderPublicKey) {
      throw new OneKeyHardwareError(Error('senderPublicKey is required'));
    }

    const chainId = await this.getNetworkChainId();
    const sdk = await this.getHardwareSDKInstance();
    const path = await this.vault.getAccountPath();
    const { deviceCommonParams, dbDevice } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = dbDevice;

    const [rawTxn, rawUserTransactionBytes] = buildUnsignedRawTx(
      unsignedTx,
      chainId,
    );

    const result = await convertDeviceResponse(async () =>
      sdk.starcoinSignTransaction(connectId, deviceId, {
        path,
        rawTx: Buffer.from(rawUserTransactionBytes).toString('hex'),
        ...deviceCommonParams,
      }),
    );

    const { signature } = result;

    return buildSignedTx(
      senderPublicKey,
      Buffer.from(signature, 'hex'),
      rawTxn,
      unsignedTx.encodedTx,
    );
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const { messages, deviceParams } = params;

    const { dbDevice, deviceCommonParams } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = dbDevice;

    const sdk = await this.getHardwareSDKInstance();
    const path = await this.vault.getAccountPath();
    const chainId = await this.getNetworkChainId();

    return Promise.all(
      messages.map(async (message) => {
        let response;
        const { type, message: messageHex } = message;
        try {
          response = await sdk.starcoinSignMessage(connectId, deviceId, {
            path,
            messageHex,
            ...deviceCommonParams,
          });
        } catch (error: any) {
          console.log(error);
          throw new OneKeyHardwareError(error);
        }

        if (!response.success) {
          console.log(response.payload);
          throw convertDeviceError(response.payload);
        }
        // eslint-disable-next-line camelcase
        const { public_key, signature } = response.payload;
        if (type === 1) {
          // personal sign
          const msgBytes = arrayify(messageHex);
          const signingMessage = new StarcoinTypes.SigningMessage(msgBytes);
          const signedMessageHex =
            await utils.signedMessage.generateSignedMessage(
              signingMessage,
              parseInt(chainId),
              public_key,
              signature,
            );
          return signedMessageHex;
        }
        return signature;
      }),
    );
  }
}
