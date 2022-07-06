import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box, Progress } from '@onekeyhq/components';

import {
  SwftcTradeState,
  SwftcTransactionState,
  TransactionDetails,
} from '../typings';

export const TransactionReceiptStatus: FC<{ tx: TransactionDetails }> = ({
  tx,
}) => {
  const intl = useIntl();
  if (!tx.swftcReceipt) {
    return null;
  }
  const records: Record<SwftcTradeState, string> = {
    'wait_deposits': intl.formatMessage({ id: 'transaction__swap_deposit' }),
    'exchange': intl.formatMessage({ id: 'transaction__swap_exchange' }),
    'complete': intl.formatMessage({ id: 'transaction__swap_completed' }),
  };
  const { tradeState } = tx.swftcReceipt;
  const title = records[tradeState] ?? records.exchange;
  return (
    <Box mb="6">
      <Alert title={title} alertType="info" dismiss={false} />
    </Box>
  );
};

function useSwftcTransactionProgress(tx: TransactionDetails): number {
  const states: SwftcTransactionState[] = [
    'wait_deposit_send',
    'timeout',
    'wait_exchange_push',
    'wait_receive_send',
    'wait_receive_confirm',
    'receive_complete',
  ];
  const detailState = tx.swftcReceipt?.detailState;
  if (!detailState) {
    return 10;
  }
  const index = states.indexOf(detailState);
  if (index >= 0) {
    return ((index + 1) / states.length) * 100;
  }
  return 10;
}

export const SwftcTransactionProgress: FC<{ tx: TransactionDetails }> = ({
  tx,
}) => {
  const progress = useSwftcTransactionProgress(tx);
  if (!tx.swftcReceipt) {
    return null;
  }
  return (
    <Box my="6">
      <Progress min={10} max={100} value={progress} />
    </Box>
  );
};
