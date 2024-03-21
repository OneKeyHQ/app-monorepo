import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { IMPL_BTC } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHdBase } from '../../base/KeyringHdBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.lightning.hd;

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<IDBAccount[]> {
    const networkInfo = await this.getCoreApiNetworkInfo();
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const { password, deriveInfo } = params;
        const { template } = deriveInfo;
        const credentials = await this.baseGetCredentialsInfo({ password });
        if (!this.coreApi) {
          throw new Error('coreApi is undefined');
        }
        const { addresses: addressesInfo } =
          await this.coreApi.getAddressesFromHd({
            networkInfo,
            template,
            hdCredential: checkIsDefined(credentials.hd),
            password,
            indexes: usedIndexes,
          });

        if (addressesInfo.length !== usedIndexes.length) {
          throw new OneKeyInternalError('Unable to get address');
        }
        return addressesInfo;
      },
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    return this.baseSignTransaction(params);
  }

  override async signMessage(params: ISignMessageParams): Promise<string[]> {
    // throw new Error('Method not implemented.');
    return this.baseSignMessage(params);
  }
}
