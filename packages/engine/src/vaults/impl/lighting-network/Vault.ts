/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import memoizee from 'memoizee';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';

import { VaultBase } from '../../VaultBase';

import ClientLighting from './helper/clientLighting';
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
import type BigNumber from 'bignumber.js';

// @ts-ignore
export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  async getClient() {
    return this.getClientCache();
  }

  // client: axios
  private getClientCache = memoizee(() => new ClientLighting(), {
    maxAge: getTimeDurationMs({ minute: 3 }),
  });

  override addressFromBase(account: DBAccount): Promise<string> {
    return Promise.resolve('');
  }

  override getFetchBalanceAddress(account: DBVariantAccount): Promise<string> {
    return Promise.resolve(account.addresses.normalizedAddress);
  }

  override async getAccountBalance(
    tokenIds: string[],
    withMain?: boolean,
  ): Promise<(BigNumber | undefined)[]> {
    // No token support on BTC.
    const ret = tokenIds.map((id) => undefined);
    if (!withMain) {
      return ret;
    }
    const account = (await this.getDbAccount()) as DBVariantAccount;
    const [mainBalance] = await this.getBalances([
      {
        address: account.addresses.normalizedAddress,
      },
    ]);
    return [mainBalance].concat(ret);
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    console.log('=====>>>>>x: ', requests);
    const result = await Promise.all(
      requests.map(async ({ address }) => {
        const client = await this.getClient();
        return client.getBalance(address);
      }),
    );
    return result;
  }
}
