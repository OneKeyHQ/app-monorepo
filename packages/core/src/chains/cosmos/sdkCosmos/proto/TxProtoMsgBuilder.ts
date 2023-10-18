import { bytesToHex } from '@noble/hashes/utils';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { PubKey } from 'cosmjs-types/cosmos/crypto/ed25519/keys';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { AuthInfo, SignDoc, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { Any } from 'cosmjs-types/google/protobuf/any';
import Long from 'long';

import { MessageType } from '../message';

import type { ITxMsgBuilder } from '../ITxMsgBuilder';
import type { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';
import type { SignerInfo } from 'cosmjs-types/cosmos/tx/v1beta1/tx';

function makeTxBodyBytes(body: Partial<TxBody>): Uint8Array {
  return TxBody.encode(
    TxBody.fromPartial({
      ...body,
    }),
  ).finish();
}

export function decodeTxBody(txBody: Uint8Array): TxBody {
  return TxBody.decode(txBody);
}

/**
 * Create signer infos from the provided signers.
 *
 * This implementation does not support different signing modes for the different signers.
 */
function makeSignerInfos(
  signers: ReadonlyArray<{ readonly pubkey: any; readonly sequence: Long }>,
  signMode: SignMode,
): SignerInfo[] {
  return signers.map(
    ({ pubkey, sequence }): SignerInfo => ({
      publicKey: pubkey,
      modeInfo: {
        single: { mode: signMode },
      },
      sequence,
    }),
  );
}

/**
 * Creates and serializes an AuthInfo document.
 *
 * This implementation does not support different signing modes for the different signers.
 */
function makeAuthInfoBytes(
  signers: ReadonlyArray<{ readonly pubkey: any; readonly sequence: Long }>,
  feeAmount: readonly Coin[],
  gasLimit: Long,
  signMode = SignMode.SIGN_MODE_DIRECT,
): Uint8Array {
  const authInfo = {
    signerInfos: makeSignerInfos(signers, signMode),
    fee: {
      amount: [...feeAmount],
      gasLimit,
    },
  };
  return AuthInfo.encode(AuthInfo.fromPartial(authInfo)).finish();
}

function encodePubkey(pubkey: Uint8Array): Any {
  const pubkeyProto = PubKey.fromPartial({
    key: pubkey,
  });
  return Any.fromPartial({
    typeUrl: '/cosmos.crypto.secp256k1.PubKey',
    value: Uint8Array.from(PubKey.encode(pubkeyProto).finish()),
  });
}

function makeSignDoc(
  bodyBytes: Uint8Array,
  authInfoBytes: Uint8Array,
  chainId: string,
  accountNumber: Long,
): SignDoc {
  return {
    bodyBytes,
    authInfoBytes,
    chainId,
    accountNumber,
  };
}

export function makeSignBytes({
  accountNumber,
  authInfoBytes,
  bodyBytes,
  chainId,
}: SignDoc): Uint8Array {
  const signDoc = SignDoc.fromPartial({
    authInfoBytes,
    bodyBytes,
    chainId,
    accountNumber,
  });
  return SignDoc.encode(signDoc).finish();
}

export function fastMakeSignDoc(
  messages: Any[],
  memo: string,
  gasLimit: string,
  feeAmount: string,
  pubkey: Uint8Array,
  mainCoinDenom: string,
  chainId: string,
  accountNumber: string,
  nonce: string,
): SignDoc {
  const bodyBytes = makeTxBodyBytes({
    messages,
    memo,
  });

  const encodePub = encodePubkey(pubkey);
  const authBytes = makeAuthInfoBytes(
    [{ pubkey: encodePub, sequence: Long.fromString(nonce) }],
    [
      {
        amount: feeAmount,
        denom: mainCoinDenom,
      },
    ],
    Long.fromString(gasLimit),
  );
  return makeSignDoc(
    bodyBytes,
    authBytes,
    chainId,
    Long.fromString(accountNumber),
  );
}

export function makeMsgSend(
  fromAddress: string,
  toAddress: string,
  value: string,
  denom: string,
): Any {
  return {
    typeUrl: MessageType.SEND,
    value: MsgSend.encode(
      MsgSend.fromPartial({
        fromAddress,
        toAddress,
        amount: [
          {
            amount: value,
            denom,
          },
        ],
      }),
    ).finish(),
  };
}

function removeNull(obj: any): any {
  if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj)
      .filter(([, v]) => v != null)
      .reduce(
        (acc, [k, v]) => ({
          ...acc,
          [k]: v === Object(v) && !Array.isArray(v) ? removeNull(v) : v,
        }),
        {},
      );
  }

  return obj;
}

export function makeMsgExecuteContract(
  sender: string,
  contract: string,
  msg: object,
  funds?: Array<Coin>,
): Any {
  return {
    typeUrl: MessageType.EXECUTE_CONTRACT,
    value: MsgExecuteContract.encode(
      MsgExecuteContract.fromPartial({
        sender,
        contract,
        msg: Buffer.from(JSON.stringify(removeNull(msg))),
        funds,
      }),
    ).finish(),
  };
}

export function makeTerraMsgExecuteContract(
  sender: string,
  contract: string,
  msg: object,
  funds?: Array<Coin>,
): Any {
  return {
    typeUrl: MessageType.TERRA_EXECUTE_CONTRACT,
    value: MsgExecuteContract.encode(
      MsgExecuteContract.fromPartial({
        sender,
        contract,
        msg: Buffer.from(JSON.stringify(removeNull(msg))),
        funds,
      }),
    ).finish(),
  };
}

export class TxProtoMsgBuilder implements ITxMsgBuilder {
  makeExecuteContractMsg(
    sender: string,
    contract: string,
    msg: object,
    funds?: Coin[] | undefined,
  ) {
    const value = MsgExecuteContract.encode(
      MsgExecuteContract.fromPartial({
        sender,
        contract,
        msg: Buffer.from(JSON.stringify(removeNull(msg))),
        funds,
      }),
    ).finish();
    return {
      typeUrl: MessageType.EXECUTE_CONTRACT,
      value: bytesToHex(value),
    };
  }

  makeSendNativeMsg(
    fromAddress: string,
    toAddress: string,
    value: string,
    denom: string,
  ) {
    const valueU8 = MsgSend.encode(
      MsgSend.fromPartial({
        fromAddress,
        toAddress,
        amount: [
          {
            amount: value,
            denom,
          },
        ],
      }),
    ).finish();
    return {
      typeUrl: MessageType.SEND,
      value: bytesToHex(valueU8),
    };
  }

  makeSendCwTokenMsg(
    sender: string,
    contract: string,
    toAddress: string,
    value: string,
  ) {
    return this.makeExecuteContractMsg(
      sender,
      contract,
      {
        transfer: {
          recipient: toAddress,
          amount: value,
        },
      },
      [],
    );
  }
}
