/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */

import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';
import { COINTYPE_STC as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { check } from '@onekeyhq/shared/src/utils/assertUtils';

import { Signer } from '../../../../proxy';
import { AccountType } from '../../../../types/account';
import { KeyringHdBase } from '../../../keyring/KeyringHdBase';
import {
  buildSignedTx,
  buildUnsignedRawTx,
  hashRawTx,
  pubkeyToAddress,
} from '../utils';

import type { ExportedSeedCredential } from '../../../../dbs/base';
import type { DBSimpleAccount } from '../../../../types/account';
import type { SignedTx, UnsignedTx } from '../../../../types/provider';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
} from '../../../types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0'`;

export class KeyringHd extends KeyringHdBase {
  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('Starcoin signers number should be 1.');
    } else if (addresses[0] !== dbAccount.address) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const { [dbAccount.path]: privateKey } = await this.getPrivateKeys(
      password,
    );
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Unable to get signer.');
    }

    return {
      [dbAccount.address]: new Signer(privateKey, password, 'ed25519'),
    };
  }

  override async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const chainId = await this.vault.getNetworkChainId();
    const {
      inputs: [{ address: selectedAddress, publicKey: senderPublicKey }],
    } = unsignedTx;
    if (typeof unsignedTx.nonce !== 'number' || unsignedTx.nonce <= 0) {
      unsignedTx.nonce = await this.vault.getNextNonce(
        (
          await this.vault.getNetwork()
        ).id,
        await this.getDbAccount(),
      );
    }
    const [rawTxn, rawUserTransactionBytes] = buildUnsignedRawTx(
      unsignedTx,
      chainId,
    );
    const msgBytes = hashRawTx(rawUserTransactionBytes);

    check(
      typeof senderPublicKey !== 'undefined',
      'senderPublicKey is required',
    );
    const signers = await this.getSigners(options.password || '', [
      selectedAddress,
    ]);
    const signer = signers[selectedAddress];
    const [signature] = await signer.sign(Buffer.from(msgBytes));
    return buildSignedTx(senderPublicKey as string, signature, rawTxn);
  }

  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { password, indexes, names } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const pubkeyInfos = batchGetPublicKeys(
      'ed25519',
      seed,
      password,
      PATH_PREFIX,
      indexes.map((index) => `${index.toString()}'`),
    );

    if (pubkeyInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const ret = [];
    let index = 0;
    for (const info of pubkeyInfos) {
      const {
        path,
        extendedKey: { key: pubkey },
      } = info;
      const pub = pubkey.toString('hex');
      const address = await pubkeyToAddress(pub);
      const name = (names || [])[index] || `STC #${indexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.SIMPLE,
        path,
        coinType: COIN_TYPE,
        pub,
        address,
      });
      index += 1;
    }
    return ret;
  }
}
