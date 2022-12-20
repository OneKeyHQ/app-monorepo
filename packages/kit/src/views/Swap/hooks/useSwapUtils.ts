import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { formatAmount } from '../utils';

import type { TransactionDetails } from '../typings';

export function useSummaryTx() {
  const intl = useIntl();
  return useCallback(
    (tx: TransactionDetails) => {
      if (tx.type === 'approve') {
        if (tx.approval) {
          return `${intl.formatMessage({ id: 'title__approve' })} ${
            tx.approval?.token.symbol
          }`;
        }
        return `${intl.formatMessage({ id: 'title__approve' })}`;
      }
      if (tx.type === 'swap') {
        if (tx.tokens) {
          const { from, to } = tx.tokens;
          const a = `${formatAmount(from.amount, 4)} ${from.token.symbol}`;
          const b = `${formatAmount(to.amount, 4)} ${to.token.symbol}`;
          return `${a} → ${b}`;
        }
      }
      return '';
    },
    [intl],
  );
}
