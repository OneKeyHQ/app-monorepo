/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import memoizee from 'memoizee';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';

import { WrongPassword } from '../../../errors';
import { VaultBase } from '../../VaultBase';

import ClientLighting from './helper/clientLighting';
import { signature } from './helper/signature';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type { ExportedSeedCredential } from '../../../dbs/base';
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

  async getClient(
    password?: string,
    passwordLoadedCallback?: (isLoaded: boolean) => void,
  ) {
    return this.getClientCache(password, passwordLoadedCallback);
  }

  // client: axios
  private getClientCache = memoizee(
    (password?: string, passwordLoadedCallback?: (isLoaded: boolean) => void) =>
      new ClientLighting(async () =>
        this.exchangeToken(password, passwordLoadedCallback),
      ),
    {
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  private async exchangeToken(
    password?: string,
    passwordLoadedCallback?: (isLoaded: boolean) => void,
  ) {
    try {
      const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
      const address = dbAccount.addresses.normalizedAddress;
      const hashPubKey = bytesToHex(sha256(dbAccount.pub));
      const { entropy } = (await this.engine.dbApi.getCredential(
        this.walletId,
        password ?? '',
      )) as ExportedSeedCredential;
      const sign = await signature({
        msgPayload: {
          type: 'register',
          pubkey: hashPubKey,
          address,
        },
        engine: this.engine,
        path: dbAccount.addresses.realPath,
        password: password ?? '',
        entropy,
      });
      passwordLoadedCallback?.(true);
      return {
        hashPubKey,
        address,
        signature: sign,
      };
    } catch (e) {
      if (e instanceof WrongPassword) {
        passwordLoadedCallback?.(false);
      }
      throw e;
    }
  }

  override addressFromBase(account: DBAccount): Promise<string> {
    return Promise.resolve('');
  }

  override getFetchBalanceAddress(account: DBVariantAccount): Promise<string> {
    return Promise.resolve(account.addresses.normalizedAddress);
  }

  async getCurrentBalanceAddress(): Promise<string> {
    const account = (await this.getDbAccount()) as DBVariantAccount;
    return account.addresses.normalizedAddress;
  }

  override async getAccountBalance(
    tokenIds: string[],
    withMain?: boolean,
    password?: string,
    passwordLoadedCallback?: (isLoaded: boolean) => void,
  ): Promise<(BigNumber | undefined)[]> {
    // No token support on BTC.
    const ret = tokenIds.map((id) => undefined);
    if (!withMain) {
      return ret;
    }
    const account = (await this.getDbAccount()) as DBVariantAccount;
    const [mainBalance] = await this.getBalances(
      [
        {
          address: account.addresses.normalizedAddress,
        },
      ],
      password,
      passwordLoadedCallback,
    );
    return [mainBalance].concat(ret);
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
    password?: string,
    passwordLoadedCallback?: (isLoaded: boolean) => void,
  ): Promise<(BigNumber | undefined)[]> {
    const result = await Promise.all(
      requests.map(async ({ address }) => {
        const client = await this.getClient(password);
        return client.getBalance(address);
      }),
    );
    return result;
  }

  async createInvoice(
    amount: string,
    description?: string,
    password?: string,
    passwordLoadedCallback?: (isLoaded: boolean) => void,
  ) {
    const client = await this.getClient(password);
    const address = await this.getCurrentBalanceAddress();
    return client.createInvoice(address, amount, description);
  }
}
