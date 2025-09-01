import { keccak256 } from '@ethersproject/keccak256';
import TronWeb from 'tronweb';

import { decryptAsync, uncompressPublicKey } from '@onekeyhq/core/src/secret';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { EMessageTypesTron } from '@onekeyhq/shared/types/message';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import {
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
  type IUnsignedTxPro,
} from '../../types';
import { ECoreApiExportedSecretKeyType } from '../../types';

import { TRON_MESSAGE_PREFIX } from './constants';

import type { IEncodedTxTron } from './types';
import type { ISigner } from '../../base/ChainSigner';
import type { IUnsignedMessageTron } from '../../types/coreTypesMessage';

const curve: ICurveName = 'secp256k1';

function publicKeyToAddress(publicKey: string): string {
  const uncompressed = uncompressPublicKey(
    curve,
    Buffer.from(publicKey, 'hex'),
  );
  return TronWeb.utils.address.fromHex(
    `41${keccak256(uncompressed.slice(-64)).slice(-40)}`,
  );
}

async function signTransaction(
  unsignedTx: IUnsignedTxPro,
  signer: ISigner,
): Promise<ISignedTxPro> {
  const encodedTx = unsignedTx.encodedTx as IEncodedTxTron;
  const [sig, recoveryParam] = await signer.sign(
    Buffer.from(encodedTx.txID, 'hex'),
  );

  const signedTx: ISignedTxPro = {
    encodedTx: unsignedTx.encodedTx,
    txid: encodedTx.txID,
    rawTx: JSON.stringify({
      ...encodedTx,
      signature: [
        Buffer.concat([sig, Buffer.from([recoveryParam])]).toString('hex'),
      ],
    }),
  };

  return Promise.resolve(signedTx);
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
      //
      // addressEncoding,
    } = query;
    console.log(
      'ExportSecretKeys >>>> tron',
      this.baseGetCredentialsType({ credentials }),
    );

    const { privateKeyRaw } = await this.baseGetDefaultPrivateKey(query);

    if (!privateKeyRaw) {
      throw new OneKeyLocalError('privateKeyRaw is required');
    }
    if (keyType === ECoreApiExportedSecretKeyType.privateKey) {
      return (await decryptAsync({ password, data: privateKeyRaw })).toString(
        'hex',
      );
    }
    throw new OneKeyLocalError(`SecretKey type not support: ${keyType}`);
  }

  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    // throw new NotImplemented();;
    return this.baseGetPrivateKeys({
      payload,
      curve,
    });
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    // throw new NotImplemented();;
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    return signTransaction(unsignedTx, signer);
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const unsignedMsg = payload.unsignedMsg as IUnsignedMessageTron;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    if (unsignedMsg.type === EMessageTypesTron.SIGN_MESSAGE) {
      return TronWeb.Trx.signString(
        unsignedMsg.message,
        await signer.getPrvkeyHex(),
      );
    }
    if (unsignedMsg.type === EMessageTypesTron.SIGN_MESSAGE_V2) {
      const message = Buffer.from(unsignedMsg.message, 'hex');
      const hash = keccak256(
        Buffer.concat([
          bufferUtils.toBuffer(TRON_MESSAGE_PREFIX, 'utf8'),
          bufferUtils.toBuffer(String(message.length), 'utf8'),
          message,
        ]),
      );
      const [sig, recoveryParam] = await signer.sign(
        Buffer.from(hexUtils.stripHexPrefix(hash), 'hex'),
      );
      return hexUtils.addHexPrefix(
        Buffer.concat([sig, Buffer.from([recoveryParam + 27])]).toString('hex'),
      );
    }

    throw new OneKeyLocalError(`Unsupported message type`);
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    // throw new NotImplemented();;
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
    const address = publicKeyToAddress(publicKey);
    return Promise.resolve({
      address,
      publicKey,
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
