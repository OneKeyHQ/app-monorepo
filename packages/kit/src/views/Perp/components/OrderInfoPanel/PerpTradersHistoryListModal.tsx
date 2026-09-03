import { useCallback, useEffect, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Button,
  type IPageNavigationProp,
  Page,
  ScrollView,
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
import {
  EModalPerpRoutes,
  type IModalPerpParamList,
  type IPerpHistoryTab,
} from '@onekeyhq/shared/src/routes/perp';

import { usePerpTradesHistoryViewAllUrl } from '../../hooks/usePerpOrderInfoPanel';
import { useUnifoldDepositTrackerAvailability } from '../../hooks/useShowDepositWithdrawModal';
import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { FundingHistoryFilterToolbar } from './Components/FundingHistoryFilterToolbar';
import {
  type IFundingHistoryMarketOption,
  type IFundingHistorySideFilter,
  reconcileFundingHistoryMarketOptions,
} from './fundingHistoryDisplay';
import { PerpAccountList } from './List/PerpAccountList';
import {
  FundingHistoryExportAction,
  PerpFundingHistoryList,
} from './List/PerpFundingHistoryList';
import { PerpTradesHistoryList } from './List/PerpTradesHistoryList';
import { PerpTwapList } from './List/PerpTwapList';

import type { RouteProp } from '@react-navigation/native';

type ITabName = IPerpHistoryTab;

const HISTORY_TABS: Array<{
  name: ITabName;
  labelId?: ETranslations;
  label?: string;
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
    name: 'Funding',
    labelId: ETranslations.perp_position_funding_2,
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      bounces={false}
      flexGrow={0}
      bg="$bgApp"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
    >
      <XStack>
        {HISTORY_TABS.map((tab, index) => (
          <XStack
            key={tab.name}
            py="$3"
            ml={index === 0 ? '$5' : '$2'}
            mr="$2"
            borderBottomWidth={1.5}
            borderBottomColor={
              activeTab === tab.name ? '$borderActive' : 'transparent'
            }
            onPress={() => onTabChange(tab.name)}
          >
            <SizableText
              numberOfLines={1}
              size="$headingXs"
              textTransform="none"
              letterSpacing={0}
              color={activeTab === tab.name ? '$text' : '$textSubdued'}
            >
              {tab.labelId
                ? intl.formatMessage({ id: tab.labelId })
                : tab.label}
            </SizableText>
          </XStack>
        ))}
      </XStack>
    </ScrollView>
  );
}

export function PerpTradersHistoryListModal() {
  const intl = useIntl();
  const navigation = useNavigation<IPageNavigationProp<IModalPerpParamList>>();
  const route =
    useRoute<
      RouteProp<IModalPerpParamList, EModalPerpRoutes.PerpTradersHistoryList>
    >();
  const initialTab = route.params?.initialTab ?? 'Trades';
  const { onViewAllUrl } = usePerpTradesHistoryViewAllUrl();
  const [activeTab, setActiveTab] = useState<ITabName>(initialTab);
  const [fundingHistorySideFilter, setFundingHistorySideFilter] =
    useState<IFundingHistorySideFilter>('all');
  const [fundingHistoryMarketFilter, setFundingHistoryMarketFilter] = useState<
    string | undefined
  >();
  const [fundingHistoryMarketOptions, setFundingHistoryMarketOptions] =
    useState<IFundingHistoryMarketOption[]>([]);
  const { isUnifoldDepositTrackerAvailable, safeRecipient } =
    useUnifoldDepositTrackerAvailability();

  useEffect(() => {
    if (
      fundingHistoryMarketFilter &&
      !fundingHistoryMarketOptions.some(
        (option) => option.coin === fundingHistoryMarketFilter,
      )
    ) {
      setFundingHistoryMarketFilter(undefined);
    }
  }, [fundingHistoryMarketFilter, fundingHistoryMarketOptions]);

  const handleFundingHistoryMarketOptionsChange = useCallback(
    (nextOptions: IFundingHistoryMarketOption[]) => {
      setFundingHistoryMarketOptions((currentOptions) =>
        reconcileFundingHistoryMarketOptions({
          currentOptions,
          nextOptions,
        }),
      );
    },
    [],
  );

  const handleViewCryptoDeposits = useCallback(() => {
    if (!safeRecipient) {
      return;
    }
    navigation.push(EModalPerpRoutes.MobileUnifoldDepositTracker, {
      expectedRecipient: safeRecipient,
    });
  }, [navigation, safeRecipient]);

  useEffect(() => {
    if (activeTab === 'Account') {
      void backgroundApiProxy.serviceHyperliquidSubscription.enableLedgerUpdatesSubscription();
    }
  }, [activeTab]);

  const headerRight = useCallback(() => {
    if (activeTab === 'Account' && isUnifoldDepositTrackerAvailable) {
      return (
        <Button
          onPress={handleViewCryptoDeposits}
          variant="tertiary"
          size="small"
          testID="perps-mobile-account-history-crypto-deposits"
        >
          {intl.formatMessage({
            id: ETranslations.perp_unifold_crypto_deposits__title,
          })}
        </Button>
      );
    }
    if (activeTab === 'Trades') {
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
    }
    return null;
  }, [
    activeTab,
    handleViewCryptoDeposits,
    intl,
    isUnifoldDepositTrackerAvailable,
    onViewAllUrl,
  ]);

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
          <YStack flex={1} pt={activeTab === 'Trades' ? '$3' : '$0'}>
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
            <YStack
              display={activeTab === 'Funding' ? 'flex' : 'none'}
              flex={1}
            >
              <XStack
                mt="$2"
                px="$5"
                py="$1.5"
                alignItems="center"
                justifyContent="space-between"
              >
                <FundingHistoryFilterToolbar
                  isMobile
                  sideFilter={fundingHistorySideFilter}
                  marketFilter={fundingHistoryMarketFilter}
                  marketOptions={fundingHistoryMarketOptions}
                  onSideFilterChange={setFundingHistorySideFilter}
                  onMarketFilterChange={setFundingHistoryMarketFilter}
                />
                <FundingHistoryExportAction
                  isMobile
                  sideFilter={fundingHistorySideFilter}
                  marketFilter={fundingHistoryMarketFilter}
                />
              </XStack>
              <PerpFundingHistoryList
                isMobile
                useTabsList={false}
                isActive={activeTab === 'Funding'}
                sideFilter={fundingHistorySideFilter}
                marketFilter={fundingHistoryMarketFilter}
                onMarketOptionsChange={handleFundingHistoryMarketOptionsChange}
              />
            </YStack>
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
