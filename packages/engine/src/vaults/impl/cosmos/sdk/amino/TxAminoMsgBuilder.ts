import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { SignDoc, TxBody, TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';

import { MessageType } from '../message';

import { defaultAminoMsgOpts } from './types';

import type { ITxMsgBuilder } from '../ITxMsgBuilder';
import type { StdMsg } from './types';
import type { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';
import type { Any } from 'cosmjs-types/google/protobuf/any';

export function decodeTxBody(txBody: Uint8Array): TxBody {
  return TxBody.decode(txBody);
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

export function makeTxRawBytes(
  bodyBytes: Uint8Array,
  authInfoBytes: Uint8Array,
  signatures: Uint8Array[],
): Uint8Array {
  return TxRaw.encode(
    TxRaw.fromPartial({
      bodyBytes,
      authInfoBytes,
      signatures,
    }),
  ).finish();
}

export class TxAminoMsgBuilder implements ITxMsgBuilder {
  makeExecuteContractMsg(
    sender: string,
    contract: string,
    msg: object,
    funds?: Coin[] | undefined,
  ) {
    return {
      type: defaultAminoMsgOpts.executeWasm.type,
      value: {
        sender,
        contract,
        msg,
        funds,
      },
    };
  }

  makeSendNativeMsg(
    fromAddress: string,
    toAddress: string,
    value: string,
    denom: string,
  ): StdMsg {
    return {
      type: defaultAminoMsgOpts.send.native.type,
      value: {
        from_address: fromAddress,
        to_address: toAddress,
        amount: [
          {
            amount: value,
            denom,
          },
        ],
      },
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
