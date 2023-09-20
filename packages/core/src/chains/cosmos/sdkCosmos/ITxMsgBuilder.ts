import type { StdMsg } from './amino/types';
import type { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';

export type AnyHex = {
  typeUrl: string;
  value: string;
};

export type ProtoMsgsOrWithAminoMsgs = {
  // AminoMsg sent locally must contain ProtoMsg
  aminoMsgs: StdMsg[];
  protoMsgs: AnyHex[];

  // // Add rlp types data if you need to support ethermint with ledger.
  // // Must include `MsgValue`.
  // rlpTypes?: Record<
  //   string,
  //   Array<{
  //     name: string;
  //     type: string;
  //   }>
  // >;
};

export interface ITxMsgBuilder {
  makeSendNativeMsg(
    fromAddress: string,
    toAddress: string,
    value: string,
    denom: string,
  ): AnyHex | StdMsg;

  makeSendCwTokenMsg(
    sender: string,
    contract: string,
    toAddress: string,
    value: string,
  ): AnyHex | StdMsg;

  makeExecuteContractMsg(
    sender: string,
    contract: string,
    msg: object,
    funds?: Array<Coin>,
  ): AnyHex | StdMsg;
}
