/* eslint-disable @typescript-eslint/no-unused-vars */

import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';
import { bech32 } from 'bech32';
import { PubKey } from 'cosmjs-types/cosmos/crypto/ed25519/keys';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import {
  AuthInfo,
  Fee,
  SignerInfo,
  TxBody,
  TxRaw,
} from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { Any } from 'cosmjs-types/google/protobuf/any';
import Long from 'long';

import type { ICurveName } from '@onekeyhq/engine/src/secret';
import type { StdSignDoc } from '@onekeyhq/engine/src/vaults/impl/cosmos/sdk/amino/types';
import { ProtoSignDoc } from '@onekeyhq/engine/src/vaults/impl/cosmos/sdk/proto/protoSignDoc';
import type { IEncodedTxCosmos } from '@onekeyhq/engine/src/vaults/impl/cosmos/type';
import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { stripHexPrefix } from '@onekeyhq/shared/src/utils/hexUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
} from '../../types';

const curve: ICurveName = 'secp256k1';

const secp256k1PubkeyToRawAddress = (pubkey: Uint8Array): Uint8Array => {
  if (pubkey.length !== 33) {
    throw new Error(
      `Invalid Secp256k1 pubkey length (compressed): ${pubkey.length}`,
    );
  }

  return ripemd160(sha256(pubkey));
};

const ed25519PubkeyToRawAddress = (pubkey: Uint8Array): Uint8Array => {
  if (pubkey.length !== 32) {
    throw new Error(`Invalid Ed25519 pubkey length: ${pubkey.length}`);
  }

  return sha256(pubkey).slice(0, 20);
};

const pubkeyToBaseAddress = (
  $curve: ICurveName,
  pubkey: Uint8Array,
): string => {
  const digest =
    $curve === 'secp256k1'
      ? secp256k1PubkeyToRawAddress(pubkey)
      : ed25519PubkeyToRawAddress(pubkey);
  return bufferUtils.bytesToHex(digest);
};

function getAminoSignDoc(tx: IEncodedTxCosmos): StdSignDoc {
  if (tx.mode === 'direct') {
    throw new Error('Sign doc is encoded as Protobuf');
  }

  if (!('msgs' in tx.signDoc)) {
    throw new Error('Unexpected error');
  }

  return tx.signDoc;
}

function sortObjectByKey(obj: Record<string, any>): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return obj.map(sortObjectByKey);
  }
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, any> = {};
  sortedKeys.forEach((key) => {
    result[key] = sortObjectByKey(obj[key]);
  });
  return result;
}

function sortedJsonByKeyStringify(obj: Record<string, any>): string {
  return JSON.stringify(sortObjectByKey(obj));
}

const baseAddressToAddress = (prefix: string, baseAddress: string): string =>
  bech32.encode(prefix, bech32.toWords(bufferUtils.hexToBytes(baseAddress)));

function getDirectSignDoc(tx: IEncodedTxCosmos): ProtoSignDoc {
  if (tx.mode === 'amino') {
    throw new Error('Sign doc is encoded as Amino Json');
  }

  if ('msgs' in tx.signDoc) {
    throw new Error('Sign doc is encoded as Amino Json');
  }
  return new ProtoSignDoc(tx.signDoc);
}

const serializeTxForSignature = (encodedTx: IEncodedTxCosmos) => {
  if (encodedTx.mode === 'amino') {
    const signDoc = getAminoSignDoc(encodedTx);
    return Buffer.from(sortedJsonByKeyStringify(signDoc));
  }

  const directSignDoc = getDirectSignDoc(encodedTx);
  return directSignDoc.toBytes();
};

const serializeSignedTx = ({
  txWrapper: signDoc,
  signature: { signatures, signMode = SignMode.SIGN_MODE_LEGACY_AMINO_JSON },
  publicKey: { pubKey, pubKeyType = '/cosmos.crypto.secp256k1.PubKey' },
}: {
  txWrapper: IEncodedTxCosmos;
  signature: {
    signatures: Uint8Array[];
    signMode?: SignMode;
  };
  publicKey: {
    pubKey: string;
    pubKeyType?: string;
  };
}): Uint8Array => {
  if (signDoc.mode === 'amino') {
    const content = getAminoSignDoc(signDoc);
    const msgs = signDoc.msg?.protoMsgs;

    const pubKeyAny = Any.fromPartial({
      typeUrl: pubKeyType,
      value: Uint8Array.from(
        PubKey.encode(
          PubKey.fromPartial({
            key: bufferUtils.hexToBytes(stripHexPrefix(pubKey)),
          }),
        ).finish(),
      ),
    });

    return TxRaw.encode({
      bodyBytes: TxBody.encode(
        TxBody.fromPartial({
          messages: msgs?.map((msg) => ({
            typeUrl: msg.typeUrl,
            value: bufferUtils.hexToBytes(msg.value),
          })),
          memo: content.memo,
        }),
      ).finish(),
      authInfoBytes: AuthInfo.encode({
        signerInfos: [
          SignerInfo.fromPartial({
            publicKey: pubKeyAny,
            modeInfo: {
              single: {
                mode: signMode,
              },
            },
            sequence: Long.fromString(content.sequence),
          }),
        ],
        fee: Fee.fromPartial({
          amount: content.fee.amount.map((amount) => ({
            amount: amount.amount,
            denom: amount.denom,
          })),
          gasLimit: Long.fromString(content.fee.gas),
        }),
      }).finish(),
      signatures,
    }).finish();
  }

  const { bodyBytes, authInfoBytes } = getDirectSignDoc(signDoc).signDoc;

  return TxRaw.encode(
    TxRaw.fromPartial({
      bodyBytes: bufferUtils.hexToBytes(bodyBytes),
      authInfoBytes: bufferUtils.hexToBytes(authInfoBytes),
      signatures,
    }),
  ).finish();
};

export default class CoreChainSoftware extends CoreChainApiBase {
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
    // throw new Error('Method not implemented.');
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const encodedTx = unsignedTx.encodedTx as IEncodedTxCosmos;

    const txBytes = bufferUtils.toBuffer(
      sha256(serializeTxForSignature(encodedTx)),
    );
    const [signature] = await signer.sign(txBytes);
    const senderPublicKey = unsignedTx.inputs?.[0]?.publicKey;
    if (!senderPublicKey) {
      throw new OneKeyInternalError('Unable to get sender public key.');
    }
    const rawTxBytes = serializeSignedTx({
      txWrapper: encodedTx,
      signature: {
        signatures: [signature],
      },
      publicKey: {
        pubKey: senderPublicKey,
      },
    });
    const txid = '';
    return {
      txid,
      rawTx: Buffer.from(rawTxBytes).toString('base64'),
    };
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    throw new Error('Method not implemented.');
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
    const { publicKey, networkInfo } = query;
    const address = pubkeyToBaseAddress(
      curve,
      bufferUtils.hexToBytes(publicKey),
    );
    const addressCosmos = baseAddressToAddress(
      checkIsDefined(networkInfo?.addressPrefix),
      address,
    );
    return Promise.resolve({
      address,
      addresses: {
        [networkInfo.networkId]: addressCosmos,
      },
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
