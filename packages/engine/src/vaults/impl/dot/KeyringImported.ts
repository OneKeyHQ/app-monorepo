import { bytesToHex } from '@noble/hashes/utils';
import { ed25519 } from '@onekeyfe/blockchain-libs/dist/secret/curves';

import { OneKeyInternalError } from '@onekeyhq/engine/src/errors';
import { Signer } from '@onekeyhq/engine/src/proxy';
import type { DBVariantAccount } from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { CommonMessage } from '@onekeyhq/engine/src/types/message';
import { KeyringImportedBase } from '@onekeyhq/engine/src/vaults/keyring/KeyringImportedBase';
import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
} from '@onekeyhq/engine/src/vaults/types';
import { addHexPrefix } from '@onekeyhq/engine/src/vaults/utils/hexUtils';
import { COINTYPE_DOT as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { TYPE_PREFIX } from './consts';
import polkadotSdk from './sdk/polkadotSdk';

import type { DotImplOptions } from './types';
import type Vault from './Vault';
import type {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

const { bufferToU8a, u8aConcat } = polkadotSdk;

// @ts-ignore
export class KeyringImported extends KeyringImportedBase {
  private async getChainInfo() {
    return this.engine.providerManager.getChainInfoByNetworkId(this.networkId);
  }

  private async getChainInfoImplOptions(): Promise<DotImplOptions> {
    const chainInfo = await this.getChainInfo();
    return chainInfo.implOptions as DotImplOptions;
  }

  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const selectedAddress = dbAccount.address;

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('Cosmos signers number should be 1.');
    } else if (addresses[0] !== selectedAddress) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const { [dbAccount.path]: privateKey } = await this.getPrivateKeys(
      password,
    );
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Unable to get signer.');
    }

    return {
      [selectedAddress]: new Signer(privateKey, password, 'ed25519'),
    };
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { privateKey, name } = params;
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }

    const pubkey = ed25519.publicFromPrivate(privateKey);
    const pub = pubkey.toString('hex');

    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${pub}`,
        name: name || '',
        type: AccountType.VARIANT,
        path: '',
        coinType: COIN_TYPE,
        pub,
        address: '',
        addresses: {},
      },
    ]);
  }

  override async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    debugLogger.common.info('signTransaction result', unsignedTx);
    const dbAccount = await this.getDbAccount();

    const vault = this.vault as Vault;

    const { hash: message } = await vault.serializeUnsignedTransaction(
      unsignedTx.payload.encodedTx,
    );

    const signers = await this.getSigners(options.password || '', [
      dbAccount.address,
    ]);
    const signer = signers[dbAccount.address];

    const senderPublicKey = unsignedTx.inputs?.[0]?.publicKey;
    if (!senderPublicKey) {
      throw new OneKeyInternalError('Unable to get sender public key.');
    }

    const [signature] = await signer.sign(Buffer.from(message));
    const txSignature = u8aConcat(TYPE_PREFIX.ed25519, bufferToU8a(signature));

    // Serialize a signed transaction.
    const tx = await vault.serializeSignedTransaction(
      unsignedTx.payload.encodedTx,
      bytesToHex(txSignature),
    );

    return Promise.resolve({
      txid: '',
      rawTx: tx,
      signature: addHexPrefix(bytesToHex(txSignature)),
    });
  }

  override async signMessage(
    messages: CommonMessage[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    const dbAccount = await this.getDbAccount();
    const signers = await this.getSigners(options.password || '', [
      dbAccount.address,
    ]);
    const signer = signers[dbAccount.address];
    const vault = this.vault as Vault;

    return Promise.all(
      messages.map(async (message) => {
        const wrapMessage = await vault.serializeMessage(message.message);
        const [signature] = await signer.sign(wrapMessage);
        const txSignature = u8aConcat(
          TYPE_PREFIX.ed25519,
          bufferToU8a(signature),
        );
        return addHexPrefix(bytesToHex(txSignature));
      }),
    );
  }
}
