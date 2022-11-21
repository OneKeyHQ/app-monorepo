import React, { useCallback, useMemo, useRef } from 'react';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { useAppSelector, useInterval } from '../../hooks';

import PendingTransaction from './components/PendingTransaction';
import { useSwapQuoteCallback } from './hooks/useSwap';
import { useWalletsSwapTransactions } from './hooks/useTransactions';

const TransactionsUpdater = () => {
  const txs = useWalletsSwapTransactions();
  const pendging = useMemo(
    () => txs.filter((tx) => tx.status === 'pending'),
    [txs],
  );
  return (
    <>
      {pendging.map((tx) => (
        <PendingTransaction key={tx.hash} tx={tx} />
      ))}
    </>
  );
};

const QuoteUpdater = () => {
  const quoteTime = useAppSelector((s) => s.swap.quoteTime);
  const error = useAppSelector((s) => s.swap.error);
  const quoteLimited = useAppSelector((s) => s.swap.quoteLimited);
  const ref = useRef<boolean>(false);
  const onSwapQuote = useSwapQuoteCallback();
  const onInterval = useCallback(async () => {
    const now = Date.now();
    if (
      !quoteLimited &&
      !error &&
      !ref.current &&
      quoteTime &&
      now - quoteTime >= 14 * 1000
    ) {
      ref.current = true;
      try {
        debugLogger.swap.info('swap interval quote');
        await onSwapQuote();
      } finally {
        ref.current = false;
      }
    }
  }, [onSwapQuote, quoteTime, quoteLimited, error]);

  useInterval(onInterval, 1000);

  return null;
};

const SwapUpdater = () => (
  <>
    <QuoteUpdater />
    <TransactionsUpdater />
  </>
);

export default SwapUpdater;
