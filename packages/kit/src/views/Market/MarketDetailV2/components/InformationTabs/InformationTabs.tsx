import { useMemo } from 'react';

import { Tab } from '@onekeyhq/components';

import { useTokenDetail } from '../../hooks/useTokenDetail';

import { Holders } from './components/Holders';
import { TransactionsHistory } from './components/TransactionsHistory';

// Extract component definitions outside render to prevent re-creation on each render
const createHoldersComponent = (tokenAddress: string, networkId: string) => {
  const Component = () => (
    <Holders tokenAddress={tokenAddress} networkId={networkId} />
  );
  Component.displayName = 'HoldersComponent';
  return Component;
};

// Factory function to create the TransactionsHistory component with props
const createTransactionsHistoryComponent = (
  tokenAddress: string,
  networkId: string,
) => {
  const Component = () => (
    <TransactionsHistory tokenAddress={tokenAddress} networkId={networkId} />
  );
  Component.displayName = 'TransactionsHistoryComponent';
  return Component;
};

export function InformationTabs() {
  const { tokenAddress, networkId } = useTokenDetail();

  const TransactionsHistoryComponent = useMemo(
    () => createTransactionsHistoryComponent(tokenAddress, networkId),
    [tokenAddress, networkId],
  );

  const HoldersComponent = useMemo(
    () => createHoldersComponent(tokenAddress, networkId),
    [tokenAddress, networkId],
  );

  const tabs = useMemo(
    () =>
      [
        {
          id: 'transactions',
          title: 'Transactions',
          page: TransactionsHistoryComponent,
        },
        networkId === 'sol--101'
          ? {
              id: 'holders',
              title: 'Holders',
              page: HoldersComponent,
            }
          : null,
      ].filter(Boolean),
    [TransactionsHistoryComponent, HoldersComponent, networkId],
  );

  return <Tab data={tabs} />;
}
