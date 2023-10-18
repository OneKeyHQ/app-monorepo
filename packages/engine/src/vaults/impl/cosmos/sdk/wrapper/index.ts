import { bytesToHex } from '@noble/hashes/utils';
import { SignDoc } from 'cosmjs-types/cosmos/tx/v1beta1/tx';

import type { SignDocHex } from '../../type';
import type { StdSignDoc } from '../amino/types';
import type { ProtoMsgsOrWithAminoMsgs } from '../ITxMsgBuilder';
import type { ProtoSignDoc } from '../proto/protoSignDoc';

export class TransactionWrapper {
  protected _protoSignDoc?: ProtoSignDoc;

  public readonly mode: 'amino' | 'direct';

  public readonly msg: ProtoMsgsOrWithAminoMsgs | undefined;

  constructor(
    public readonly signDoc: StdSignDoc | SignDocHex,
    msg?: ProtoMsgsOrWithAminoMsgs,
  ) {
    if ('msgs' in signDoc) {
      this.mode = 'amino';
    } else {
      this.mode = 'direct';
    }
    this.msg = msg;
  }

  static fromAminoSignDoc(
    signDoc: StdSignDoc,
    msg: ProtoMsgsOrWithAminoMsgs | undefined,
  ) {
    return new TransactionWrapper(signDoc, msg);
  }

  static fromDirectSignDoc(signDoc: SignDoc, msg: ProtoMsgsOrWithAminoMsgs) {
    const signDocHex: SignDocHex = {
      bodyBytes: bytesToHex(signDoc.bodyBytes),
      authInfoBytes: bytesToHex(signDoc.authInfoBytes),
      chainId: signDoc.chainId,
      accountNumber: signDoc.accountNumber.toString(),
    };
    return new TransactionWrapper(signDocHex, msg);
  }

  static fromDirectSignDocHex(
    signDoc: SignDocHex,
    msg: ProtoMsgsOrWithAminoMsgs | undefined,
  ) {
    return new TransactionWrapper(signDoc, msg);
  }

  static fromDirectSignDocBytes(
    signDocBytes: Uint8Array,
    msg: ProtoMsgsOrWithAminoMsgs,
  ) {
    const sign = SignDoc.decode(signDocBytes);
    return TransactionWrapper.fromDirectSignDoc(sign, msg);
  }

  clone(): TransactionWrapper {
    return new TransactionWrapper(this.signDoc);
  }
}
