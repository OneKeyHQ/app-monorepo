import { useMemo } from 'react';

import {
  Stack,
  Tabs,
  XStack,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { ProviderJotaiContextEarn } from '../../../states/jotai/contexts/earn';
import { ProviderJotaiContextHistoryList } from '../../../states/jotai/contexts/historyList';
import useActiveTabDAppInfo from '../../DAppConnection/hooks/useActiveTabDAppInfo';
import { EarnListView } from '../components/EarnListView';
import { HomeTokenListProviderMirrorWrapper } from '../components/HomeTokenListProvider';
import { PopularTrading } from '../components/PopularTrading';
import { PullToRefresh, onHomePageRefresh } from '../components/PullToRefresh';
import { RecentHistory } from '../components/RecentHistory';
import { SupportHub } from '../components/SupportHub';
import { TokenListBlock } from '../components/TokenListBlock';
import { Upgrade } from '../components/Upgrade';
import { PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH } from '../types';
import { ProviderJotaiContextDeFiList } from '../../../states/jotai/contexts/deFiList';
import { DeFiListBlock } from '../components/DeFiListBlock';

function PortfolioContainer() {
  const media = useMedia();

  const tableLayout = media.gtMd;
  const showRecentHistory = media.gtXl;

  const { result: extensionActiveTabDAppInfo } = useActiveTabDAppInfo();
  const addPaddingOnListFooter = useMemo(
    () => !!extensionActiveTabDAppInfo?.showFloatingPanel,
    [extensionActiveTabDAppInfo?.showFloatingPanel],
  );

  if (tableLayout) {
    return (
      <XStack pt="$3" gap="$6">
        <YStack flex={1} gap="$10" pb="$8">
          <TokenListBlock showRecentHistory={showRecentHistory} tableLayout />
          <DeFiListBlock refreshCacheOnly />
          <PopularTrading tableLayout />
          <EarnListView />
          <Upgrade />
          <SupportHub />
        </YStack>
        {showRecentHistory ? (
          <YStack
            width={PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH}
            flexShrink={0}
          >
            <RecentHistory />
          </YStack>
        ) : null}
        {addPaddingOnListFooter ? <Stack h="$16" /> : null}
      </XStack>
    );
  }

  return (
    <YStack gap="$6" $gtMd={{ gap: '$8' }} pt="$3" pb="$4">
      <TokenListBlock />
      <DeFiListBlock refreshCacheOnly />
      <PopularTrading />
      <EarnListView />
      <Upgrade />
      <SupportHub />
      {addPaddingOnListFooter ? <Stack h="$16" /> : null}
    </YStack>
  );
}

function PortfolioContainerWithProvider() {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  const tabBarHeight = useScrollContentTabBarOffset();
  return (
    <HomeTokenListProviderMirrorWrapper accountId={account?.id ?? ''}>
      <ProviderJotaiContextHistoryList>
        <ProviderJotaiContextEarn>
          <ProviderJotaiContextDeFiList>
            <Tabs.ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: tabBarHeight }}
              nestedScrollEnabled={platformEnv.isNativeAndroid}
              refreshControl={
                !platformEnv.isNativeAndroid ? (
                  <PullToRefresh onRefresh={onHomePageRefresh} />
                ) : undefined
              }
            >
              <PortfolioContainer />
            </Tabs.ScrollView>
          </ProviderJotaiContextDeFiList>
        </ProviderJotaiContextEarn>
      </ProviderJotaiContextHistoryList>
    </HomeTokenListProviderMirrorWrapper>
  );
}
PortfolioContainerWithProvider.displayName = 'PortfolioContainerWithProvider';

export { PortfolioContainerWithProvider };
