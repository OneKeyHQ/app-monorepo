import { signEncodedTx } from '@onekeyhq/core/src/chains/nexa/sdkNexa';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import {
  COINTYPE_NEXA,
  COINTYPE_NEXA as COIN_TYPE,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { ChainSigner } from '../../../../proxy';
import { AccountType } from '../../../../types/account';
import { KeyringImportedBase } from '../../../keyring/KeyringImportedBase';

import type { DBUTXOAccount } from '../../../../types/account';
import type { IUnsignedMessageCommon } from '../../../../types/message';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../../types';

const curve = 'secp256k1';
export class KeyringImported extends KeyringImportedBase {
  override coreApi = coreChainApi.nexa.imported;

  override getSigners(): Promise<Record<string, ChainSigner>> {
    throw new Error('getSigners moved to core.');
  }

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    return this.basePrepareAccountsImportedUtxo(params, {
      coinType: COINTYPE_NEXA,
      accountType: AccountType.UTXO,
    });
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    return this.baseSignTransaction(unsignedTx, options);
  }

  override async signMessage(
    messages: IUnsignedMessageCommon[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    // throw new Error('Method not implemented.');
    return this.baseSignMessage(messages, options);
  }

  async prepareAccountsOld(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBUTXOAccount>> {
    const { name, privateKey } = params;
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }

    const pub = secp256k1.publicFromPrivate(privateKey);
    const pubHex = pub.toString('hex');
    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${pubHex}`,
        name: name || '',
        type: AccountType.UTXO,
        path: '',
        coinType: COIN_TYPE,
        xpub: '',
        address: pubHex,
        addresses: { [this.networkId]: pubHex },
      },
    ]);
  }

  async getSignersOld(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('NEXA signers number should be 1.');
    } else if (addresses[0] !== dbAccount.address) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const { [dbAccount.path]: privateKey } = await this.getPrivateKeys({
      password,
    });
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Unable to get signer.');
    }

    return {
      [dbAccount.address]: new ChainSigner(privateKey, password, curve),
    };
  }

  async getSignerOld(
    options: ISignCredentialOptions,
    { address }: { address: string },
  ) {
    const signers = await this.getSignersOld(options.password || '', [address]);
    const signer = signers[address];
    return signer;
  }

  async signTransactionOld(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    const dbAccount = await this.getDbAccount();
    const signer = await this.getSignerOld(options, dbAccount);
    const result = await signEncodedTx(
      unsignedTx,
      signer,
      await this.vault.getDisplayAddress(dbAccount.address),
    );
    return result;
  }

  signMessageOld(messages: any[], options: ISignCredentialOptions): any {
    console.log(messages, options);
  }
}
