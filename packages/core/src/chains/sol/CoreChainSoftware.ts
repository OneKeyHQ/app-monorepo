import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import {
  EMessageTypesCommon,
  EMessageTypesSolana,
} from '@onekeyhq/shared/types/message';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import { decryptAsync } from '../../secret';
import {
  ECoreApiExportedSecretKeyType,
  type ICoreApiGetAddressItem,
  type ICoreApiGetAddressQueryImported,
  type ICoreApiGetAddressQueryPublicKey,
  type ICoreApiGetAddressesQueryHd,
  type ICoreApiGetAddressesResult,
  type ICoreApiGetExportedSecretKey,
  type ICoreApiPrivateKeysMap,
  type ICoreApiSignBasePayload,
  type ICoreApiSignMsgPayload,
  type ICoreApiSignTxPayload,
  type ICurveName,
  type ISignedTxPro,
} from '../../types';

import { OffchainMessage } from './sdkSol/OffchainMessage';
import { parseToNativeTx } from './sdkSol/parse';

import type { IEncodedTxSol, INativeTxSol } from './types';
import type { ISigner } from '../../base/ChainSigner';

const curve: ICurveName = 'ed25519';

async function signTransaction({
  nativeTx,
  feePayer,
  signer,
  encodedTx,
}: {
  nativeTx: INativeTxSol;
  feePayer: PublicKey;
  signer: ISigner;
  encodedTx: IEncodedTxSol;
}): Promise<ISignedTxPro> {
  const transaction = nativeTx;
  const isVersionedTransaction = transaction instanceof VersionedTransaction;

  const [sig] = await signer.sign(
    isVersionedTransaction
      ? Buffer.from(transaction.message.serialize())
      : transaction.serializeMessage(),
  );
  transaction.addSignature(feePayer, sig);

  return {
    encodedTx,
    txid: bs58.encode(sig),
    rawTx: Buffer.from(
      transaction.serialize({ requireAllSignatures: false }),
    ).toString('base64'),
  };
}

async function signMessage(message: string, signer: ISigner): Promise<string> {
  const [signature] = await signer.sign(Buffer.from(message));
  return bs58.encode(signature);
}

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    const {
      // networkInfo,

      password,
      keyType,
      credentials,
      account,
      // addressEncoding,
    } = query;
    console.log(
      'ExportSecretKeys >>>> sol',
      this.baseGetCredentialsType({ credentials }),
    );

    const { privateKeyRaw } = await this.baseGetDefaultPrivateKey(query);

    if (!privateKeyRaw) {
      throw new OneKeyLocalError('privateKeyRaw is required');
    }
    if (keyType === ECoreApiExportedSecretKeyType.privateKey) {
      return bs58.encode(
        Buffer.concat([
          await decryptAsync({ password, data: privateKeyRaw }),
          bs58.decode(account.pub ?? ''),
        ]),
      );
    }
    throw new OneKeyLocalError(`SecretKey type not support: ${keyType}`);
  }

  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    return this.baseGetPrivateKeys({
      payload,
      curve,
    });
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, account } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const encodedTx = unsignedTx.encodedTx as IEncodedTxSol;
    const nativeTx = parseToNativeTx(encodedTx);
    const feePayer = new PublicKey(
      checkIsDefined(account.pub || account.pubKey),
    );
    if (!nativeTx) {
      throw new OneKeyLocalError('nativeTx is null');
    }

    return signTransaction({
      nativeTx,
      feePayer,
      signer,
      encodedTx: unsignedTx.encodedTx as any,
    });
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const { unsignedMsg } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });

    if (unsignedMsg.type === EMessageTypesCommon.SIGN_MESSAGE) {
      return signMessage(unsignedMsg.message, signer);
    }
    if (unsignedMsg.type === EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE) {
      const { message, payload: messagePayload } = unsignedMsg;
      const offchainMessage = new OffchainMessage({
        version: messagePayload?.version,
        message: Buffer.from(message),
      });
      const [signature] = await signer.sign(offchainMessage.serialize());
      return bs58.encode(signature);
    }

    throw new OneKeyLocalError('signMessage not supported');
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    const { privateKeyRaw } = query;
    const privateKey = bufferUtils.toBuffer(privateKeyRaw);
    const pub = this.baseGetCurve(curve).publicFromPrivate(privateKey);
    return this.getAddressFromPublic({
      publicKey: bufferUtils.bytesToHex(pub),
      networkInfo: query.networkInfo,
    });
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    const { publicKey } = query;
    const pubkey = bufferUtils.toBuffer(publicKey);
    const address = new PublicKey(pubkey).toBase58();
    return Promise.resolve({
      address,
      publicKey: address, // base58 encoded
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    return this.baseGetAddressesFromHd(query, {
      curve,
    });
  }
}
