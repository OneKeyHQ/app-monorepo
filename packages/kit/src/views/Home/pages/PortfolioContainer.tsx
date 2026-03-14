import { useMemo } from 'react';

import {
  Stack,
  Tabs,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { ProviderJotaiContextDeFiList } from '../../../states/jotai/contexts/deFiList';
import { ProviderJotaiContextHistoryList } from '../../../states/jotai/contexts/historyList';
import useActiveTabDAppInfo from '../../DAppConnection/hooks/useActiveTabDAppInfo';
import { EarnProviderMirror } from '../../Earn/EarnProviderMirror';
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

  const { result: extensionActiveTabDAppInfo } = useActiveTabDAppInfo();
  const addPaddingOnListFooter = useMemo(
    () => !!extensionActiveTabDAppInfo?.showFloatingPanel,
    [extensionActiveTabDAppInfo?.showFloatingPanel],
  );

  // Use a stable tree structure (Stack > YStack > children) regardless of
  // layout mode so that TokenListBlock is never unmounted/remounted when the
  // viewport crosses the mobile/desktop breakpoint.  Remounting resets the
  // All-Networks loading state while the page is "unfocused" (modal open),
  // which causes the token list to be stuck in a loading state.
  return (
    <Stack flexDirection={tableLayout ? 'row' : 'column'} pt="$3" gap="$6">
      <YStack
        flex={1}
        gap={tableLayout ? '$10' : '$6'}
        pb={tableLayout ? '$8' : '$4'}
      >
        <TokenListBlock
          showRecentHistory={tableLayout ? showRecentHistory : undefined}
          tableLayout={tableLayout || undefined}
        />
        <DeFiListBlock refreshCacheOnly />
        <PopularTrading tableLayout={tableLayout || undefined} />
        <EarnListView />
        <Upgrade />
        <SupportHub />
      </YStack>
      {tableLayout && showRecentHistory ? (
        <YStack
          width={PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH}
          flexShrink={0}
        >
          <RecentHistory />
        </YStack>
      ) : null}
      {addPaddingOnListFooter ? <Stack h="$16" /> : null}
    </Stack>
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
        <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
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
        </EarnProviderMirror>
      </ProviderJotaiContextHistoryList>
    </HomeTokenListProviderMirrorWrapper>
  );
}
PortfolioContainerWithProvider.displayName = 'PortfolioContainerWithProvider';

export { PortfolioContainerWithProvider };
