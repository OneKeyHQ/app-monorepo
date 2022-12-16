import { hexToBytes } from '@noble/hashes/utils';
import { PubKey } from 'cosmjs-types/cosmos/crypto/ed25519/keys';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { AuthInfo, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { Any } from 'cosmjs-types/google/protobuf/any';
import Long from 'long';

import { TransactionWrapper } from '../wrapper';

import type { ProtoMsgsOrWithAminoMsgs } from '../ITxMsgBuilder';
import type { TxBuilder } from '../txBuilder';
import type { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';
import type { SignDoc, SignerInfo } from 'cosmjs-types/cosmos/tx/v1beta1/tx';

export class TxProtoBuilder implements TxBuilder {
  private makeTxBodyBytes(body: Partial<TxBody>): Uint8Array {
    return TxBody.encode(
      TxBody.fromPartial({
        ...body,
      }),
    ).finish();
  }

  private encodePubkey(pubkey: Uint8Array): Any {
    const pubkeyProto = PubKey.fromPartial({
      key: pubkey,
    });
    return Any.fromPartial({
      typeUrl: '/cosmos.crypto.secp256k1.PubKey',
      value: Uint8Array.from(PubKey.encode(pubkeyProto).finish()),
    });
  }

  private makeSignDoc(
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

  /**
   * Create signer infos from the provided signers.
   *
   * This implementation does not support different signing modes for the different signers.
   */
  private makeSignerInfos(
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
  private makeAuthInfoBytes(
    signers: ReadonlyArray<{ readonly pubkey: any; readonly sequence: Long }>,
    feeAmount: readonly Coin[],
    gasLimit: Long,
    signMode = SignMode.SIGN_MODE_DIRECT,
  ): Uint8Array {
    const authInfo = {
      signerInfos: this.makeSignerInfos(signers, signMode),
      fee: {
        amount: [...feeAmount],
        gasLimit,
      },
    };
    return AuthInfo.encode(AuthInfo.fromPartial(authInfo)).finish();
  }

  makeTxWrapper(
    messages: ProtoMsgsOrWithAminoMsgs,
    params: {
      memo: string;
      gasLimit: string;
      feeAmount: string;
      pubkey: Uint8Array;
      mainCoinDenom: string;
      chainId: string;
      accountNumber: string;
      nonce: string;
    },
  ): TransactionWrapper {
    const bodyBytes = this.makeTxBodyBytes({
      messages: messages.protoMsgs.map((msg) => ({
        typeUrl: msg.typeUrl,
        value: hexToBytes(msg.value),
      })),
      memo: params.memo,
    });

    const encodePub = this.encodePubkey(params.pubkey);
    const authBytes = this.makeAuthInfoBytes(
      [{ pubkey: encodePub, sequence: Long.fromString(params.nonce) }],
      [
        {
          amount: params.feeAmount,
          denom: params.mainCoinDenom,
        },
      ],
      Long.fromString(params.gasLimit),
    );

    return TransactionWrapper.fromDirectSignDoc(
      this.makeSignDoc(
        bodyBytes,
        authBytes,
        params.chainId,
        Long.fromString(params.accountNumber),
      ),
      messages,
    );
  }
}
