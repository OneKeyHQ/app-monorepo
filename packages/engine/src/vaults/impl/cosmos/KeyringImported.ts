import { sha256 } from '@noble/hashes/sha256';

import { OneKeyInternalError } from '@onekeyhq/engine/src/errors';
import { Signer } from '@onekeyhq/engine/src/proxy';
import type { CurveName } from '@onekeyhq/engine/src/secret';
import { ed25519, secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import type { DBVariantAccount } from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_COSMOS as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import { pubkeyToBaseAddress } from './sdk/address';
import { generateSignBytes, serializeSignedTx } from './sdk/txBuilder';

import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
} from '../../types';
import type { IEncodedTxCosmos } from './type';

// @ts-ignore
export class KeyringImported extends KeyringImportedBase {
  private async getChainInfo() {
    return this.engine.providerManager.getChainInfoByNetworkId(this.networkId);
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
    const chainInfo = await this.getChainInfo();
    return {
      [selectedAddress]: new Signer(
        privateKey,
        password,
        chainInfo?.implOptions?.curve ?? 'secp256k1',
      ),
    };
  }

  getCurve(curveName: CurveName) {
    switch (curveName) {
      case 'ed25519':
        return ed25519;
      case 'secp256k1':
        return secp256k1;
      default:
        throw new OneKeyInternalError('Unsupported curve');
    }
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { privateKey, name } = params;
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }

    const chainInfo = await this.getChainInfo();

    const curve = chainInfo?.implOptions?.curve ?? 'secp256k1';
    const pubkey = this.getCurve(curve).publicFromPrivate(privateKey);
    const pub = pubkey.toString('hex');
    const address = pubkeyToBaseAddress(curve, pubkey);

    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${pub}`,
        name: name || '',
        type: AccountType.VARIANT,
        path: '',
        coinType: COIN_TYPE,
        pub,
        address,
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

    debugLogger.common.info('signTransaction dbAccount', dbAccount);

    const signers = await this.getSigners(options.password || '', [
      dbAccount.address,
    ]);

    const signer = signers[dbAccount.address];

    const senderPublicKey = unsignedTx.inputs?.[0]?.publicKey;
    if (!senderPublicKey) {
      throw new OneKeyInternalError('Unable to get sender public key.');
    }

    const encodedTx = unsignedTx.payload.encodedTx as IEncodedTxCosmos;
    const signBytes = generateSignBytes(encodedTx);
    const [signature] = await signer.sign(Buffer.from(sha256(signBytes)));

    const rawTx = serializeSignedTx({
      txWrapper: encodedTx,
      signature: {
        signatures: [signature],
      },
      publicKey: {
        pubKey: senderPublicKey,
      },
    });

    return {
      txid: '',
      rawTx: Buffer.from(rawTx).toString('base64'),
    };
  }
}
