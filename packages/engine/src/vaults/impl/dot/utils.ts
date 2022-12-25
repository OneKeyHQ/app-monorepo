import { IDecodedTxActionType } from '@onekeyhq/engine/src/vaults/types';

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
