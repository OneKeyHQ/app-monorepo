import { useMemo } from 'react';

import { Tab } from '@onekeyhq/components';

import Holders from './components/Holders';
import { TransactionsHistory } from './components/TransactionsHistory';

interface IInformationTabsProps {
  tokenAddress: string;
  networkId: string;
}

// Extract component definitions outside render to prevent re-creation on each render
const HoldersComponent = () => <Holders />;
HoldersComponent.displayName = 'HoldersComponent';

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

export function InformationTabs({
  tokenAddress,
  networkId,
}: IInformationTabsProps) {
  const TransactionsHistoryComponent = useMemo(
    () => createTransactionsHistoryComponent(tokenAddress, networkId),
    [tokenAddress, networkId],
  );

  const tabs = useMemo(
    () => [
      {
        id: 'holders',
        title: 'Holders',
        page: HoldersComponent,
      },
      {
        id: 'transactions',
        title: 'Transactions',
        page: TransactionsHistoryComponent,
      },
    ],
    [TransactionsHistoryComponent],
  );

  return <Tab data={tabs} />;
}
