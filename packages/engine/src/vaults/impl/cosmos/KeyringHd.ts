import { sha256 } from '@noble/hashes/sha256';

import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ExportedSeedCredential } from '@onekeyhq/engine/src/dbs/base';
import { ChainSigner } from '@onekeyhq/engine/src/proxy';
import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';
import type {
  DBSimpleAccount,
  DBVariantAccount,
} from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_COSMOS as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { pubkeyToBaseAddress } from './sdk/address';
import { serializeSignedTx, serializeTxForSignature } from './sdk/txBuilder';

import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxCosmos } from './type';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0`;
const HARDEN_PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0'`;

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.cosmos.hd;

  override getSigners(): Promise<Record<string, ChainSigner>> {
    throw new Error('getSigners moved to core.');
  }

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    return this.basePrepareAccountsHd(params, {
      accountType: AccountType.VARIANT,
      usedIndexes: params.indexes,
    });
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    return this.baseSignTransaction(unsignedTx, options);
  }

  override async signMessage(): Promise<string[]> {
    throw new Error('method not implemented');
  }

  async getSignersOld(password: string, addresses: Array<string>) {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const selectedAddress = dbAccount.address;

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('Cosmos signers number should be 1.');
    } else if (addresses[0] !== selectedAddress) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const { [dbAccount.path]: privateKey } = await this.getPrivateKeys({
      password,
    });
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Unable to get signer.');
    }
    const chainInfo = await this.getChainInfo();
    return {
      [selectedAddress]: new ChainSigner(
        privateKey,
        password,
        chainInfo?.implOptions?.curve ?? 'secp256k1',
      ),
    };
  }

  async prepareAccountsOld(
    params: IPrepareHdAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { password, indexes, names } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const chainInfo = await this.getChainInfo();

    const curve = chainInfo?.implOptions?.curve ?? 'secp256k1';

    const pubkeyInfos = batchGetPublicKeys(
      curve, // 'secp256k1',
      seed,
      password,
      curve === 'secp256k1' ? PATH_PREFIX : HARDEN_PATH_PREFIX,
      curve === 'secp256k1'
        ? indexes.map((index) => index.toString())
        : indexes.map((index) => `${index.toString()}'`),
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

      const address = pubkeyToBaseAddress(curve, pubkey);

      const name = (names || [])[index] || `COSMOS #${indexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.VARIANT,
        path,
        coinType: COIN_TYPE,
        pub: pubkey.toString('hex'),
        address,
        addresses: {},
      });
      index += 1;
    }
    return ret;
  }

  async signTransactionOld(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    debugLogger.common.info('signTransaction result', unsignedTx);
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;

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
    const signBytes = serializeTxForSignature(encodedTx);
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
