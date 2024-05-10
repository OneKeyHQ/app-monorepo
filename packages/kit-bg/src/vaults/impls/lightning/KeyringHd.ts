import { sha256 } from '@noble/hashes/sha256';

import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type {
  IEncodedTxLightning,
  ILnurlAuthParams,
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
    const { password, messages } = params;
    const account = await this.vault.getAccount();

    const credentials = await this.baseGetCredentialsInfo(params);
    const network = await this.getNetwork();

    const btcPath = accountUtils.buildLnToBtcPath({
      path: account.path,
      isTestnet: network.isTestnet,
    });
    const btcImpl = network.isTestnet ? IMPL_TBTC : IMPL_BTC;
    const btcNetworkId = network.isTestnet
      ? getNetworkIdsMap().tbtc
      : getNetworkIdsMap().btc;
    const networkInfo = {
      isTestnet: network.isTestnet,
      networkChainCode: btcImpl,
      chainId: '0',
      networkId: btcNetworkId,
      networkImpl: btcImpl,
      addressPrefix: '',
      curve: 'secp256k1',
    };
    const accountAddress = account.addressDetail.normalizedAddress;
    const result = await Promise.all(
      messages.map(async (msg) => {
        const signature = await coreChainApi.btc.hd.signMessage({
          networkInfo: {
            isTestnet: networkInfo.isTestnet,
            networkChainCode: IMPL_BTC,
            chainId: '',
            networkId: getNetworkIdsMap().btc,
            networkImpl: IMPL_BTC,
            addressPrefix: '',
            curve: 'secp256k1',
          },
          unsignedMsg: {
            ...msg,
            // @ts-expect-error
            sigOptions: { segwitType: 'p2wpkh' },
          },
          account: {
            ...account,
            address: accountAddress,
            path: btcPath,
            relPaths: ['0/0'],
          },
          password,
          credentials,
          btcExtraInfo: {
            pathToAddresses: {
              [`${btcPath}/0/0`]: {
                address: accountAddress,
                relPath: '0/0',
              },
            },
          },
        });
        return { message: msg.message, signature };
      }),
    );
    return result.map((ret) => JSON.stringify(ret));
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

  async lnurlAuth(params: ILnurlAuthParams) {
    const { lnurlDetail } = params;
    if (lnurlDetail.tag !== 'login') {
      throw new Error('lnurl-auth: invalid tag');
    }
    const password = checkIsDefined(params.password);
    const credentials = await this.baseGetCredentialsInfo({ password });
    const coreParams = {
      lnurlDetail,
      password,
      credentials,
    };
    const result = await this.coreApi.lnurlAuth(coreParams);

    return result;
  }
}
