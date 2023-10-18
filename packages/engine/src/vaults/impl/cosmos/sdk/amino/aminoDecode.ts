/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { UnknownMessage } from '../message';

import { defaultAminoMsgOpts } from './types';

import type { UnpackedMessage } from '../proto/protoDecode';
import type { StdMsg } from './types';

interface AminoFactory {
  decode: (message: any) => any;
}

export class AminoDecode {
  protected typeFactoryMap: Map<string, AminoFactory> = new Map();

  unpackMessage(aminoAny: StdMsg): UnpackedMessage {
    const factory = this.typeFactoryMap.get(aminoAny.type);

    if (!factory) {
      return new UnknownMessage(aminoAny.type, aminoAny.value);
    }

    const unpacked = factory.decode(aminoAny.value);

    return {
      typeUrl: aminoAny.type,
      value: aminoAny.value,
      unpacked,
    };
  }

  registerFactory(type: string, message: AminoFactory): void {
    this.typeFactoryMap.set(type, message);
  }
}

export const defaultAminoDecodeRegistry = new AminoDecode();
defaultAminoDecodeRegistry.registerFactory(
  defaultAminoMsgOpts.send.native.type,
  {
    decode: (message: any) => ({
      fromAddress: message.from_address,
      toAddress: message.to_address,
      amount: message.amount,
    }),
  },
);
defaultAminoDecodeRegistry.registerFactory(
  defaultAminoMsgOpts.executeWasm.type,
  {
    decode: (message: any) => ({
      sender: message.sender,
      contract: message.contract,
      msg: message.msg,
      funds: message.funds,
    }),
  },
);
