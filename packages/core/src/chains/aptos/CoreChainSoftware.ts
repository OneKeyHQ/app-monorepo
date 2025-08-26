import { createSignInSigningMessage } from '@aptos-labs/siwa';
import {
  Ed25519PublicKey,
  Ed25519Signature,
  SignedTransaction,
  TransactionAuthenticatorEd25519,
  generateSigningMessageForTransaction,
} from '@aptos-labs/ts-sdk';
// eslint-disable-next-line camelcase
import { sha3_256 } from 'js-sha3';

import { decryptAsync, ed25519 } from '@onekeyhq/core/src/secret';
import {
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { EMessageTypesAptos } from '@onekeyhq/shared/types/message';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
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
  type IUnsignedMessageAptos,
} from '../../types';

import { normalizePrivateKey } from './helper/privateUtils';
import { deserializeTransaction } from './helper/transactionUtils';

import type { IEncodedTxAptos } from './types';
import type {
  MultiAgentTransaction,
  SimpleTransaction,
} from '@aptos-labs/ts-sdk';

const curveName: ICurveName = 'ed25519';

async function buildSignedTx(
  rawTxn: SimpleTransaction | MultiAgentTransaction,
  senderPublicKey: string,
  signature: string,
  encodedTx: IEncodedTxAptos,
) {
  const txSignature = new Ed25519Signature(bufferUtils.hexToBytes(signature));
  const authenticator = new TransactionAuthenticatorEd25519(
    new Ed25519PublicKey(
      bufferUtils.hexToBytes(hexUtils.stripHexPrefix(senderPublicKey)),
    ),
    txSignature,
  );

  const signRawTx = new SignedTransaction(
    rawTxn.rawTransaction,
    authenticator,
  ).bcsToHex();

  return Promise.resolve({
    txid: '',
    rawTx: signRawTx.toStringWithoutPrefix(),
    encodedTx,
  });
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
      // addressEncoding,
    } = query;
    console.log(
      'ExportSecretKeys >>>> aptos',
      this.baseGetCredentialsType({ credentials }),
    );

    const { privateKeyRaw } = await this.baseGetDefaultPrivateKey(query);

    if (!privateKeyRaw) {
      throw new OneKeyLocalError('privateKeyRaw is required');
    }
    if (keyType === ECoreApiExportedSecretKeyType.privateKey) {
      const privateKey = (
        await decryptAsync({
          password,
          data: privateKeyRaw,
        })
      ).toString('hex');
      return normalizePrivateKey(privateKey, 'aip80', curveName);
    }
    throw new OneKeyLocalError(`SecretKey type not support: ${keyType}`);
  }

  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    return this.baseGetPrivateKeys({
      payload,
      curve: curveName,
    });
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, account } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve: curveName,
    });

    const { rawTxUnsigned } = unsignedTx;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxAptos;
    if (!rawTxUnsigned) {
      throw new OneKeyLocalError('rawTxUnsigned is undefined');
    }
    const senderPublicKey = account.pub;
    if (!senderPublicKey) {
      throw new OneKeyInternalError('Unable to get sender public key.');
    }

    const rawTxn = deserializeTransaction(rawTxUnsigned);
    const signingMessage = generateSigningMessageForTransaction(rawTxn);

    const [signature] = await signer.sign(bufferUtils.toBuffer(signingMessage));
    const signatureHex = hexUtils.hexlify(signature, {
      noPrefix: true,
    });
    return buildSignedTx(rawTxn, senderPublicKey, signatureHex, encodedTx);
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const unsignedMsg = payload.unsignedMsg as IUnsignedMessageAptos;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve: curveName,
    });
    if (unsignedMsg.type === EMessageTypesAptos.SIGN_IN) {
      const signInMessage = createSignInSigningMessage(unsignedMsg.message);
      const [signature] = await signer.sign(Buffer.from(signInMessage));
      return hexUtils.addHexPrefix(signature.toString('hex'));
    }
    if (unsignedMsg.type === EMessageTypesAptos.SIGN_MESSAGE) {
      const [signature] = await signer.sign(Buffer.from(unsignedMsg.message));
      return hexUtils.addHexPrefix(signature.toString('hex'));
    }
    throw new OneKeyLocalError(`Unsupported message type`);
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    const { publicKey } = query;
    const pubkey = bufferUtils.toBuffer(publicKey);

    // eslint-disable-next-line camelcase
    const hash = sha3_256.create();
    hash.update(pubkey);
    hash.update('\x00');
    const address = hexUtils.addHexPrefix(hash.hex());
    return Promise.resolve({
      address,
      publicKey,
    });
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    const { privateKeyRaw } = query;
    const privateKey = bufferUtils.toBuffer(privateKeyRaw);
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }
    const pub = ed25519.publicFromPrivate(privateKey);
    return this.getAddressFromPublic({
      publicKey: bufferUtils.bytesToHex(pub),
      networkInfo: query.networkInfo,
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    return this.baseGetAddressesFromHd(query, {
      curve: curveName,
    });
  }
}
