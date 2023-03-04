import { mnemonicFromEntropy } from '@onekeyfe/blockchain-libs/dist/secret';
import { mnemonicToSeedSync } from 'bip39';
import memoizee from 'memoizee';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

import { OneKeyInternalError } from '../../../errors';
import { isAccountCompatibleWithNetwork } from '../../../managers/account';
import { VaultBase } from '../../VaultBase';

import { ClientXmr } from './ClientXmr';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { getInstance } from './sdk/moneroCore/instance';
import { MoneroNetTypeEnum } from './sdk/moneroCore/moneroCoreTypes';
import { MoneroModule } from './sdk/moneroCore/monoreModule';
import settings from './settings';
import { getKeyPairFromRawPrivatekey, getRawPrivateKeyFromSeed } from './utils';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type {
  Account,
  DBAccount,
  DBVariantAccount,
} from '../../../types/account';
import type BigNumber from 'bignumber.js';

import axios from 'axios';

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  private getXmrModule = memoizee(
    async () => {
      const instance = await getInstance();
      return new MoneroModule(instance);
    },
    {
      max: 1,
      maxAge: getTimeDurationMs({ minute: 3 }),
      promise: true,
    },
  );

  private async getClient(): Promise<ClientXmr> {
    const rpcURL = await this.getRpcUrl();
    const walletUrl = 'https://node.onekeytest.com/mymonero';
    return this.createXmrClientFromURL(rpcURL, walletUrl);
  }

  private createXmrClientFromURL = memoizee(
    (rpcURL: string, walletUrl: string) => new ClientXmr(rpcURL, walletUrl),
    {
      max: 1,
      primitive: true,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  override async getExportedCredential(password: string): Promise<string> {
    const dbAccount = await this.getDbAccount();
    const { path, id } = dbAccount;
    const pathArr = path.split('/');
    if (id.startsWith('hd-') || id.startsWith('imported')) {
      const xmrModule = await this.getXmrModule();
      const { entropy } = (await this.engine.dbApi.getCredential(
        this.walletId,
        password,
      )) as ExportedSeedCredential;
      const mnemonic = mnemonicFromEntropy(entropy, password);
      const seed = mnemonicToSeedSync(mnemonic);
      const rawPrivateKey = getRawPrivateKeyFromSeed(
        seed,
        pathArr.slice(0, path.length - 1).join('/'),
      );
      if (!rawPrivateKey) {
        throw new OneKeyInternalError('Unable to get raw private key.');
      }
      const { privateSpendKey } = getKeyPairFromRawPrivatekey({
        xmrModule,
        rawPrivateKey,
      });

      return xmrModule.privateSpendKeyToWords(privateSpendKey);
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  override async getOutputAccount(): Promise<Account> {
    const dbAccount = (await this.getDbAccount({
      noCache: true,
    })) as DBVariantAccount;
    const ret = {
      id: dbAccount.id,
      name: dbAccount.name,
      type: dbAccount.type,
      path: dbAccount.path,
      coinType: dbAccount.coinType,
      tokens: [],
      address: dbAccount.addresses?.[this.networkId] || '',
    };
    if (
      ret.address.length === 0 &&
      isAccountCompatibleWithNetwork(dbAccount.id, this.networkId)
    ) {
      try {
        const address = await this.addressFromBase(dbAccount);

        ret.address = address;

        await this.engine.dbApi.updateAccountAddresses(
          dbAccount.id,
          this.networkId,
          address,
        );
      } catch {
        // pass
      }
    }
    return ret;
  }

  override async getAccountAddress() {
    const { address } = await this.getOutputAccount();
    return address;
  }

  override async addressFromBase(account: DBVariantAccount) {
    const xmrModule = await this.getXmrModule();
    const { isTestnet } = await this.getNetwork();
    const [publicSpendKey, publicViewKey] = account.pub.split(',');
    const index = Number(account.path.split('/').pop());
    return xmrModule.pubKeysToAddress(
      isTestnet ? MoneroNetTypeEnum.TestNet : MoneroNetTypeEnum.MainNet,
      index !== 0,
      Buffer.from(publicSpendKey, 'hex'),
      Buffer.from(publicViewKey, 'hex'),
    );
  }

  override async getBalances(
    requests: Array<{ address: string; tokenAddress?: string }>,
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();

    const requestsNew = await Promise.all(
      requests.map(async (request) => {
        const account = (await this.engine.dbApi.getAccountByAddress({
          address: request.address,
        })) as DBVariantAccount;

        return {
          address: request.address,
          coin: {},
          privateViewKey: account.privateViewKey as string,
        };
      }),
    );

    return client.getBalances(requestsNew);
  }

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const rpc = new JsonRPCRequest(`https://node.onekeytest.com/txmr/json_rpc`);
    const start = performance.now();
    const resp = await rpc.call('get_last_block_header');
    return {
      responseTime: Math.floor(performance.now() - start),
      latestBlock: 1,
    };
  }
}
