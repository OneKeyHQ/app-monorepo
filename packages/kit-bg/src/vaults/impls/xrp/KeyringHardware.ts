/* eslint-disable @typescript-eslint/no-unused-vars */
import { hashes } from 'xrpl';

import type { IEncodedTxXrp } from '@onekeyhq/core/src/chains/xrp/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  NotImplemented,
  UnknownHardwareError,
} from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

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
  override coreApi = coreChainApi.xrp.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'xrp';

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
                publicKey: account.payload?.publicKey || '',
              }),
              hwSdkNetwork: this.hwSdkNetwork,
            });
            if (allNetworkAccounts) {
              return allNetworkAccounts;
            }

            throw new Error('use sdk allNetworkGetAddress instead');

            // const sdk = await this.getHardwareSDKInstance();
            // const response = await sdk.xrpGetAddress(connectId, deviceId, {
            //   ...params.deviceParams.deviceCommonParams,
            //   bundle: usedIndexes.map((index, arrIndex) => ({
            //     path: `${pathPrefix}/${index}'/0/0`,
            //     showOnOneKey: showOnOnekeyFn(arrIndex),
            //   })),
            // });
            // return response;
          },
        });
        const ret: ICoreApiGetAddressItem[] = [];
        for (const addressInfo of addressesInfo) {
          const { address, path, publicKey } = addressInfo;
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
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxXrp;
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const dbAccount = await this.vault.getAccount();
    const signTransactionParams = {
      path: dbAccount.path,
      transaction: {
        fee: encodedTx.Fee,
        flags: encodedTx.Flags,
        sequence: encodedTx.Sequence,
        maxLedgerVersion: encodedTx.LastLedgerSequence,
        payment: {
          amount: +encodedTx.Amount,
          destination: encodedTx.Destination,
          destinationTag: encodedTx.DestinationTag ?? undefined,
        },
      },
    };

    const response = await sdk.xrpSignTransaction(connectId, deviceId, {
      ...params.deviceParams?.deviceCommonParams,
      ...(signTransactionParams as unknown as any),
    });

    if (response.success) {
      const { serializedTx } = response.payload;
      if (!serializedTx) {
        throw new UnknownHardwareError();
      }
      return {
        txid: hashes.hashSignedTx(serializedTx),
        rawTx: serializedTx,
        encodedTx,
      };
    }

    throw convertDeviceError(response.payload);
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new NotImplemented();
  }
}
