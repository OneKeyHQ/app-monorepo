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
import { getMoneroCoreInstance } from './sdk/moneroCore/instance';
import { MoneroCoreModule } from './sdk/moneroCore/moneroCoreModule';
import { getMoneroUtilInstance } from './sdk/moneroUtil/instance';
import { MoneroUtilModule } from './sdk/moneroUtil/moneroUtilModule';
import { MoneroNetTypeEnum } from './sdk/moneroUtil/moneroUtilTypes';
import settings from './settings';
import { getKeyPairFromRawPrivatekey } from './utils';

import type {
  Account,
  DBAccount,
  DBVariantAccount,
} from '../../../types/account';

import type { IHistoryTx } from '../../types';

import type { IOnChainHistoryTx } from './types';
import type BigNumber from 'bignumber.js';

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  private getMoneroUtilModule = memoizee(
    async () => {
      const instance = await getMoneroUtilInstance();
      return new MoneroUtilModule(instance);
    },
    {
      max: 1,
      maxAge: getTimeDurationMs({ minute: 3 }),
      promise: true,
    },
  );

  private getMoneroCoreInstance = memoizee(
    async () => getMoneroCoreInstance(),
    {
      max: 1,
      maxAge: getTimeDurationMs({ minute: 3 }),
      promise: true,
    },
  );

  private getMoneroKeys = memoizee(
    async () => {
      const moneroUtilModule = await this.getMoneroUtilModule();
      const dbAccount = (await this.getDbAccount({
        noCache: true,
      })) as DBVariantAccount;
      const rawPrivateKey = Buffer.from(dbAccount.raw ?? '', 'hex');
      if (!rawPrivateKey) {
        throw new OneKeyInternalError('Unable to get raw private key.');
      }

      return getKeyPairFromRawPrivatekey({
        rawPrivateKey,
        moneroUtilModule,
        index: Number(dbAccount.path.split('/').pop()),
      });
    },
    {
      max: 5,
      primitive: true,
      maxAge: getTimeDurationMs({ minute: 3 }),
      promise: true,
    },
  );

  private async getClient(): Promise<ClientXmr> {
    const rpcURL = await this.getRpcUrl();
    const walletUrl = 'https://node.onekeytest.com/mymonero';
    const moneroCoreInstance = await this.getMoneroCoreInstance();
    const keys = await this.getMoneroKeys();
    return this.createXmrClient(rpcURL, walletUrl, moneroCoreInstance, keys);
  }

  private createXmrClient = memoizee(
    (rpcURL: string, walletUrl: string, moneroCoreInstance, keys) =>
      new ClientXmr(rpcURL, walletUrl, moneroCoreInstance, keys),
    {
      max: 1,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  override async getExportedCredential(): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const moneroUtilModule = await this.getMoneroUtilModule();
      const { privateSpendKey } = await this.getMoneroKeys();

      return moneroUtilModule.privateSpendKeyToWords(privateSpendKey);
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
    const moneroUtilModule = await this.getMoneroUtilModule();
    const { isTestnet } = await this.getNetwork();
    const [publicSpendKey, publicViewKey] = account.pub.split(',');
    return moneroUtilModule.pubKeysToAddress(
      isTestnet ? MoneroNetTypeEnum.TestNet : MoneroNetTypeEnum.MainNet,
      Number(account.path.split('/').pop()) !== 0,
      Buffer.from(publicSpendKey, 'hex'),
      Buffer.from(publicViewKey, 'hex'),
    );
  }

  override async getBalances(
    requests: Array<{ address: string; tokenAddress?: string }>,
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();
    if (requests.length > 1) return [];

    const [request] = requests;

    return client.getBalances([
      {
        address: request.address,
        coin: {},
      },
    ]);
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
