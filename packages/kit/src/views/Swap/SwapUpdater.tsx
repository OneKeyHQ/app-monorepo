import { useEffect, useMemo } from 'react';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import PendingLimitOrder from './components/PendingLimitOrder';
import PendingTransaction from './components/PendingTransaction';
import { useAllLimitOrders } from './hooks/useLimitOrder';
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
  const orders = useAllLimitOrders();
  return (
    <>
      {orders.map((order) => (
        <PendingLimitOrder key={order.orderHash} limitOrder={order} />
      ))}
    </>
  );
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
