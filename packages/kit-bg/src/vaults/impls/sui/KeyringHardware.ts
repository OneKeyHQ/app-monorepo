import { toSerializedSignature } from '@mysten/sui/cryptography';
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { toBase64 } from '@mysten/sui/utils';

import { handleSignData } from '@onekeyhq/core/src/chains/sui/CoreChainSoftware';
import type { IEncodedTxSui } from '@onekeyhq/core/src/chains/sui/types';
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
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { toTransaction } from './sdkSui/utils';

import type IVaultSui from './Vault';
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
  override coreApi = coreChainApi.sui.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'sui';

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
        const paths: string[] = [];
        const addressesInfo = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            template,
            showOnOnekeyFn,
          }) => {
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
              buildResultAccount: ({ account, index }) => ({
                path: account.path,
                address: account.payload?.address || '',
                publicKey: account.payload?.publicKey || '',
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
            // const response = await sdk.suiGetAddress(connectId, deviceId, {
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
            address: hexUtils.addHexPrefix(address),
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
    const signData = handleSignData(initialTransaction);

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
        publicKey: new Ed25519PublicKey(
          bufferUtils.hexToBytes(senderPublicKey),
        ),
      });

      return {
        txid: '',
        rawTx: toBase64(initialTransaction),
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
          publicKey: new Ed25519PublicKey(
            bufferUtils.hexToBytes(checkIsDefined(dbAccount.pub)),
          ),
        });
      }),
    );
    return result;
  }
}
