import { useMemo } from 'react';

import { Tab } from '@onekeyhq/components';

import Holders from './components/Holders';
import { TransactionsHistory } from './components/TransactionsHistory';

const HoldersPage = () => <Holders />;
const TransactionsPage = () => <TransactionsHistory />;

export function InformationTabs() {
  const tabs = useMemo(
    () => [
      {
        id: 'holders',
        title: 'Holders',
        page: HoldersPage,
      },
      {
        id: 'transactions',
        title: 'Transactions',
        page: TransactionsPage,
      },
    ],
    [],
  );

  return <Tab data={tabs} />;
}
