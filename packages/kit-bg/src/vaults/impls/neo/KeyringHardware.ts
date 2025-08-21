/* eslint-disable @typescript-eslint/no-unused-vars */

import * as crypto from 'crypto';

import { tx, u, wallet } from '@cityofzion/neon-core';

import type { IEncodedTxNeoN3 } from '@onekeyhq/core/src/chains/neo/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  NotImplemented,
  OneKeyHardwareError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.neo.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'neo';

  override async buildHwAllNetworkPrepareAccountsParams(
    params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    return {
      network: this.hwSdkNetwork,
      path: params.path,
      showOnOneKey: false,
    };
  }

  override prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const addressesInfo = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({ template }) => {
            const buildFullPath = (p: { index: number }) =>
              accountUtils.buildPathFromTemplate({
                template,
                index: p.index,
              });

            const allNetworkAccounts = await this.getAllNetworkPrepareAccounts({
              params,
              usedIndexes,
              hwSdkNetwork: this.hwSdkNetwork,
              buildPath: buildFullPath,
              buildResultAccount: ({ account }) => ({
                path: account.path,
                address: account.payload?.address || '',
                publicKey: account.payload?.pub || '',
              }),
            });
            if (allNetworkAccounts) {
              return allNetworkAccounts;
            }
            throw new OneKeyLocalError('use sdk allNetworkGetAddress instead');
          },
        });
        const ret: ICoreApiGetAddressItem[] = [];
        for (const addressInfo of addressesInfo) {
          const { address, path, publicKey } = addressInfo;
          if (!address) {
            throw new OneKeyHardwareError('Address is empty');
          }
          const item: ICoreApiGetAddressItem = {
            address,
            path,
            publicKey: publicKey || '',
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
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxNeoN3;
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const dbAccount = await this.vault.getAccount();

    const transaction = tx.Transaction.fromJson(encodedTx);
    const serializedTx = transaction.serialize(false);

    const magicNumber = 860_833_102;
    const sdk = await this.getHardwareSDKInstance({
      connectId,
    });
    const response = await sdk.neoSignTransaction(connectId, deviceId, {
      path: dbAccount.path,
      rawTx: serializedTx,
      magicNumber,
      ...params.deviceParams?.deviceCommonParams,
    });

    if (response.success) {
      const { signature, publicKey } = response.payload;
      const verificationScript =
        wallet.getVerificationScriptFromPublicKey(publicKey);
      transaction.addWitness(
        new tx.Witness({
          invocationScript: `0c40${signature}`,
          verificationScript,
        }),
      );
      const finalSerializedTx = transaction.serialize(true);
      return {
        txid: hexUtils.addHexPrefix(transaction.hash()),
        rawTx: Buffer.from(finalSerializedTx, 'hex').toString('base64'),
        signatureScheme: undefined,
        signature,
        publicKey,
        encodedTx: params.unsignedTx.encodedTx,
      };
    }

    throw convertDeviceError(response.payload);
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const sdk = await this.getHardwareSDKInstance({
      connectId: params.deviceParams?.dbDevice?.connectId || '',
    });
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const dbAccount = await this.vault.getAccount();
    const result = await Promise.all(
      params.messages.map(async (payload) => {
        const { hasSalt } = payload.payload;
        const randomSalt = crypto.randomBytes(16).toString('hex');
        const unsignedMessage = hasSalt
          ? randomSalt + payload.message
          : payload.message;
        const parameterHexString = Buffer.from(unsignedMessage).toString('hex');
        const lengthHex = u.num2VarInt(parameterHexString.length / 2);
        const concatenatedString = lengthHex + parameterHexString;
        const serializedTransaction = `000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000${concatenatedString}`;

        const magicNumber = 0;
        const response = await sdk.neoSignTransaction(connectId, deviceId, {
          path: dbAccount.path,
          rawTx: serializedTransaction,
          magicNumber,
          ...params.deviceParams?.deviceCommonParams,
        });

        if (!response.success) {
          throw convertDeviceError(response.payload);
        }

        const { signature, publicKey } = response.payload;
        return JSON.stringify({
          signature,
          publicKey,
          salt: hasSalt ? randomSalt : undefined,
        });
      }),
    );
    return result;
  }
}
