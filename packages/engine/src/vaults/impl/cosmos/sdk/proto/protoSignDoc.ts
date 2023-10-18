import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { AuthInfo, SignDoc, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import Long from 'long';

import { UnknownMessage } from '../message';

import { defaultProtoDecodeRegistry } from './protoDecode';

import type { SignDocHex } from '../../type';
import type { ProtoDecode, UnpackedMessage } from './protoDecode';

export class ProtoSignDoc {
  public static decode(bytes: Uint8Array): ProtoSignDoc {
    const signDoc = SignDoc.decode(bytes);
    return new ProtoSignDoc({
      bodyBytes: bytesToHex(signDoc.bodyBytes),
      authInfoBytes: bytesToHex(signDoc.authInfoBytes),
      chainId: signDoc.chainId,
      accountNumber: signDoc.accountNumber.toString(),
    });
  }

  protected _txBody?: TxBody;

  protected _authInfo?: AuthInfo;

  public readonly signDoc: SignDocHex;

  protected readonly protoDecode: ProtoDecode;

  constructor(
    signDoc: SignDocHex,
    protoCodec: ProtoDecode = defaultProtoDecodeRegistry,
  ) {
    this.signDoc = signDoc;
    this.protoDecode = protoCodec;
  }

  get txBody(): TxBody {
    if (!this._txBody) {
      this._txBody = TxBody.decode(hexToBytes(this.signDoc.bodyBytes));
    }

    return this._txBody;
  }

  set txBody(txBody: TxBody) {
    this._txBody = txBody;
    this.signDoc.bodyBytes = bytesToHex(TxBody.encode(txBody).finish());
  }

  get txMsgs(): UnpackedMessage[] {
    const msgs: UnpackedMessage[] = [];
    for (const msg of this.txBody.messages) {
      msgs.push(this.protoDecode.unpackMessage(msg));
    }

    return msgs;
  }

  get authInfo(): AuthInfo {
    if (!this._authInfo) {
      this._authInfo = AuthInfo.decode(hexToBytes(this.signDoc.authInfoBytes));
    }

    return this._authInfo;
  }

  set authInfo(authInfo: AuthInfo) {
    this._authInfo = authInfo;
    this.signDoc.authInfoBytes = bytesToHex(AuthInfo.encode(authInfo).finish());
  }

  get chainId(): string {
    return this.signDoc.chainId;
  }

  get accountNumber(): string {
    return this.signDoc.accountNumber.toString();
  }

  toBytes(): Uint8Array {
    return SignDoc.encode({
      bodyBytes: hexToBytes(this.signDoc.bodyBytes),
      authInfoBytes: hexToBytes(this.signDoc.authInfoBytes),
      chainId: this.signDoc.chainId,
      accountNumber: Long.fromString(this.signDoc.accountNumber),
    }).finish();
  }

  toJSON(): any {
    return {
      txBody: {
        ...(TxBody.toJSON(this.txBody) as any),
        ...{
          messages: this.txMsgs.map((msg) => {
            if (msg) {
              if (msg instanceof UnknownMessage) {
                return msg.toJSON();
              }
              if ('factory' in msg) {
                return msg.factory?.toJSON(msg.unpacked);
              }
            }
            return msg;
          }),
        },
      },
      authInfo: AuthInfo.toJSON(this.authInfo),
      chainId: this.chainId,
      accountNumber: this.accountNumber,
    };
  }
}
