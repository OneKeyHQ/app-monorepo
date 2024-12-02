import { toSerializedSignature } from '@benfen/bfc.js/cryptography';
import { Ed25519PublicKey } from '@benfen/bfc.js/keypairs/ed25519';
import { toB64 } from '@benfen/bfc.js/utils';

import { handleSignData } from '@onekeyhq/core/src/chains/bfc/CoreChainSoftware';
import type { IEncodedTxBfc } from '@onekeyhq/core/src/chains/bfc/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyHardwareError } from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import transactionUtils from './sdkBfc/transactions';
import { toTransaction } from './sdkBfc/utils';

import type IVaultBfc from './Vault';
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
  override coreApi = coreChainApi.bfc.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'benfen';

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
            throw new Error('use sdk allNetworkGetAddress instead');

            // const sdk = await this.getHardwareSDKInstance();
            // paths.push(
            //   ...usedIndexes.map((index) => `${pathPrefix}/${index}'/0'/0'`),
            // );
            // const response = await sdk.benfenGetAddress(connectId, deviceId, {
            //   ...params.deviceParams.deviceCommonParams,
            //   bundle: paths.map((path, arrIndex) => ({
            //     path,
            //     showOnOneKey: showOnOnekeyFn(arrIndex),
            //   })),
            // });

            // return response;
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
    const sdk = await this.getHardwareSDKInstance();
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxBfc;
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const dbAccount = await this.vault.getAccount();
    const senderPublicKey = checkIsDefined(dbAccount.pub);

    const client = await (this.vault as IVaultBfc).getClient();
    const initialTransaction = await toTransaction(
      client,
      encodedTx.sender,
      encodedTx,
    );
    const coinType = await transactionUtils.getCoinTypeForHardwareTransfer({
      client,
      txBytes: initialTransaction,
    });
    const signData = handleSignData(initialTransaction);

    const response = await sdk.benfenSignTransaction(connectId, deviceId, {
      path: dbAccount.path,
      rawTx: hexUtils.hexlify(Buffer.from(signData)),
      coinType: coinType ?? undefined,
      ...params.deviceParams?.deviceCommonParams,
    });

    if (response.success) {
      const { signature } = response.payload;

      const serializeSignature = toSerializedSignature({
        signatureScheme: 'ED25519',
        signature: bufferUtils.hexToBytes(signature),
        publicKey: new Ed25519PublicKey(
          bufferUtils.hexToBytes(senderPublicKey),
        ),
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
        const response = await HardwareSDK.benfenSignMessage(
          connectId,
          deviceId,
          {
            ...params.deviceParams?.deviceCommonParams,
            messageHex: hexUtils.hexlify(
              bufferUtils.hexToBytes(payload.message),
            ),
            path: dbAccount.path,
          },
        );
        if (!response.success) {
          throw convertDeviceError(response.payload);
        }
        return toSerializedSignature({
          signatureScheme: 'ED25519',
          signature: bufferUtils.hexToBytes(response.payload.signature),
          publicKey: new Ed25519PublicKey(
            bufferUtils.hexToBytes(checkIsDefined(dbAccount.pub)),
          ),
        });
      }),
    );
    return result;
  }
}
