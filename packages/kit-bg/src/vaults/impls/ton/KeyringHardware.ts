/* eslint-disable @typescript-eslint/no-unused-vars */
import { TonWalletVersion } from '@onekeyfe/hd-transport';
import TonWeb from 'tonweb';

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
import {
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

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
import type { CommonParams, TonSignMessageParams } from '@onekeyfe/hd-core';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.ton.hd;

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const { deriveInfo } = params;
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
            const sdk = await this.getHardwareSDKInstance();

            const response = await sdk.tonGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle: usedIndexes.map((index, arrIndex) => ({
                path: `${pathPrefix}/${pathSuffix.replace(
                  '{index}',
                  `${index}`,
                )}`,
                showOnOneKey: showOnOnekeyFn(arrIndex),
                walletVersion: TonWalletVersion.V4R2,
                isBounceable: false,
                isTestnetOnly: false,
              })),
            });
            return response;
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
            address: addr.normalAddress,
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
    if (encodedTx.messages.length !== 1) {
      throw new OneKeyInternalError('Unsupported message count');
    }
    const msg = encodedTx.messages[0];
    const versionMap = {
      [TonWeb.Wallets.all.v4R2.name]: TonWalletVersion.V4R2,
    };
    const hwParams: CommonParams & TonSignMessageParams = {
      path: account.path,
      ...deviceCommonParams,
      destination: msg.toAddress,
      tonAmount: Number(msg.amount.toString()),
      seqno: encodedTx.sequenceNo,
      expireAt: encodedTx.expireAt || 0,
      comment: msg.payload,
      mode: msg.sendMode,
      walletVersion: versionMap[version],
    };
    if (msg.jetton?.amount) {
      hwParams.jettonAmount = Number(msg.jetton.amount);
      hwParams.jettonMasterAddress = msg.jetton.jettonMasterAddress;
      hwParams.fwdFee = Number(msg.jetton.fwdFee);
      hwParams.comment = undefined;
    }
    const result = await convertDeviceResponse(async () => {
      const res = await sdk.tonSignMessage(
        dbDevice.connectId,
        dbDevice.deviceId,
        hwParams,
      );
      return res;
    });
    if (!result.signature) {
      throw new OneKeyInternalError('Failed to sign message');
    }
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
