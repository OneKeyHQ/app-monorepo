/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */

import { ed25519 } from '@onekeyhq/engine/src/secret/curves';
import { COINTYPE_STC as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { check } from '@onekeyhq/shared/src/utils/assertUtils';

import { ChainSigner } from '../../../../proxy';
import { AccountType } from '../../../../types/account';
import { KeyringImportedBase } from '../../../keyring/KeyringImportedBase';
import {
  buildSignedTx,
  buildUnsignedRawTx,
  hashRawTx,
  pubkeyToAddress,
} from '../utils';

import type { DBSimpleAccount } from '../../../../types/account';
import type { SignedTx, UnsignedTx } from '../../../../types/provider';
import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
} from '../../../types';

export class KeyringImported extends KeyringImportedBase {
  override async getSigners(
    password: string,
    addresses: Array<string>,
  ): Promise<Record<string, ChainSigner>> {
    const dbAccount = await this.getDbAccount();
    if (addresses.length !== 1) {
      throw new OneKeyInternalError('Starcoin signers number should be 1.');
    } else if (addresses[0] !== dbAccount.address) {
      throw new OneKeyInternalError('Wrong address required for signing');
    }

    const [privateKey] = Object.values(await this.getPrivateKeys({ password }));
    return {
      [dbAccount.address]: new ChainSigner(privateKey, password, 'ed25519'),
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

  async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { privateKey, name } = params;
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }

    const pubBuffer = ed25519.publicFromPrivate(privateKey);
    const pub = pubBuffer.toString('hex');
    const address = await pubkeyToAddress(pub);
    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${pub}`,
        name: name || '',
        type: AccountType.SIMPLE,
        path: '',
        coinType: COIN_TYPE,
        pub,
        address,
      },
    ]);
  }
}
