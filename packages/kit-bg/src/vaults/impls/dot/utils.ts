import { hdLedger } from '@polkadot/util-crypto';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import type { DecodedSignedTx } from '@substrate/txwrapper-polkadot';

export const getTransactionTypeV2 = (module: string) => {
  if (module === 'balances') {
    return EDecodedTxActionType.ASSET_TRANSFER;
  }

  if (module === 'assets') {
    return EDecodedTxActionType.ASSET_TRANSFER;
  }

  return EDecodedTxActionType.UNKNOWN;
};

export const getTransactionType = (module: string, func: string) => {
  const formatFunc = func.replace(/(_)/g, '').toLowerCase();

  if (
    module === 'balances' &&
    (formatFunc === 'transfer' ||
      formatFunc === 'transferkeepalive' ||
      formatFunc === 'transferallowdeath' ||
      formatFunc === 'transferall')
  ) {
    return EDecodedTxActionType.ASSET_TRANSFER;
  }

  if (
    module === 'assets' &&
    (formatFunc === 'transfer' || formatFunc === 'transferkeepalive')
  ) {
    return EDecodedTxActionType.ASSET_TRANSFER;
  }

  return EDecodedTxActionType.UNKNOWN;
};

export const getTransactionTypeFromTxInfo = (tx: DecodedSignedTx) => {
  const { name: methodName, pallet } = tx.method;

  return getTransactionType(pallet, methodName);
};

export const derivationHdLedger = (mnemonic: string, path: string) => {
  try {
    return hdLedger(mnemonic, path);
  } catch (e: any) {
    const { message }: { message: string } = e;
    if (
      message ===
      'Expected a mnemonic with 24 words (or 25 including a password)'
    ) {
      throw new OneKeyInternalError(message);
    }
    throw e;
  }
};
