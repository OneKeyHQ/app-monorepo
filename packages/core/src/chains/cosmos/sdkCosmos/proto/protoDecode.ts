import { MsgGrant, MsgRevoke } from 'cosmjs-types/cosmos/authz/v1beta1/tx';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { MsgWithdrawDelegatorReward } from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import { MsgDeposit, MsgVote } from 'cosmjs-types/cosmos/gov/v1beta1/tx';
import {
  MsgBeginRedelegate,
  MsgDelegate,
  MsgUndelegate,
} from 'cosmjs-types/cosmos/staking/v1beta1/tx';
import {
  MsgExecuteContract,
  MsgInstantiateContract,
} from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { MsgTransfer } from 'cosmjs-types/ibc/applications/transfer/v1/tx';

import { ECosmosMessageType, UnknownMessage } from '../message';

import type { Any } from 'cosmjs-types/google/protobuf/any';
import type * as $protobuf from 'protobufjs';

export type ICosmosUnpackedMessage =
  | Any
  | (Any & { unpacked: any; factory?: ICosmosProtoFactory });

interface ICosmosProtoFactory {
  encode: (message: any, writer?: $protobuf.Writer) => $protobuf.Writer;
  decode: (r: $protobuf.Reader | Uint8Array, l?: number) => any;
  fromJSON: (object: any) => any;
  toJSON: (message: any) => unknown;
}

export class ProtoDecode {
  protected typeUrlFactoryMap: Map<string, ICosmosProtoFactory> = new Map();

  unpackMessage(any: Any): ICosmosUnpackedMessage {
    const factory = this.typeUrlFactoryMap.get(any.typeUrl);

    if (!factory) {
      return new UnknownMessage(any.typeUrl, any.value);
    }

    const unpacked = factory.decode(any.value);

    return {
      ...any,
      unpacked,
      factory,
    };
  }

  registerFactory(typeUrl: string, message: ICosmosProtoFactory): void {
    this.typeUrlFactoryMap.set(typeUrl, message);
  }
}

export const defaultProtoDecodeRegistry = new ProtoDecode();
defaultProtoDecodeRegistry.registerFactory(ECosmosMessageType.SEND, MsgSend);
defaultProtoDecodeRegistry.registerFactory(
  ECosmosMessageType.DELEGATE,
  MsgDelegate,
);
defaultProtoDecodeRegistry.registerFactory(
  ECosmosMessageType.UNDELEGATE,
  MsgUndelegate,
);
defaultProtoDecodeRegistry.registerFactory(
  ECosmosMessageType.REDELEGATE,
  MsgBeginRedelegate,
);
defaultProtoDecodeRegistry.registerFactory(
  ECosmosMessageType.EXECUTE_CONTRACT,
  MsgExecuteContract,
);
defaultProtoDecodeRegistry.registerFactory(
  ECosmosMessageType.TERRA_EXECUTE_CONTRACT,
  MsgExecuteContract,
);
defaultProtoDecodeRegistry.registerFactory(
  ECosmosMessageType.INSTANTIATE_CONTRACT,
  MsgInstantiateContract,
);
defaultProtoDecodeRegistry.registerFactory(
  ECosmosMessageType.WITHDRAW_DELEGATOR_REWARD,
  MsgWithdrawDelegatorReward,
);
defaultProtoDecodeRegistry.registerFactory(
  ECosmosMessageType.IBC_TRANSFER,
  MsgTransfer,
);
defaultProtoDecodeRegistry.registerFactory(ECosmosMessageType.VOTE, MsgVote);
defaultProtoDecodeRegistry.registerFactory(
  ECosmosMessageType.DEPOSIT,
  MsgDeposit,
);
defaultProtoDecodeRegistry.registerFactory(ECosmosMessageType.GRANT, MsgGrant);
defaultProtoDecodeRegistry.registerFactory(
  ECosmosMessageType.REVOKE,
  MsgRevoke,
);
