/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { CoinType, newSecp256k1Address } from '@glif/filecoin-address';
import LotusRpcEngine from '@glif/filecoin-rpc-client';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';

import {
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
} from '../../../errors';
import { Account, DBVariantAccount } from '../../../types/account';
import { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

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

  getClientCache = memoizee(
    async (rpcUrl) =>
      new LotusRpcEngine({
        apiAddress: rpcUrl,
      }),
    {
      max: 1,
      primitive: true,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  async getClient(url?: string) {
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    return this.getClientCache(url ?? rpcURL);
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      const privateKey = decrypt(password, encryptedPrivateKey).toString(
        'base64',
      );
      // export lotus type private key by default
      return Buffer.from(
        JSON.stringify({
          'Type': 'secp256k1',
          'PrivateKey': privateKey,
        }),
      ).toString('hex');
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  override validateImportedCredential(input: string): Promise<boolean> {
    let ret = false;
    if (this.settings.importedAccountEnabled) {
      ret = /^(0x)?[0-9a-zA-Z]{64}|[0-9a-zA-Z]{160}$/.test(input);
    }
    return Promise.resolve(ret);
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
    if (ret.address.length === 0) {
      const network = await this.getNetwork();

      const address = newSecp256k1Address(
        Buffer.from(dbAccount.pub, 'hex'),
        network.isTestnet ? CoinType.TEST : CoinType.MAIN,
      ).toString();

      await this.engine.dbApi.addAccountAddress(
        dbAccount.id,
        this.networkId,
        address,
      );
      ret.address = address;
    }
    return ret;
  }

  override async getAccountAddress() {
    const { address } = await this.getOutputAccount();
    return address;
  }

  override async getAccountBalance(tokenIds: Array<string>, withMain = true) {
    const address = await this.getAccountAddress();
    return this.getBalances(
      (withMain ? [{ address }] : []).concat(
        tokenIds.map((tokenAddress) => ({ address, tokenAddress })),
      ),
    );
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const result = await Promise.all(
      requests.map(async ({ address }) => {
        const client = await this.getClient();
        try {
          const balance = await client.request('WalletBalance', address);

          return new BigNumber(balance);
        } catch (error: any) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          if (error?.message?.includes?.('Account not found')) {
            return new BigNumber(0);
          }
          throw error;
        }
      }),
    );

    return result;
  }
}
