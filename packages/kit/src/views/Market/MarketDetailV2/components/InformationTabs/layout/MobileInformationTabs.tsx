import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { Holders } from '../components/Holders';
import { TransactionsHistory } from '../components/TransactionsHistory';

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

export function MobileInformationTabs() {
  const intl = useIntl();
  const { tokenAddress, networkId } = useTokenDetail();
  const [activeTab, setActiveTab] = useState<'transactions' | 'holders'>(
    'transactions',
  );

  const TransactionsHistoryComponent = useMemo(
    () => createTransactionsHistoryComponent(tokenAddress, networkId),
    [tokenAddress, networkId],
  );

  const HoldersComponent = useMemo(
    () => createHoldersComponent(tokenAddress, networkId),
    [tokenAddress, networkId],
  );

  const tabs = useMemo(() => {
    // Parameter validation: return empty array if parameters are empty
    if (!tokenAddress || !networkId) {
      return [];
    }

    return [
      {
        id: 'transactions' as const,
        title: intl.formatMessage({
          id: ETranslations.dexmarket_details_transactions,
        }),
        component: TransactionsHistoryComponent,
      },
      networkId === 'sol--101'
        ? {
            id: 'holders' as const,
            title: intl.formatMessage({
              id: ETranslations.dexmarket_holders,
            }),
            component: HoldersComponent,
          }
        : null,
    ].filter(Boolean);
  }, [
    TransactionsHistoryComponent,
    HoldersComponent,
    tokenAddress,
    networkId,
    intl,
  ]);

  if (!tokenAddress || !networkId || tabs.length === 0) {
    return null;
  }

  const ActiveComponent = tabs.find((tab) => tab?.id === activeTab)?.component;

  return (
    <Stack flex={1}>
      {/* Tab buttons */}
      <XStack p="$2" gap="$2">
        {tabs.map((tab) => {
          if (!tab) return null;
          return (
            <Button
              key={tab.id}
              flex={1}
              variant={activeTab === tab.id ? 'primary' : 'secondary'}
              onPress={() => setActiveTab(tab.id)}
            >
              {tab.title}
            </Button>
          );
        })}
      </XStack>

      {/* Tab content */}
      <Stack flex={1}>{ActiveComponent ? <ActiveComponent /> : null}</Stack>
    </Stack>
  );
}
