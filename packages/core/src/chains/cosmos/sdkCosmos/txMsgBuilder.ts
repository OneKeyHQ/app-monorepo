import { TxAminoMsgBuilder } from './amino/TxAminoMsgBuilder';
import { TxProtoMsgBuilder } from './proto/TxProtoMsgBuilder';

import type { ICosmosStdMsg } from './amino/types';
import type {
  ICosmosAnyHex,
  ICosmosProtoMsgsOrWithAminoMsgs,
  ITxMsgBuilder,
} from './ITxMsgBuilder';
import type { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';

export class TxMsgBuilder {
  aminoMsgBuilder: ITxMsgBuilder = new TxAminoMsgBuilder();

  protoMsgBuilder: ITxMsgBuilder = new TxProtoMsgBuilder();

  private makeProtoMsgsOrWithAminoMsgs(
    aminoMsgFunc: (...args: any[]) => ICosmosAnyHex | ICosmosStdMsg,
    protoMsgFunc: (...args: any[]) => ICosmosAnyHex | ICosmosStdMsg,
    ...args: any[]
  ) {
    return {
      aminoMsgs: [aminoMsgFunc(...args) as ICosmosStdMsg],
      protoMsgs: [protoMsgFunc(...args) as ICosmosAnyHex],
    };
  }

  makeSendNativeMsg(
    fromAddress: string,
    toAddress: string,
    value: string,
    denom: string,
  ): ICosmosProtoMsgsOrWithAminoMsgs {
    return this.makeProtoMsgsOrWithAminoMsgs(
      this.aminoMsgBuilder.makeSendNativeMsg.bind(this.aminoMsgBuilder),
      this.protoMsgBuilder.makeSendNativeMsg.bind(this.protoMsgBuilder),
      fromAddress,
      toAddress,
      value,
      denom,
    );
  }

  makeSendCwTokenMsg(
    sender: string,
    contract: string,
    toAddress: string,
    value: string,
  ): ICosmosProtoMsgsOrWithAminoMsgs {
    return this.makeProtoMsgsOrWithAminoMsgs(
      this.aminoMsgBuilder.makeSendCwTokenMsg.bind(this.aminoMsgBuilder),
      this.protoMsgBuilder.makeSendCwTokenMsg.bind(this.protoMsgBuilder),
      sender,
      contract,
      toAddress,
      value,
    );
  }

  makeExecuteContractMsg(
    sender: string,
    contract: string,
    msg: object,
    funds?: Coin[] | undefined,
  ): ICosmosProtoMsgsOrWithAminoMsgs {
    return this.makeProtoMsgsOrWithAminoMsgs(
      this.aminoMsgBuilder.makeExecuteContractMsg.bind(this.aminoMsgBuilder),
      this.protoMsgBuilder.makeExecuteContractMsg.bind(this.protoMsgBuilder),
      sender,
      contract,
      msg,
      funds,
    );
  }
}
