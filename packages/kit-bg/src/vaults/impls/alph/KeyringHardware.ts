/* eslint-disable @typescript-eslint/no-unused-vars */

import type { IEncodedTxAlph } from '@onekeyhq/core/src/chains/alph/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import {
  convertDeviceError,
  convertDeviceResponse,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import {
  deserializeUnsignedTransaction,
  serializeUnsignedTransaction,
} from './sdkAlph/utils';

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
  override coreApi = coreChainApi.alph.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'alph';

  override async buildHwAllNetworkPrepareAccountsParams(
    params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    const path = this.buildFullPath({
      index: params.index,
      template: params.template,
    });
    return {
      network: this.hwSdkNetwork,
      path,
      showOnOneKey: false,
      // @ts-expect-error
      includePublicKey: true, // TODO fix type
    };
  }

  buildFullPath = ({ index, template }: { index: number; template: string }) =>
    // const { pathPrefix, pathSuffix } = accountUtils.slicePathTemplate(template);
    `${accountUtils.buildPathFromTemplate({
      template,
      index,
    })}/0/0`;

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
            template,
            showOnOnekeyFn,
          }) => {
            const allNetworkAccounts = await this.getAllNetworkPrepareAccounts({
              params,
              usedIndexes,
              buildPath: ({ index }) =>
                this.buildFullPath({
                  index,
                  template,
                }),
              buildResultAccount: ({ account }) => ({
                path: account.path,
                address: account.payload?.address || '',
                publicKey: account.payload?.publicKey || '',
                derivedPath: account.payload?.derivedPath || '',
              }),
              hwSdkNetwork: this.hwSdkNetwork,
            });
            if (allNetworkAccounts) {
              return allNetworkAccounts;
            }

            throw new Error('use sdk allNetworkGetAddress instead');

            // const sdk = await this.getHardwareSDKInstance();
            // const bundle = usedIndexes.map((index, arrIndex) => ({
            //   path: `${pathPrefix}/${pathSuffix.replace(
            //     '{index}',
            //     `${index}`,
            //   )}/0/0`,
            //   showOnOneKey: showOnOnekeyFn(arrIndex),
            //   includePublicKey: true,
            //   group: 0,
            // }));
            // const response = await sdk.alephiumGetAddress(connectId, deviceId, {
            //   ...params.deviceParams.deviceCommonParams,
            //   bundle,
            // });
            // return response;
          },
        });

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < addresses.length; i += 1) {
          const item = addresses[i];
          const { address, publicKey, derivedPath } = item;
          const pathParts = derivedPath.split('/');
          const basePath = pathParts.slice(0, -2).join('/');
          const relPath = pathParts.slice(-2).join('/');
          const addressInfo: ICoreApiGetAddressItem = {
            address: address ?? '',
            publicKey: publicKey ?? '',
            path: basePath,
            xpub: '',
            relPath,
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
      encodedTx,
      publicKey: account.pub,
      backgroundApi: this.vault.backgroundApi,
      networkId: this.vault.networkId,
    });
    const {
      unsignedTx: { scriptOpt },
    } = await deserializeUnsignedTransaction({
      unsignedTx: rawTx,
      networkId: this.vault.networkId,
      backgroundApi: this.vault.backgroundApi,
    });
    const addressResponse = await sdk.alephiumGetAddress(connectId, deviceId, {
      ...deviceCommonParams,
      path: `${account.path}/0/0`,
      showOnOneKey: false,
      includePublicKey: true,
      group: 0,
    });
    if (!addressResponse.success) {
      throw convertDeviceError(addressResponse.payload);
    }
    const hwParams = {
      ...deviceCommonParams,
      path: addressResponse.payload.derivedPath,
      rawTx,
      scriptOpt,
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
    const addressResponse = await sdk.alephiumGetAddress(connectId, deviceId, {
      ...deviceCommonParams,
      path: `${account.path}/0/0`,
      showOnOneKey: false,
      includePublicKey: true,
      group: 0,
    });
    if (!addressResponse.success) {
      throw convertDeviceError(addressResponse.payload);
    }
    const res = await convertDeviceResponse(() =>
      sdk.alephiumSignMessage(connectId, deviceId, {
        ...deviceCommonParams,
        path: addressResponse.payload.derivedPath,
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
