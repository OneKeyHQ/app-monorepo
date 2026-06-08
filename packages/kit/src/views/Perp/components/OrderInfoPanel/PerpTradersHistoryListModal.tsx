import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { PageBody } from '@onekeyhq/components/src/layouts/Page/PageBody';
import { PageHeader } from '@onekeyhq/components/src/layouts/Page/PageHeader';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NotificationEnableAlert } from '@onekeyhq/kit/src/components/NotificationEnableAlert';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { usePerpTradesHistoryViewAllUrl } from '../../hooks/usePerpOrderInfoPanel';
import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { PerpAccountList } from './List/PerpAccountList';
import { PerpTradesHistoryList } from './List/PerpTradesHistoryList';
import { PerpTwapList } from './List/PerpTwapList';

type ITabName = 'Trades' | 'Twap' | 'Account';

const HISTORY_TABS: Array<{
  name: ITabName;
  labelId: ETranslations;
}> = [
  {
    name: 'Trades',
    labelId: ETranslations.perp_trades_history_title,
  },
  {
    name: 'Twap',
    labelId: ETranslations.perp_twap_order__title,
  },
  {
    name: 'Account',
    labelId: ETranslations.perp_account_history,
  },
];

function TabHeader({
  activeTab,
  onTabChange,
}: {
  activeTab: ITabName;
  onTabChange: (tab: ITabName) => void;
}) {
  const intl = useIntl();

  return (
    <XStack
      bg="$bgApp"
      borderBottomWidth="$0.5"
      borderBottomColor="$borderSubdued"
    >
      {HISTORY_TABS.map((tab, index) => (
        <XStack
          key={tab.name}
          py="$3"
          ml={index === 0 ? '$5' : '$2'}
          mr="$2"
          borderBottomWidth={activeTab === tab.name ? '$0.5' : '$0'}
          borderBottomColor="$borderActive"
          onPress={() => onTabChange(tab.name)}
          mb={-2}
        >
          <SizableText size="$headingXs">
            {intl.formatMessage({ id: tab.labelId })}
          </SizableText>
        </XStack>
      ))}
    </XStack>
  );
}

export function PerpTradersHistoryListModal() {
  const intl = useIntl();
  const { onViewAllUrl } = usePerpTradesHistoryViewAllUrl();
  const [activeTab, setActiveTab] = useState<ITabName>('Trades');

  useEffect(() => {
    if (activeTab === 'Account') {
      void backgroundApiProxy.serviceHyperliquidSubscription.enableLedgerUpdatesSubscription();
    }
  }, [activeTab]);

  const headerRight = useCallback(() => {
    if (activeTab !== 'Trades') {
      return null;
    }
    return (
      <Button
        onPress={onViewAllUrl}
        variant="tertiary"
        size="small"
        testID="perp-header-right-btn"
      >
        {intl.formatMessage({
          id: ETranslations.global_view_more,
        })}
      </Button>
    );
  }, [onViewAllUrl, intl, activeTab]);

  return (
    <Page>
      <PageHeader
        title={intl.formatMessage({
          id: ETranslations.global_history,
        })}
        headerRight={headerRight}
      />
      <PageBody>
        <YStack flex={1}>
          <TabHeader activeTab={activeTab} onTabChange={setActiveTab} />
          <YStack flex={1}>
            {activeTab === 'Trades' ? (
              <PerpTradesHistoryList isMobile useTabsList={false} />
            ) : null}
            {activeTab === 'Twap' ? (
              <PerpTwapList
                isMobile
                useTabsList={false}
                initialTab="history"
                enabledTabs={['history', 'fills']}
              />
            ) : null}
            {activeTab === 'Account' ? (
              <PerpAccountList
                isMobile
                useTabsList={false}
                ListHeaderComponent={
                  <Stack pt="$2">
                    <NotificationEnableAlert scene="perpHistory" />
                  </Stack>
                }
              />
            ) : null}
          </YStack>
        </YStack>
      </PageBody>
    </Page>
  );
}

const PerpTradersHistoryListModalWithProvider = () => {
  return (
    <PerpsProviderMirror>
      <PerpTradersHistoryListModal />
    </PerpsProviderMirror>
  );
};

export default function PerpTradersHistoryModal() {
  return (
    <PerpsAccountSelectorProviderMirror>
      <PerpTradersHistoryListModalWithProvider />
    </PerpsAccountSelectorProviderMirror>
  );
}
