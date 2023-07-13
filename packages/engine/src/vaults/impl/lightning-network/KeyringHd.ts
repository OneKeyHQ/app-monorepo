import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

import {
  COINTYPE_LIGHTNING,
  COINTYPE_LIGHTNING_TESTNET,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { generateNativeSegwitAccounts } from './helper/account';
import { signature } from './helper/signature';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { Signer } from '../../../proxy';
import type { DBVariantAccount } from '../../../types/account';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxLightning } from './types';
import type LightningVault from './Vault';

export class KeyringHd extends KeyringHdBase {
  override getSigners(): Promise<Record<string, Signer>> {
    return Promise.resolve({} as Record<string, Signer>);
  }

  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<DBVariantAccount[]> {
    const { password, indexes, names } = params;
    const { seed, entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;
    const network = await this.vault.getNetwork();
    const nativeSegwitAccounts = await generateNativeSegwitAccounts({
      engine: this.engine,
      seed,
      password,
      indexes,
      names,
      isTestnet: network.isTestnet,
    });

    const client = await (this.vault as LightningVault).getClient();

    const ret = [];
    for (const account of nativeSegwitAccounts) {
      const accountExist = await client.checkAccountExist(account.address);
      if (!accountExist) {
        const hashPubKey = bytesToHex(sha256(account.xpub));
        const signTemplate = await client.fetchSignTemplate(
          account.address,
          'register',
        );
        if (signTemplate.type !== 'register') {
          throw new Error('Wrong signature type');
        }
        const sign = await signature({
          msgPayload: {
            ...signTemplate,
            pubkey: hashPubKey,
            address: account.address,
          },
          engine: this.engine,
          path: account.path,
          password,
          entropy,
          isTestnet: network.isTestnet,
        });
        await client.createUser({
          hashPubKey,
          address: account.address,
          signature: sign,
          randomSeed: signTemplate.randomSeed,
        });
      }
      const CoinType = network.isTestnet
        ? COINTYPE_LIGHTNING_TESTNET
        : COINTYPE_LIGHTNING;
      const path = `m/44'/${CoinType}'/${account.index}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name: account.name,
        type: AccountType.VARIANT,
        path,
        coinType: CoinType,
        pub: account.xpub,
        address: '',
        addresses: {
          normalizedAddress: account.address,
          realPath: account.path,
          hashAddress: bytesToHex(ripemd160(account.address)),
        },
      });
    }

    return ret;
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    debugLogger.sendTx.info('signTransaction result', unsignedTx);
    const { password } = options;
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const { entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password ?? '',
    )) as ExportedSeedCredential;
    const { invoice, expired, created, paymentHash } =
      unsignedTx.encodedTx as IEncodedTxLightning;
    const client = await (this.vault as LightningVault).getClient();
    const signTemplate = await client.fetchSignTemplate(
      dbAccount.addresses.normalizedAddress,
      'transfer',
    );
    if (signTemplate.type !== 'transfer') {
      throw new Error('Wrong transfer signature type');
    }
    const network = await this.vault.getNetwork();
    const sign = await signature({
      msgPayload: {
        ...signTemplate,
        paymentHash,
        invoice,
        expired,
        created: Number(created),
        nonce: signTemplate.nonce,
        randomSeed: signTemplate.randomSeed,
      },
      engine: this.engine,
      path: dbAccount.addresses.realPath,
      password: password ?? '',
      entropy,
      isTestnet: network.isTestnet,
    });
    return {
      txid: paymentHash,
      rawTx: sign,
      nonce: signTemplate.nonce,
      randomSeed: signTemplate.randomSeed,
    };
  }
}
