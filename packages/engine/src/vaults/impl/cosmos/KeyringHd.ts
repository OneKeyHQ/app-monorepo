import { sha256 } from '@noble/hashes/sha256';
import BigNumber from 'bignumber.js';

import type { ExportedSeedCredential } from '@onekeyhq/engine/src/dbs/base';
import { OneKeyInternalError } from '@onekeyhq/engine/src/errors';
import { Signer } from '@onekeyhq/engine/src/proxy';
import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';
import type { DBVariantAccount } from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_COSMOS as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { pubkeyToBaseAddress } from './sdk/address';
import { serializeSignedTx, serializeTxForSignature } from './sdk/txBuilder';
import { TransactionWrapper } from './sdk/wrapper';
import { getADR36SignDoc, getDataForADR36 } from './utils';

import type { CommonMessage } from '../../../types/message';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';
import type { IEncodedTxCosmos } from './type';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0`;
const HARDEN_PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0'`;

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
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

  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
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

  override async signTransaction(
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

  override async signMessage(
    messages: CommonMessage[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;

    return Promise.all(
      messages.map(async (commonMessage) => {
        const { data, signer } = JSON.parse(commonMessage.message);

        const [messageData] = getDataForADR36(data);
        const unSignDoc = getADR36SignDoc(signer, messageData);
        const encodedTx = TransactionWrapper.fromAminoSignDoc(
          unSignDoc,
          undefined,
        );

        const { rawTx } = await this.signTransaction(
          {
            inputs: [
              {
                address: dbAccount.address,
                value: new BigNumber(0),
                publicKey: dbAccount.pub,
              },
            ],
            outputs: [],
            payload: {
              encodedTx,
            },
          },
          options,
        );

        return rawTx;
      }),
    );
  }
}
