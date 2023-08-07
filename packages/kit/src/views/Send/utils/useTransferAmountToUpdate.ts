import { BigNumber } from 'bignumber.js';

import type { IDecodedTx } from '@onekeyhq/engine/src/vaults/types';
import { IDecodedTxActionType } from '@onekeyhq/engine/src/vaults/types';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

export const getTransferAmountToUpdate = ({
  decodedTx,
  balance,
  amount,
  totalNativeGasFee,
}: {
  decodedTx: IDecodedTx;
  balance: string;
  amount: string;
  totalNativeGasFee?: string;
}) => {
  const { type, nativeTransfer } = decodedTx.actions[0];
  if (
    type === IDecodedTxActionType.NATIVE_TRANSFER &&
    typeof nativeTransfer !== 'undefined' &&
    (typeof nativeTransfer.utxoFrom !== 'undefined' ||
      nativeTransfer.tokenInfo.networkId === OnekeyNetwork.lightning)
  ) {
    // For UTXO model, the decodedTx is updated with the new transfer amount.
    // Use this instead of depending the incorrect feeInfoPayload results.
    return nativeTransfer.amount;
  }

  const balanceBN = new BigNumber(balance);
  const amountBN = new BigNumber(amount ?? 0);
  const transferAmountBn = BigNumber.min(balanceBN, amountBN);
  const feeBN = new BigNumber(totalNativeGasFee ?? 0);
  return transferAmountBn.minus(feeBN).toFixed();
};
