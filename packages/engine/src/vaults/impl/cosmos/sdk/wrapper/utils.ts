import { bytesToHex } from '@noble/hashes/utils';
import { BigNumber } from 'bignumber.js';
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';
import { AuthInfo } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import Long from 'long';

import { UnpackedMessage } from '../proto/protoDecode';
import { ProtoSignDoc } from '../proto/protoSignDoc';

import type { SignDocHex, StdFee } from '../../type';

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
    amount: fee ? [...fee?.amount] : [],
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
