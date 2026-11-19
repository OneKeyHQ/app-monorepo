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

import {
  OffchainMessage,
  classifyOffchainMessageVersion,
} from './sdkSol/OffchainMessage';
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
          await decryptAsync({
            password,
            data: privateKeyRaw,
            kdfBackend: query.kdfBackend,
            enablePbkdf2Cache: query.enablePbkdf2Cache,
          }),
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

      // Version 0 and version 1 have incompatible wire formats, so dispatch explicitly.
      const versionKind = classifyOffchainMessageVersion(
        messagePayload?.version,
      );
      if (versionKind === 'unsupported') {
        throw new OneKeyLocalError(
          `sol offchain message: unsupported version ${String(
            messagePayload?.version,
          )}`,
        );
      }

      // classifyOffchainMessageVersion decides what is supported; this reads the
      // discriminant, which is what narrows the payload to its version 1 shape.
      if (messagePayload?.version === 1) {
        const requiredSigners = messagePayload.requiredSigners.map((signer_) =>
          bs58.decode(signer_),
        );

        // The spec requires the signer to be one of the required signers, and a signature
        // from any other key satisfies nothing the message asks for. ProviderApiSolana
        // rejects that request, but core is also reached directly (apps/cli).
        const pubkey = await signer.getPubkey();
        const isRequiredSigner = requiredSigners.some((item) =>
          Buffer.from(item).equals(pubkey),
        );
        if (!isRequiredSigner) {
          throw new OneKeyLocalError(
            'sol offchain message: signer is not one of requiredSigners',
          );
        }

        const signedOffchainMessage =
          OffchainMessage.createOffChainMessageV1Bytes({
            message,
            requiredSigners,
          });
        const [signature] = await signer.sign(
          Buffer.from(signedOffchainMessage),
        );
        return bs58.encode(signature);
      }

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
      __hwExtraInfo__: undefined,
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
