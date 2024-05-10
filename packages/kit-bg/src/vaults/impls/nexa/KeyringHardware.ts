/* eslint-disable @typescript-eslint/no-unused-vars */
import { getNexaPrefix } from '@onekeyhq/core/src/chains/nexa/sdkNexa';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

const SIGN_TYPE = 'Schnorr';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.nexa.hd;

  override prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdUtxoAccounts(params, {
      checkIsAccountUsed: () => Promise.resolve({ isUsed: true }),
      buildAddressesInfo: async ({ usedIndexes }) => {
        const chainId = await this.getNetworkChainId();
        const addressesInfo = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            showOnOnekeyFn,
          }) => {
            const paths = usedIndexes.map(
              (index) => `${pathPrefix}/${index}'/0/0`,
            );
            const bundle = paths.map((path, index) => ({
              path,
              showOnOneKey: showOnOnekeyFn(index),
              prefix: getNexaPrefix(chainId),
              scheme: SIGN_TYPE,
            }));
            const sdk = await this.getHardwareSDKInstance();
            const response = await sdk.nexaGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle,
            });
            return response;
          },
        });

        const ret = [];
        const firstAddressRelPath = '0/0';
        for (const addressInfo of addressesInfo) {
          const { address, path, pub } = addressInfo;
          const formattedPath = accountUtils.formatUtxoPath(path);
          ret.push({
            address: pub,
            publicKey: pub,
            path: formattedPath,
            relPath: firstAddressRelPath,
            xpub: '',
            addresses: { [this.networkId]: address },
          });
        }
        return ret;
      },
    });
  }

  override signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new Error('Method not implemented.');
  }
}
