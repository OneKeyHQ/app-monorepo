import { hexToBytes } from '@noble/hashes/utils';
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

import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import {
  getAminoSignDoc,
  getDirectSignDoc,
  sortedJsonByKeyStringify,
} from './wrapper/utils';

import type { ProtoMsgsOrWithAminoMsgs } from './ITxMsgBuilder';
import type { TransactionWrapper } from './wrapper';

export interface TxBuilder {
  makeTxWrapper(
    messages: ProtoMsgsOrWithAminoMsgs,
    params: {
      memo: string;
      gasLimit: string;
      feeAmount: string;
      pubkey: Uint8Array;
      mainCoinDenom: string;
      chainId: string;
      accountNumber: string;
      nonce: string;
    },
  ): TransactionWrapper;
}

export const generateSignBytes = (
  encodedTx: TransactionWrapper,
): Uint8Array => {
  if (encodedTx.mode === 'amino') {
    const signDoc = getAminoSignDoc(encodedTx);
    return Buffer.from(sortedJsonByKeyStringify(signDoc));
  }

  const directSignDoc = getDirectSignDoc(encodedTx);
  return directSignDoc.toBytes();
};

/**
 * Sign the transaction with the provided signature.
 * @param encodedTx - TransactionWrapper
 * @returns Uint8Array
 */
export const serializeTxForSignature = (encodedTx: TransactionWrapper) => {
  if (encodedTx.mode === 'amino') {
    const signDoc = getAminoSignDoc(encodedTx);
    return Buffer.from(sortedJsonByKeyStringify(signDoc));
  }

  const directSignDoc = getDirectSignDoc(encodedTx);
  return directSignDoc.toBytes();
};

export const deserializeTx = (txBytes: Uint8Array) => {
  const txRaw = TxRaw.decode(txBytes);
  const txBody = TxBody.decode(txRaw.bodyBytes);
  const authInfo = AuthInfo.decode(txRaw.authInfoBytes);

  return {
    txBody,
    authInfo,
    signatures: txRaw.signatures,
  };
};

/**
 *
 * @param signDoc - TransactionWrapper
 * @param signature - Uint8Array[]
 * @param publicKey - hex string
 * @returns Uint8Array
 */
export const serializeSignedTx = ({
  txWrapper: signDoc,
  signature: { signatures, signMode = SignMode.SIGN_MODE_LEGACY_AMINO_JSON },
  publicKey: { pubKey, pubKeyType = '/cosmos.crypto.secp256k1.PubKey' },
}: {
  txWrapper: TransactionWrapper;
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
            key: hexToBytes(hexUtils.stripHexPrefix(pubKey)),
          }),
        ).finish(),
      ),
    });

    return TxRaw.encode({
      bodyBytes: TxBody.encode(
        TxBody.fromPartial({
          messages: msgs?.map((msg) => ({
            typeUrl: msg.typeUrl,
            value: hexToBytes(msg.value),
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
      bodyBytes: hexToBytes(bodyBytes),
      authInfoBytes: hexToBytes(authInfoBytes),
      signatures,
    }),
  ).finish();
};
