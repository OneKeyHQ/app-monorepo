import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Stack, Tabs } from '@onekeyhq/components';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { Holders } from '../components/Holders';
import { TransactionsHistory } from '../components/TransactionsHistory';

export function MobileInformationTabs() {
  const intl = useIntl();
  const { tokenAddress, networkId } = useTokenDetail();

  const shouldShowHolders = useMemo(() => {
    return networkId === getNetworkIdsMap().sol;
  }, [networkId]);

  if (!tokenAddress || !networkId) {
    return null;
  }

  const tabs = [
    <Tabs.Tab
      key="transactions"
      name={intl.formatMessage({
        id: ETranslations.dexmarket_details_transactions,
      })}
    >
      <Stack flex={1} height={600}>
        <TransactionsHistory
          tokenAddress={tokenAddress}
          networkId={networkId}
        />
      </Stack>
    </Tabs.Tab>,
  ];

  if (shouldShowHolders) {
    tabs.push(
      <Tabs.Tab
        key="holders"
        name={intl.formatMessage({
          id: ETranslations.dexmarket_holders,
        })}
      >
        <Stack flex={1} height={600}>
          <Holders tokenAddress={tokenAddress} networkId={networkId} />
        </Stack>
      </Tabs.Tab>,
    );
  }

  return (
    <Stack flex={1}>
      <Tabs.Container
        headerContainerStyle={{
          width: '100%',
          shadowColor: 'transparent',
        }}
        renderTabBar={(props) => <Tabs.TabBar {...props} />}
      >
        {tabs}
      </Tabs.Container>
    </Stack>
  );
}
