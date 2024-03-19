import {
  COINTYPE_NOSTR,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { AccountType, type DBVariantAccount } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import {
  NOSTR_ADDRESS_INDEX,
  Nostr,
  getNostrPath,
  validateEvent,
} from './helper/NostrSDK';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxNostr } from './helper/types';

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<DBVariantAccount[]> {
    const { password, indexes } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;
    if (indexes.length !== 1) {
      throw new Error('Nostr: only one account is supported');
    }
    const accountIndex = indexes[0];
    const nostr = new Nostr(this.walletId, accountIndex, password, seed);
    const pubkey = nostr.getPublicKeyHex();
    const bech32Encoded = nostr.getPubkeyEncodedByNip19();
    const path = `${getNostrPath(accountIndex)}/${NOSTR_ADDRESS_INDEX}`;

    return [
      {
        id: `${this.walletId}--${path}`,
        name: `Nostr #${accountIndex + 1}`,
        type: AccountType.VARIANT,
        path,
        coinType: COINTYPE_NOSTR,
        address: bech32Encoded,
        pub: pubkey,
        addresses: {},
      },
    ];
  }

  private getAccountIndex(dbAccount: DBVariantAccount) {
    const pathComponents = dbAccount.path.split('/');
    const templateComponents = dbAccount.template?.split('/');
    if (Array.isArray(templateComponents)) {
      for (let i = 0; i < templateComponents.length; i += 1) {
        if (templateComponents[i] === `${INDEX_PLACEHOLDER}'`) {
          const indexNumber = Number(pathComponents[i].replace(`'`, ''));
          if (!Number.isNaN(indexNumber)) {
            return indexNumber;
          }
        }
      }
    }
    return -1;
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    const { password } = options;
    const { encodedTx } = unsignedTx;
    const { event } = encodedTx as IEncodedTxNostr;
    if (!validateEvent(event)) {
      throw new Error('Invalid event');
    }
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password ?? '',
    )) as ExportedSeedCredential;
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const accountIndex = this.getAccountIndex(dbAccount);
    if (accountIndex < 0) {
      throw new Error('Invalid account index');
    }
    const nostr = new Nostr(this.walletId, accountIndex, password ?? '', seed);
    const data = await nostr.signEvent(event);
    return {
      txid: data.id ?? '',
      rawTx: JSON.stringify(data),
    };
  }

  async encrypt(
    params: {
      pubkey: string;
      plaintext: string;
    },
    options: {
      password: string;
    },
  ): Promise<string> {
    const { pubkey, plaintext } = params;
    const { password } = options;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password ?? '',
    )) as ExportedSeedCredential;
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const accountIndex = this.getAccountIndex(dbAccount);
    if (accountIndex < 0) {
      throw new Error('Invalid account index');
    }
    const nostr = new Nostr(this.walletId, accountIndex, password ?? '', seed);
    const encrypted = nostr.encrypt(pubkey, plaintext);
    return encrypted;
  }

  async decrypt(
    params: {
      pubkey: string;
      ciphertext: string;
    },
    options: {
      password: string;
    },
  ) {
    const { pubkey, ciphertext } = params;
    const { password } = options;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password ?? '',
    )) as ExportedSeedCredential;
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const accountIndex = this.getAccountIndex(dbAccount);
    if (accountIndex < 0) {
      throw new Error('Invalid account index');
    }
    const nostr = new Nostr(this.walletId, accountIndex, password ?? '', seed);
    const decrypted = nostr.decrypt(pubkey, ciphertext);
    return decrypted;
  }

  override async signMessage(
    messages: any[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    debugLogger.common.info('Nostr signSchnorr', messages);
    const { password } = options;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password ?? '',
    )) as ExportedSeedCredential;
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const accountIndex = this.getAccountIndex(dbAccount);
    if (accountIndex < 0) {
      throw new Error('Invalid account index');
    }
    const nostr = new Nostr(this.walletId, accountIndex, password ?? '', seed);
    const result = messages.map(({ message }) => nostr.signSchnorr(message));
    return result;
  }
}
