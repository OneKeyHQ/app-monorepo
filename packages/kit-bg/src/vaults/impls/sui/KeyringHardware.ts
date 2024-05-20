import { Ed25519PublicKey, toB64, toSerializedSignature } from '@mysten/sui.js';

import { handleSignData } from '@onekeyhq/core/src/chains/sui/CoreChainSoftware';
import type { IEncodedTxSui } from '@onekeyhq/core/src/chains/sui/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  OneKeyHardwareError,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { toTransaction } from './sdkSui/utils';

import type IVaultSui from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.sui.hd;

  async getPublicKey(
    connectId: string,
    deviceId: string,
    paths: Array<string>,
    deviceParams: IDeviceSharedCallParams,
  ): Promise<Array<string>> {
    let response;
    const sdk = await this.getHardwareSDKInstance();
    try {
      response = await sdk.suiGetPublicKey(connectId, deviceId, {
        bundle: paths.map((path) => ({ path })),
        ...deviceParams.deviceCommonParams,
      });
    } catch (error: any) {
      console.log(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success) {
      console.error(response.payload);
      throw convertDeviceError(response.payload);
    }

    const pubKeys = response.payload
      .map((result) => result.publicKey)
      .filter((item: string | undefined): item is string => !!item);

    return pubKeys;
  }

  override prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const paths: string[] = [];
        const addressesInfo = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            showOnOnekeyFn,
          }) => {
            const sdk = await this.getHardwareSDKInstance();
            paths.push(
              ...usedIndexes.map((index) => `${pathPrefix}/${index}'/0'/0'`),
            );
            const response = await sdk.suiGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle: paths.map((path, arrIndex) => ({
                path,
                showOnOneKey: showOnOnekeyFn(arrIndex),
              })),
            });

            return response;
          },
        });

        const includePublicKey = addressesInfo.every(
          (item) => !!item.publicKey,
        );
        let publicKeys: string[] = [];
        const { dbDevice } = params.deviceParams;
        const { connectId, deviceId } = dbDevice;
        if (!includePublicKey) {
          publicKeys = await this.getPublicKey(
            connectId,
            deviceId,
            paths,
            params.deviceParams,
          );
        }

        const ret: ICoreApiGetAddressItem[] = [];
        const index = 0;
        for (const addressInfo of addressesInfo) {
          const { address, path, publicKey } = addressInfo;
          if (!address) {
            throw new OneKeyHardwareError('Address is empty');
          }
          const item: ICoreApiGetAddressItem = {
            address: hexUtils.addHexPrefix(address),
            path,
            publicKey: publicKey || publicKeys[index] || '',
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
    const sdk = await this.getHardwareSDKInstance();
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxSui;
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const dbAccount = await this.vault.getAccount();
    const senderPublicKey = checkIsDefined(dbAccount.pub);

    const client = await (this.vault as IVaultSui).getClient();
    const initialTransaction = await toTransaction(
      client,
      encodedTx.sender,
      encodedTx,
    );
    const signData = handleSignData(initialTransaction, true);

    const response = await sdk.suiSignTransaction(connectId, deviceId, {
      path: dbAccount.path,
      rawTx: hexUtils.hexlify(Buffer.from(signData)),
      ...params.deviceParams?.deviceCommonParams,
    });

    if (response.success) {
      const { signature } = response.payload;

      const serializeSignature = toSerializedSignature({
        signatureScheme: 'ED25519',
        signature: bufferUtils.hexToBytes(signature),
        pubKey: new Ed25519PublicKey(senderPublicKey),
      });

      return {
        txid: '',
        rawTx: toB64(initialTransaction),
        signatureScheme: 'ed25519',
        signature: serializeSignature,
        publicKey: hexUtils.addHexPrefix(senderPublicKey),
        encodedTx: params.unsignedTx.encodedTx,
      };
    }

    throw convertDeviceError(response.payload);
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const dbAccount = await this.vault.getAccount();
    const result = await Promise.all(
      params.messages.map(async (payload) => {
        const response = await HardwareSDK.suiSignMessage(connectId, deviceId, {
          ...params.deviceParams?.deviceCommonParams,
          messageHex: hexUtils.hexlify(bufferUtils.hexToBytes(payload.message)),
          path: dbAccount.path,
        });
        if (!response.success) {
          throw convertDeviceError(response.payload);
        }
        return toSerializedSignature({
          signatureScheme: 'ED25519',
          signature: bufferUtils.hexToBytes(response.payload.signature),
          pubKey: new Ed25519PublicKey(
            bufferUtils.hexToBytes(checkIsDefined(dbAccount.pub)),
          ),
        });
      }),
    );
    return result.map((ret) => JSON.stringify(ret));
  }
}
