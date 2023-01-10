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

import { MessageType, UnknownMessage } from '../message';

import type { Any } from 'cosmjs-types/google/protobuf/any';
import type * as $protobuf from 'protobufjs';

export type UnpackedMessage =
  | Any
  | (Any & { unpacked: any; factory?: ProtoFactory });

interface ProtoFactory {
  encode: (message: any, writer?: $protobuf.Writer) => $protobuf.Writer;
  decode: (r: $protobuf.Reader | Uint8Array, l?: number) => any;
  fromJSON: (object: any) => any;
  toJSON: (message: any) => unknown;
}

export class ProtoDecode {
  protected typeUrlFactoryMap: Map<string, ProtoFactory> = new Map();

  unpackMessage(any: Any): UnpackedMessage {
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

  registerFactory(typeUrl: string, message: ProtoFactory): void {
    this.typeUrlFactoryMap.set(typeUrl, message);
  }
}

export const defaultProtoDecodeRegistry = new ProtoDecode();
defaultProtoDecodeRegistry.registerFactory(MessageType.SEND, MsgSend);
defaultProtoDecodeRegistry.registerFactory(MessageType.DELEGATE, MsgDelegate);
defaultProtoDecodeRegistry.registerFactory(
  MessageType.UNDELEGATE,
  MsgUndelegate,
);
defaultProtoDecodeRegistry.registerFactory(
  MessageType.REDELEGATE,
  MsgBeginRedelegate,
);
defaultProtoDecodeRegistry.registerFactory(
  MessageType.EXECUTE_CONTRACT,
  MsgExecuteContract,
);
defaultProtoDecodeRegistry.registerFactory(
  MessageType.TERRA_EXECUTE_CONTRACT,
  MsgExecuteContract,
);
defaultProtoDecodeRegistry.registerFactory(
  MessageType.INSTANTIATE_CONTRACT,
  MsgInstantiateContract,
);
defaultProtoDecodeRegistry.registerFactory(
  MessageType.WITHDRAW_DELEGATOR_REWARD,
  MsgWithdrawDelegatorReward,
);
defaultProtoDecodeRegistry.registerFactory(
  MessageType.IBC_TRANSFER,
  MsgTransfer,
);
defaultProtoDecodeRegistry.registerFactory(MessageType.VOTE, MsgVote);
defaultProtoDecodeRegistry.registerFactory(MessageType.DEPOSIT, MsgDeposit);
defaultProtoDecodeRegistry.registerFactory(MessageType.GRANT, MsgGrant);
defaultProtoDecodeRegistry.registerFactory(MessageType.REVOKE, MsgRevoke);
