import { useEffect, useMemo } from 'react';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

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

const TokenUpdater = () => {
  useEffect(() => {
    backgroundApiProxy.serviceSwap.getSwapTokens();
    backgroundApiProxy.serviceSwap.setDefaultInputToken();
  }, []);
  return null;
};

const SwapUpdater = () => (
  <>
    <TokenUpdater />
    <TransactionsUpdater />
  </>
);

export default SwapUpdater;
