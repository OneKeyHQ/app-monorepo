import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useAppSelector } from '../../../hooks';
import { div, formatAmount, lte, minus, multiply } from '../utils';

import { useTokenPrice } from './useSwapTokenUtils';

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

export function usePriceImpact() {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const inputPrice = useTokenPrice(inputToken);
  const outputPrice = useTokenPrice(outputToken);
  const instantRate = useAppSelector((s) => s.swap.quote?.instantRate);
  if (outputPrice && inputPrice && instantRate) {
    const rate = div(inputPrice, outputPrice);
    if (lte(instantRate, rate)) {
      const percent = multiply(div(minus(rate, instantRate), rate), 100);
      return Number(percent);
    }
  }
  return undefined;
}
