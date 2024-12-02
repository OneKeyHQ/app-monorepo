/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ISignMessageRequest } from '@onekeyhq/core/src/chains/aptos/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { buildSignedTx, generateUnsignedTransaction } from './utils';

import type VaultAptos from './Vault';
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
  override coreApi = coreChainApi.aptos.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'aptos';

  override async buildHwAllNetworkPrepareAccountsParams(
    params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    return {
      network: this.hwSdkNetwork,
      path: params.path,
      showOnOneKey: false,
    };
  }

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
            template,
          }) => {
            const buildFullPath = (p: { index: number }) =>
              accountUtils.buildPathFromTemplate({
                template,
                index: p.index,
              });

            const allNetworkAccounts = await this.getAllNetworkPrepareAccounts({
              params,
              usedIndexes,
              buildPath: buildFullPath,
              buildResultAccount: ({ account }) => ({
                path: account.path,
                address: account.payload?.address || '',
                pub: account.payload?.pub || '',
              }),
              hwSdkNetwork: this.hwSdkNetwork,
            });
            if (allNetworkAccounts) {
              return allNetworkAccounts;
            }

            throw new Error('use sdk allNetworkGetAddress instead');

            // const sdk = await this.getHardwareSDKInstance();
            // const response = await sdk.aptosGetAddress(connectId, deviceId, {
            //   ...params.deviceParams.deviceCommonParams, // passpharse params
            //   bundle: usedIndexes.map((index, arrIndex) => {
            //     const i = pathSuffix.replace('{index}', `${index}`);
            //     return {
            //       path: `${pathPrefix}/${i}`,
            //       /**
            //        * Search accounts not show detail at device.Only show on device when add accounts into wallet.
            //        */
            //       showOnOneKey: showOnOnekeyFn(arrIndex),
            //       chainId: Number(chainId),
            //     };
            //   }),
            // });
            // return response;
          },
        });

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < list.length; i += 1) {
          const item = list[i];
          const { path, address, pub } = item;
          const { normalizedAddress } = await this.vault.validateAddress(
            address || '',
          );
          const addressInfo: ICoreApiGetAddressItem = {
            address: normalizedAddress || address || '',
            path,
            publicKey: pub || '',
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
    const rawTx = rawTxn.rawTransaction.bcsToHex().toStringWithoutPrefix();
    const sdk = await this.getHardwareSDKInstance();
    const account = await this.vault.getAccount();
    // TODO: support feePayerAddress、secondarySignerAddresses
    const res = await convertDeviceResponse(() =>
      sdk.aptosSignTransaction(connectId, deviceId, {
        ...deviceCommonParams,
        path: account.path,
        rawTx,
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
      messages.map(async (e) => {
        const payload = e.payload as ISignMessageRequest;
        const res = await convertDeviceResponse(() =>
          sdk.aptosSignMessage(connectId, deviceId, {
            ...deviceCommonParams,
            path: account.path,
            payload: {
              ...payload,
              chainId: payload.chainId?.toString(),
              nonce: payload.nonce.toString(),
            },
          }),
        );
        return res.signature;
      }),
    );
  }
}
