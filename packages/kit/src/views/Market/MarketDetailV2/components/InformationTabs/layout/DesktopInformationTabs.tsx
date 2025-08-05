import { useIntl } from 'react-intl';

import { Tabs } from '@onekeyhq/components';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { Holders } from '../components/Holders';
import { TransactionsHistory } from '../components/TransactionsHistory';

export function DesktopInformationTabs() {
  const intl = useIntl();
  const { tokenAddress, networkId } = useTokenDetail();
  const networkIdsMap = getNetworkIdsMap();

  if (!tokenAddress || !networkId) {
    return null;
  }

  return (
    <Tabs.Container renderTabBar={(props) => <Tabs.TabBar {...props} />}>
      <Tabs.Tab
        name={intl.formatMessage({
          id: ETranslations.dexmarket_details_transactions,
        })}
      >
        <TransactionsHistory
          tokenAddress={tokenAddress}
          networkId={networkId}
        />
      </Tabs.Tab>

      {networkId === networkIdsMap.sol ? (
        <Tabs.Tab
          name={intl.formatMessage({
            id: ETranslations.dexmarket_holders,
          })}
        >
          <Holders tokenAddress={tokenAddress} networkId={networkId} />
        </Tabs.Tab>
      ) : null}
    </Tabs.Container>
  );
}
