/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';

import type { IEncodedTxDnx } from '@onekeyhq/core/src/chains/dnx/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { cnFastHash, serializeTransaction } from './utils';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.dnx.hd;

  override prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const nearAddresses = await this.baseGetDeviceAccountAddresses({
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

            const response = await sdk.dnxGetAddress(connectId, deviceId, {
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
        const addressRelPath = '0/0';
        for (let i = 0; i < nearAddresses.length; i += 1) {
          const item = nearAddresses[i];
          const { path, address } = item;
          const addressInfo: ICoreApiGetAddressItem = {
            address: address ?? '',
            publicKey: '',
            path,
            relPath: addressRelPath,
            xpub: '',
            addresses: {
              [addressRelPath]: address ?? '',
            },
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
    const network = await this.getNetwork();
    const encodedTx = unsignedTx.encodedTx as IEncodedTxDnx;
    const sdk = await this.getHardwareSDKInstance();
    const path = await this.vault.getAccountPath();
    const { deviceCommonParams, dbDevice } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = dbDevice;

    const signTxParams = {
      path,
      inputs: encodedTx.inputs,
      toAddress: encodedTx.to,
      amount: new BigNumber(encodedTx.amount)
        .shiftedBy(network.decimals)
        .toFixed(),
      fee: new BigNumber(encodedTx.fee)
        .shiftedBy(network.feeMeta.decimals)
        .toFixed(),
      paymentIdHex: encodedTx.paymentId,
    };

    const result = await convertDeviceResponse(async () =>
      sdk.dnxSignTransaction(connectId, deviceId, {
        ...signTxParams,
        ...deviceCommonParams,
      }),
    );

    const rawTx = serializeTransaction({
      encodedTx,
      signTxParams,
      payload: result,
    });

    return {
      txid: hexUtils.stripHexPrefix(cnFastHash(rawTx)),
      rawTx,
      encodedTx: unsignedTx.encodedTx,
    };
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new Error('Method not implemented.');
  }
}
