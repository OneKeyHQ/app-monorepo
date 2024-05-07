import { sha256 } from '@noble/hashes/sha256';

import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type {
  IEncodedTxLightning,
  ISignApiMessageParams,
} from '@onekeyhq/shared/types/lightning';

import { KeyringHdBase } from '../../base/KeyringHdBase';

import type ILightningVault from './Vault';
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

        const signature = await this.signApiMessage({
          msgPayload: {
            ...signTemplate,
            pubkey: hashPubKey,
            address: account.address,
          },
          password,
          address: account.address,
          path: account.path,
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
    const { password, unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxLightning;
    const dbAccount = await this.vault.getAccount();
    const { invoice, expired, created, paymentHash, amount } = encodedTx;
    const client = await (this.vault as ILightningVault).getClient();
    const signTemplate = await client.fetchSignTemplate(
      dbAccount.addressDetail.normalizedAddress,
      'transfer',
    );
    if (signTemplate.type !== 'transfer') {
      throw new Error('Wrong transfer signature type');
    }
    const network = await this.getNetwork();
    const signature = await this.signApiMessage({
      msgPayload: {
        ...signTemplate,
        paymentHash,
        paymentRequest: invoice,
        expired,
        created: Number(created),
        nonce: signTemplate.nonce,
        randomSeed: signTemplate.randomSeed,
      },
      password,
      address: dbAccount.addressDetail.normalizedAddress,
      path: accountUtils.buildLnToBtcPath({
        path: dbAccount.path,
        isTestnet: network.isTestnet,
      }),
    });

    if (
      !signature ||
      typeof signTemplate.nonce !== 'number' ||
      typeof signTemplate.randomSeed !== 'number'
    ) {
      throw new OneKeyInternalError('Invalid signature');
    }
    const sign = await client.getAuthorization({
      accountId: dbAccount.id,
      networkId: network.id,
    });

    const rawTx = {
      amount,
      created: Number(created),
      expired,
      nonce: signTemplate.nonce,
      paymentHash,
      paymentRequest: invoice,
      randomSeed: signTemplate.randomSeed,
      sign,
      signature,
      testnet: network.isTestnet,
    };

    return {
      txid: paymentHash,
      rawTx: JSON.stringify(rawTx),
      nonce: signTemplate.nonce,
      randomSeed: signTemplate.randomSeed,
      encodedTx,
    };
  }

  override async signMessage(params: ISignMessageParams): Promise<string[]> {
    // throw new Error('Method not implemented.');
    return this.baseSignMessage(params);
  }

  async signApiMessage(params: ISignApiMessageParams) {
    const { password, msgPayload, address, path } = params;
    if (!password) {
      throw new OneKeyInternalError('Password is required');
    }
    const credentials = await this.baseGetCredentialsInfo({
      password,
    });
    const { isTestnet } = await this.getNetwork();
    return this.coreApi.signApiMessage({
      msgPayload,
      password,
      address,
      path,
      hdCredential: checkIsDefined(credentials.hd),
      isTestnet,
    });
  }
}
