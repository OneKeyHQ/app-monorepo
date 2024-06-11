import type { ICosmosStdMsg } from './amino/types';
import type { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';

export type ICosmosAnyHex = {
  typeUrl: string;
  value: string;
};

export type ICosmosProtoMsgsOrWithAminoMsgs = {
  // AminoMsg sent locally must contain ProtoMsg
  aminoMsgs: ICosmosStdMsg[];
  protoMsgs: ICosmosAnyHex[];

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
  ): ICosmosAnyHex | ICosmosStdMsg;

  makeSendCwTokenMsg(
    sender: string,
    contract: string,
    toAddress: string,
    value: string,
  ): ICosmosAnyHex | ICosmosStdMsg;

  makeExecuteContractMsg(
    sender: string,
    contract: string,
    msg: object,
    funds?: Array<Coin>,
  ): ICosmosAnyHex | ICosmosStdMsg;
}
