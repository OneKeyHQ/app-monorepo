import { hdLedger } from '@polkadot/util-crypto';

import { IDecodedTxActionType } from '@onekeyhq/engine/src/vaults/types';

import { OneKeyInternalError } from '../../../errors';

import type { DecodedSignedTx } from '@substrate/txwrapper-polkadot';

export const getTransactionType = (module: string, func: string) => {
  const formatFunc = func.replace(/(_)/g, '').toLowerCase();

  if (
    module === 'balances' &&
    (formatFunc === 'transfer' ||
      formatFunc === 'transferkeepalive' ||
      formatFunc === 'transferall')
  ) {
    return IDecodedTxActionType.NATIVE_TRANSFER;
  }

  if (
    module === 'assets' &&
    (formatFunc === 'transfer' || formatFunc === 'transferkeepalive')
  ) {
    return IDecodedTxActionType.TOKEN_TRANSFER;
  }

  return IDecodedTxActionType.UNKNOWN;
};

export const getTransactionTypeFromTxInfo = (tx: DecodedSignedTx) => {
  const { name: methodName, pallet } = tx.method;

  return getTransactionType(pallet, methodName);
};

export const derivationHdLedger = (mnemonic: string, path: string) => {
  console.log('=====>>>>> derivationHdLedger begin:');
  try {
    return hdLedger(mnemonic, path);
  } catch (e: any) {
    console.log('=====>>>>> derivationHdLedger error:', e);

    const { message }: { message: string } = e;
    if (
      message ===
      'Expected a mnemonic with 24 words (or 25 including a password)'
    ) {
      throw new OneKeyInternalError(
        message,
        'msg__error_mnemonics_can_only_be_12_24',
      );
    }
    throw e;
  }
};
