import memoizee from 'memoizee';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

import { isAccountCompatibleWithNetwork } from '../../../managers/account';
import { VaultBase } from '../../VaultBase';

import { ClientXmr } from './ClientXmr';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type {
  Account,
  DBAccount,
  DBVariantAccount,
} from '../../../types/account';
import type { XMRModule } from './types';
import type BigNumber from 'bignumber.js';

import { getInstance } from './sdk/instance';

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  private async getClient(): Promise<ClientXmr> {
    const rpcURL = await this.getRpcUrl();
    return this.createClientFromURL(rpcURL);
  }

  override createClientFromURL = memoizee(
    (rpcURL: string) => new ClientXmr(`${rpcURL}/json_rpc`),
    {
      max: 1,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

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
    const { isTestnet } = await this.getNetwork();
    const [publicSpendKey, publicViewKey] = account.pub.split(',');
    const index = Number(account.path.split('/').pop());
    // return xmrModule.lib.pub_keys_to_address(
    //   isTestnet ? xmrModule.lib.MONERO_TESTNET : xmrModule.lib.MONERO_MAINNET,
    //   index !== 0,
    //   Buffer.from(publicSpendKey, 'hex'),
    //   Buffer.from(publicViewKey, 'hex'),
    // );
    return {};
  }

  override async getBalances(
    requests: Array<{ address: string; tokenAddress?: string }>,
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();
    return client.getBalances(requests);
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
