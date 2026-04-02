import { decryptAsync, ed25519 } from '@onekeyhq/core/src/secret';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

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
} from '../../types';

import sdkStellar from './sdkStellar';
import { hashMessage } from './utils/message';
import { assembleSignedTransaction } from './utils/signing';
import { extractTransactionHash } from './utils/transaction';

import type { IEncodedTxStellar } from './types';
import type { IUnsignedMessageStellar } from '../../types/coreTypesMessage';

const curve: ICurveName = 'ed25519';

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    const { keyType, password } = query;

    const { privateKeyRaw } = await this.baseGetDefaultPrivateKey(query);

    if (!privateKeyRaw) {
      throw new OneKeyInternalError('privateKeyRaw is required');
    }

    if (keyType === ECoreApiExportedSecretKeyType.privateKey) {
      return sdkStellar.encodeSecretKey(
        await decryptAsync({ password, data: privateKeyRaw }),
      );
    }
    if (keyType === ECoreApiExportedSecretKeyType.publicKey) {
      return sdkStellar.encodeAddress(
        await decryptAsync({ password, data: privateKeyRaw }),
      );
    }

    throw new OneKeyInternalError(`SecretKey type not support: ${keyType}`);
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
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });

    const encodedTx = unsignedTx.encodedTx as IEncodedTxStellar;

    // Extract transaction hash for signing from XDR
    const txHash = extractTransactionHash(
      encodedTx.xdr,
      encodedTx.networkPassphrase,
    );

    // Sign the transaction hash
    const [signature] = await signer.sign(txHash);

    // Get public key
    const publicKey = await signer.getPubkey();

    // Assemble signed transaction using utility function
    // This same function will be used by hardware wallet signing
    const result = assembleSignedTransaction({
      encodedTx: encodedTx.xdr,
      signature,
      publicKey,
      networkPassphrase: encodedTx.networkPassphrase,
    });

    return result;
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });

    const unsignedMsg = payload.unsignedMsg as IUnsignedMessageStellar;

    const messageHash: Buffer = hashMessage({
      messageType: unsignedMsg.type,
      message: unsignedMsg.message,
      networkPassphrase: unsignedMsg.payload?.networkPassphrase ?? '',
    });
    const [signature] = await signer.sign(messageHash);

    return bufferUtils.bytesToHex(signature);
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

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    const { publicKey } = query;
    const address = sdkStellar.encodeAddress(bufferUtils.toBuffer(publicKey));

    return Promise.resolve({
      address,
      publicKey,
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
