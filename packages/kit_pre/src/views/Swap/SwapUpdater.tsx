import { useCallback, useEffect, useMemo } from 'react';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';

import PendingTransaction from './components/PendingTransaction';
import { useWalletsSwapTransactions } from './hooks/useTransactions';

const TransactionsUpdater = () => {
  const txs = useWalletsSwapTransactions();
  const pendings = useMemo(
    () => txs.filter((tx) => tx.status === 'pending'),
    [txs],
  );
  return (
    <>
      {pendings.map((tx) => (
        <PendingTransaction key={tx.hash} tx={tx} />
      ))}
    </>
  );
};

const LimitOrderUpdator = () => {
  const activeAccount = useAppSelector((s) => s.limitOrder.activeAccount);
  const refresh = useCallback(() => {
    if (activeAccount) {
      backgroundApiProxy.serviceLimitOrder.syncAccount({
        accountId: activeAccount?.id,
      });
    }
  }, [activeAccount]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60 * 1000);
    return () => clearInterval(timer);
  }, [refresh]);
  return null;
};

const TokenUpdater = () => {
  useEffect(() => {
    backgroundApiProxy.serviceSwap.getSwapConfig();
    backgroundApiProxy.serviceSwap.setDefaultInputToken();
  }, []);
  return null;
};

const SwapUpdater = () => (
  <>
    <TokenUpdater />
    <TransactionsUpdater />
    <LimitOrderUpdator />
  </>
);

export default SwapUpdater;
