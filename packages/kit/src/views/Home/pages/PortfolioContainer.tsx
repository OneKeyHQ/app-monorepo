import { Tabs, XStack, YStack, useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { ProviderJotaiContextDeFiList } from '../../../states/jotai/contexts/deFiList';
import { ProviderJotaiContextEarn } from '../../../states/jotai/contexts/earn';
import { ProviderJotaiContextHistoryList } from '../../../states/jotai/contexts/historyList';
import { DeFiListBlock } from '../components/DeFiListBlock';
import { EarnListView } from '../components/EarnListView';
import { HomeTokenListProviderMirrorWrapper } from '../components/HomeTokenListProvider';
import { PopularTrading } from '../components/PopularTrading';
import { PullToRefresh, onHomePageRefresh } from '../components/PullToRefresh';
import { RecentHistory } from '../components/RecentHistory';
import { SupportHub } from '../components/SupportHub';
import { TokenListBlock } from '../components/TokenListBlock';
import { Upgrade } from '../components/Upgrade';
import { PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH } from '../types';

function PortfolioContainer() {
  const media = useMedia();

  const tableLayout = media.gtMd;
  const showRecentHistory = media.gtXl;

  if (tableLayout) {
    return (
      <XStack pt="$3" pb="$4" px="$5" gap="$6">
        <YStack flex={1} gap="$8">
          <TokenListBlock tableLayout />
          <DeFiListBlock tableLayout />
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
      </XStack>
    );
  }

  return (
    <YStack gap="$6" px="$5" pt="$3" pb="$4">
      <TokenListBlock />
      <DeFiListBlock />
      <PopularTrading />
      <EarnListView />
      <Upgrade />
      <SupportHub />
    </YStack>
  );
}

function PortfolioContainerWithProvider() {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });

  return (
    <HomeTokenListProviderMirrorWrapper accountId={account?.id ?? ''}>
      <ProviderJotaiContextDeFiList>
        <ProviderJotaiContextHistoryList>
          <ProviderJotaiContextEarn>
            <Tabs.ScrollView
              nestedScrollEnabled={platformEnv.isNativeAndroid}
              refreshControl={
                !platformEnv.isNativeAndroid ? (
                  <PullToRefresh onRefresh={onHomePageRefresh} />
                ) : undefined
              }
            >
              <PortfolioContainer />
            </Tabs.ScrollView>
          </ProviderJotaiContextEarn>
        </ProviderJotaiContextHistoryList>
      </ProviderJotaiContextDeFiList>
    </HomeTokenListProviderMirrorWrapper>
  );
}
PortfolioContainerWithProvider.displayName = 'PortfolioContainerWithProvider';

export { PortfolioContainerWithProvider };
