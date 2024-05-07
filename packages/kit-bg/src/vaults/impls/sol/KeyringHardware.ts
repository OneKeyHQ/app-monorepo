/* eslint-disable @typescript-eslint/no-unused-vars */
import { VersionedTransaction } from '@solana/web3.js';

import type {
  IEncodedTxSol,
  INativeTxSol,
} from '@onekeyhq/core/src/chains/sol/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { parseToNativeTx } from './utils';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { PublicKey } from '@solana/web3.js';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.sol.hd;

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const chainId = await this.getNetworkChainId();

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
            coinName,
            showOnOnekeyFn,
          }) => {
            const sdk = await this.getHardwareSDKInstance();

            const response = await sdk.solGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle: usedIndexes.map((index, arrIndex) => ({
                path: `${pathPrefix}/${pathSuffix.replace(
                  '{index}',
                  `${index}`,
                )}`,

                showOnOneKey: showOnOnekeyFn(arrIndex),
                chainId: Number(chainId),
              })),
            });
            return response;
          },
        });

        console.log('sol-buildAddressesInfo', publicKeys);

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < publicKeys.length; i += 1) {
          const item = publicKeys[i];
          const { path, address } = item;
          const { normalizedAddress } = await this.vault.validateAddress(
            address || '',
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
    const { feePayer } = unsignedTx.payload as {
      nativeTx: INativeTxSol;
      feePayer: PublicKey;
    };

    const encodedTx = unsignedTx.encodedTx as IEncodedTxSol;

    const sdk = await this.getHardwareSDKInstance();
    const path = await this.vault.getAccountPath();
    const { deviceCommonParams, dbDevice } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = dbDevice;

    const transaction = await parseToNativeTx(encodedTx);

    if (!transaction) {
      throw new Error('Failed to parse transaction');
    }

    const isVersionedTransaction = transaction instanceof VersionedTransaction;

    const result = await convertDeviceResponse(async () =>
      sdk.solSignTransaction(connectId, deviceId, {
        path,
        rawTx: isVersionedTransaction
          ? Buffer.from(transaction.message.serialize()).toString('hex')
          : transaction.serializeMessage().toString('hex'),
        ...deviceCommonParams,
      }),
    );

    const { signature } = result;
    if (signature) {
      transaction.addSignature(feePayer, Buffer.from(signature, 'hex'));
      return {
        txid: signature,
        encodedTx,
        rawTx: Buffer.from(
          transaction.serialize({ requireAllSignatures: false }),
        ).toString('base64'),
      };
    }

    throw new Error('Failed to sign transaction');
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new NotImplemented('Signing Solana message is not supported yet.');
  }
}
