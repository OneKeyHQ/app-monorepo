/* eslint-disable @typescript-eslint/no-unused-vars */
import { hashes } from 'xrpl';

import type { IEncodedTxXrp } from '@onekeyhq/core/src/chains/xrp/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { UnknownHardwareError } from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.xrp.hd;

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
            showOnOnekeyFn,
          }) => {
            const sdk = await this.getHardwareSDKInstance();
            const response = await sdk.xrpGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle: usedIndexes.map((index, arrIndex) => ({
                path: `${pathPrefix}/${index}'/0/0`,
                showOnOneKey: showOnOnekeyFn(arrIndex),
              })),
            });
            return response;
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
    throw new Error('Method not implemented.');
  }
}
