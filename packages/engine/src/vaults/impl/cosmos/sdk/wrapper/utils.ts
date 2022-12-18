import { bytesToHex } from '@noble/hashes/utils';
import { BigNumber } from 'bignumber.js';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { AuthInfo, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import Long from 'long';

import { MessageType } from '../message';
import { ProtoSignDoc } from '../proto/protoSignDoc';

import type { SignDocHex, StdFee } from '../../type';
import type { UnpackedMessage } from '../proto/protoDecode';
import type { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';

export function getDirectSignDoc(signDoc: SignDocHex): ProtoSignDoc {
  return new ProtoSignDoc(signDoc);
}

export function getChainId(signDoc: SignDocHex) {
  return getDirectSignDoc(signDoc).chainId;
}

export function getMsgs(signDoc: SignDocHex): UnpackedMessage[] {
  return getDirectSignDoc(signDoc).txMsgs;
}

export function getMemo(signDoc: SignDocHex): string {
  return getDirectSignDoc(signDoc).txBody.memo;
}

export function getFeeAmount(signDoc: SignDocHex): readonly Coin[] {
  const fees: Coin[] = [];
  for (const coinObj of getDirectSignDoc(signDoc).authInfo.fee?.amount ?? []) {
    if (coinObj.denom == null || coinObj.amount == null) {
      throw new Error('Invalid fee');
    }
    fees.push({
      denom: coinObj.denom,
      amount: coinObj.amount,
    });
  }

  return fees;
}

export function getFee(signDoc: SignDocHex): StdFee {
  const { fee } = getDirectSignDoc(signDoc).authInfo;

  return {
    amount: fee ? [...fee.amount] : [],
    gas_limit: fee?.gasLimit?.toString() ?? '0',
    payer: fee?.payer ?? '',
    granter: fee?.granter ?? '',
    feePayer: fee?.granter ?? '',
  };
}

export function setFee(signDoc: SignDocHex, fee: StdFee) {
  const directSignDoc = getDirectSignDoc(signDoc);
  directSignDoc.authInfo = {
    ...directSignDoc.authInfo,
    fee: {
      amount: fee.amount,
      gasLimit: Long.fromString(fee.gas_limit),
      payer: fee.payer ?? '',
      granter: fee.granter ?? '',
    },
  };

  signDoc.authInfoBytes = bytesToHex(
    AuthInfo.encode(directSignDoc.authInfo).finish(),
  );
}

export function setSendAmount(signDoc: SignDocHex, amount: string) {
  const directSignDoc = getDirectSignDoc(signDoc);
  const msg = directSignDoc.txMsgs[0];
  if (msg.typeUrl !== MessageType.SEND) {
    throw new Error('Invalid message type');
  }
  const sendMsg = MsgSend.decode(msg.value);
  directSignDoc.txBody = {
    ...directSignDoc.txBody,
    messages: [
      {
        typeUrl: MessageType.SEND,
        value: MsgSend.encode({
          ...sendMsg,
          amount: [
            {
              denom: sendMsg.amount[0].denom,
              amount: new BigNumber(amount).toFixed(),
            },
          ],
        }).finish(),
      },
    ],
  };

  signDoc.bodyBytes = bytesToHex(TxBody.encode(directSignDoc.txBody).finish());
  return signDoc;
}

export function getGas(signDoc: SignDocHex): number {
  const directSignDoc = getDirectSignDoc(signDoc);
  if (directSignDoc.authInfo?.fee?.gasLimit) {
    return directSignDoc.authInfo.fee?.gasLimit.toNumber() ?? 0;
  }
  return 0;
}

export function getSequence(signDoc: SignDocHex): BigNumber {
  const { signerInfos } = getDirectSignDoc(signDoc).authInfo;

  return (
    signerInfos
      .map((s) => new BigNumber(s.sequence.toString()))
      .sort((a, b) => b.comparedTo(a))[0] ?? new BigNumber(0)
  );
}
