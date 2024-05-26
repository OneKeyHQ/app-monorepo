/* eslint-disable @typescript-eslint/no-unused-vars */
import { blockchain } from '@ckb-lumos/base';
import {
  createTransactionFromSkeleton,
  sealTransaction,
} from '@ckb-lumos/helpers';
import { bytesToHex } from '@noble/hashes/utils';

import type { IEncodedTxCkb } from '@onekeyhq/core/src/chains/ckb/types';
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
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { getConfig } from './utils/config';
import { serializeTransactionMessage } from './utils/transaction';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.ckb.hd;

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const config = getConfig(await this.getNetworkChainId());
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

            const response = await sdk.nervosGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle: usedIndexes.map((index, arrIndex) => ({
                path: `${pathPrefix}/${pathSuffix.replace(
                  '{index}',
                  `${index}`,
                )}`,
                showOnOneKey: showOnOnekeyFn(arrIndex),
                network: config.PREFIX,
              })),
            });
            return response;
          },
        });

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < nearAddresses.length; i += 1) {
          const item = nearAddresses[i];
          const { path, address } = item;
          const { normalizedAddress } = await this.vault.validateAddress(
            address ?? '',
          );
          const addressInfo: ICoreApiGetAddressItem = {
            address: normalizedAddress || address || '',
            path,
            publicKey: '',
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
    const encodedTx = unsignedTx.encodedTx as IEncodedTxCkb;
    const sdk = await this.getHardwareSDKInstance();
    const path = await this.vault.getAccountPath();
    const { deviceCommonParams, dbDevice } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = dbDevice;

    const chainId = await this.getNetworkChainId();
    const config = getConfig(chainId);

    const { txSkeleton: txSkeletonWithMessage } =
      serializeTransactionMessage(encodedTx);

    const witnessHex = encodedTx.witnesses.get(0);
    if (!witnessHex) {
      throw new OneKeyInternalError('Transaction serialization failure');
    }

    const transaction = createTransactionFromSkeleton(encodedTx);

    const serialize = blockchain.RawTransaction.pack(transaction);

    const result = await convertDeviceResponse(async () =>
      sdk.nervosSignTransaction(connectId, deviceId, {
        path,
        network: config.PREFIX,
        rawTx: bytesToHex(serialize),
        witnessHex,
        ...deviceCommonParams,
      }),
    );

    const { signature } = result;

    const tx = sealTransaction(txSkeletonWithMessage, [
      hexUtils.addHexPrefix(signature),
    ]);

    const rawTx = bytesToHex(blockchain.Transaction.pack(tx));

    return {
      txid: '',
      rawTx,
      encodedTx: '',
    };
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new NotImplemented();
  }
}
