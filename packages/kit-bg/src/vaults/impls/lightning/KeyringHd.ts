import { sha256 } from '@noble/hashes/sha256';

import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

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
    const { password } = params;
    const networkInfo = await this.getCoreApiNetworkInfo();
    const isTestnet = !!networkInfo.isTestnet;
    const credentials = await this.baseGetCredentialsInfo({ password });
    const nativeSegwitAccounts = await this.basePrepareHdNormalAccounts(
      params,
      {
        buildAddressesInfo: async ({ usedIndexes }) => {
          const { deriveInfo } = params;
          const { template } = deriveInfo;
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
      },
    );

    console.log('nativeSegwitAccounts', nativeSegwitAccounts);

    const client = await this.backgroundApi.serviceLightning.getLnClient(
      isTestnet,
    );
    for (const account of nativeSegwitAccounts) {
      if (!account.address) {
        throw new OneKeyInternalError('No address');
      }
      const accountExist = await client.checkAccountExist(account.address);
      if (!accountExist) {
        const hashPubKey = bufferUtils.bytesToHex(sha256(account.pub));
        const signTemplate = await client.fetchSignTemplate(
          account.address,
          'register',
        );
        if (signTemplate.type !== 'register') {
          throw new Error('Wrong signature type');
        }

        const signature = await this.coreApi.signApiMessage({
          msgPayload: {
            ...signTemplate,
            pubkey: hashPubKey,
            address: account.address,
          },
          password,
          hdCredential: checkIsDefined(credentials.hd),
          address: account.address,
          path: account.path,
          isTestnet,
        });

        await client.createUser({
          hashPubKey,
          address: account.address,
          signature,
          randomSeed: signTemplate.randomSeed,
        });
      }
    }

    // replace id & path
    const accounts = nativeSegwitAccounts.map((account) => ({
      ...account,
      id: accountUtils.buildLightningAccountId({
        accountId: account.id,
        isTestnet,
      }),
      path: accountUtils.buildBtcToLnPath({
        path: account.path,
        isTestnet,
      }),
    }));

    return accounts;
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
