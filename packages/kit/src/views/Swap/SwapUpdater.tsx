import React, { useCallback, useMemo, useRef } from 'react';

import { useActiveWalletAccount, useInterval } from '../../hooks';

import PendingTransaction from './components/PendingTransaction';
import { useSwapQuoteCallback, useSwapState } from './hooks/useSwap';
import { useAllTransactions } from './hooks/useTransactions';

const TransactionsUpdater = () => {
  const { accountId } = useActiveWalletAccount();
  const txs = useAllTransactions(accountId);
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
  const { quoteTime, error } = useSwapState();
  const ref = useRef<boolean>(false);
  const onSwapQuote = useSwapQuoteCallback();
  const onInterval = useCallback(async () => {
    const now = Date.now();
    if (!error && !ref.current && quoteTime && now - quoteTime >= 14 * 1000) {
      ref.current = true;
      try {
        await onSwapQuote();
      } finally {
        ref.current = false;
      }
    }
  }, [onSwapQuote, quoteTime, error]);

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
