/* eslint-disable @typescript-eslint/no-unused-vars */
import { validateEvent } from '@onekeyhq/core/src/chains/nostr/sdkNostr';
import type { IEncodedTxNostr } from '@onekeyhq/core/src/chains/nostr/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyHardwareError } from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

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
        const addressesInfo = await this.baseGetDeviceAccountPublicKeys({
          params,
          usedIndexes,
          sdkGetPublicKeysFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            showOnOnekeyFn,
          }) => {
            const sdk = await this.getHardwareSDKInstance();
            const response = await sdk.nostrGetPublicKey(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle: usedIndexes.map((index, arrIndex) => ({
                path: `${pathPrefix}/${index}'/0/0`,
                showOnOneKey: showOnOnekeyFn(arrIndex),
              })),
            });
            return response;
          },
        });
        const ret: ICoreApiGetAddressItem[] = [];
        for (const addressInfo of addressesInfo) {
          const { publickey, path, npub } = addressInfo;
          const item: ICoreApiGetAddressItem = {
            address: npub ?? '',
            path,
            publicKey: publickey || '',
          };
          ret.push(item);
        }
        return ret;
      },
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxNostr;
    const { event } = encodedTx;
    if (!validateEvent(event)) {
      throw new Error('Invalid event');
    }

    const sdk = await this.getHardwareSDKInstance();
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const dbAccount = await this.vault.getAccount();

    let response;
    try {
      response = await sdk.nostrSignEvent(connectId, deviceId, {
        ...params.deviceParams?.deviceCommonParams,
        path: dbAccount.path,
        // @ts-expect-error
        event,
      });
    } catch (error: any) {
      throw new OneKeyHardwareError(error);
    }

    if (!response.success) {
      throw convertDeviceError(response.payload);
    }

    const { event: signedEvent } = response.payload;
    event.sig = signedEvent.sig;

    return {
      txid: signedEvent.id ?? '',
      rawTx: JSON.stringify(event),
      encodedTx,
    };
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const sdk = await this.getHardwareSDKInstance();
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const dbAccount = await this.vault.getAccount();
    const { messages } = params;

    const result = await Promise.all(
      messages.map(async ({ message }) => {
        const response = await sdk.nostrSignSchnorr(connectId, deviceId, {
          ...params.deviceParams?.deviceCommonParams,
          path: dbAccount.path,
          hash: message,
        });
        if (!response.success) {
          throw convertDeviceError(response.payload);
        }
        return response.payload.signature;
      }),
    );
    return result;
  }

  async encrypt(params: {
    pubkey: string;
    plaintext: string;
    password: string;
    deviceParams: IDeviceSharedCallParams | undefined;
  }): Promise<string> {
    const { pubkey, plaintext } = params;
    const sdk = await this.getHardwareSDKInstance();
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const dbAccount = await this.vault.getAccount();

    let response;
    try {
      response = await sdk.nostrEncryptMessage(connectId, deviceId, {
        ...params.deviceParams?.deviceCommonParams,
        path: dbAccount.path,
        pubkey,
        plaintext,
        showOnOneKey: false,
      });
    } catch (error: any) {
      throw new OneKeyHardwareError(error);
    }

    if (!response.success) {
      throw convertDeviceError(response.payload);
    }

    return response.payload.encryptedMessage;
  }

  async decrypt(params: {
    pubkey: string;
    ciphertext: string;
    password: string;
    deviceParams: IDeviceSharedCallParams | undefined;
  }): Promise<string> {
    const { pubkey, ciphertext } = params;
    const sdk = await this.getHardwareSDKInstance();
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const dbAccount = await this.vault.getAccount();

    let response;
    try {
      response = await sdk.nostrDecryptMessage(connectId, deviceId, {
        ...params.deviceParams?.deviceCommonParams,
        path: dbAccount.path,
        pubkey,
        ciphertext,
        showOnOneKey: false,
      });
    } catch (error: any) {
      throw new OneKeyHardwareError(error);
    }

    if (!response.success) {
      throw convertDeviceError(response.payload);
    }

    return response.payload.decryptedMessage;
  }
}
