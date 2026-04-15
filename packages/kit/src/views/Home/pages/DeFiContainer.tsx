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
import { ProviderJotaiContextDeFiList } from '../../../states/jotai/contexts/deFiList';
import { ProviderJotaiContextHistoryList } from '../../../states/jotai/contexts/historyList';
import useActiveTabDAppInfo from '../../DAppConnection/hooks/useActiveTabDAppInfo';
import { DeFiListBlock } from '../components/DeFiListBlock';
import { HomeTokenListProviderMirrorWrapper } from '../components/HomeTokenListProvider';
import { PullToRefresh, onHomePageRefresh } from '../components/PullToRefresh';
import { RecentHistory } from '../components/RecentHistory';
import { SupportHub } from '../components/SupportHub';
import { Upgrade } from '../components/Upgrade';
import { PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH } from '../types';

function DeFiContainer() {
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
      <XStack gap="$16">
        <YStack flex={1} gap="$8" pt="$3" pb="$8">
          <DeFiListBlock tableLayout />
          <Upgrade />
          <SupportHub />
        </YStack>
        {showRecentHistory ? (
          <YStack
            width={PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH}
            flexShrink={0}
            pt="$3"
          >
            <RecentHistory />
          </YStack>
        ) : null}
        {addPaddingOnListFooter ? <Stack h="$16" /> : null}
      </XStack>
    );
  }

  return (
    <YStack gap="$6" pb="$5">
      <DeFiListBlock />
      <Upgrade />
      <SupportHub />
      {addPaddingOnListFooter ? <Stack h="$16" /> : null}
    </YStack>
  );
}

function DeFiContainerWithProvider() {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  const tabBarHeight = useScrollContentTabBarOffset();
  return (
    <HomeTokenListProviderMirrorWrapper accountId={account?.id ?? ''}>
      <ProviderJotaiContextHistoryList>
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
            <DeFiContainer />
          </Tabs.ScrollView>
        </ProviderJotaiContextDeFiList>
      </ProviderJotaiContextHistoryList>
    </HomeTokenListProviderMirrorWrapper>
  );
}
DeFiContainerWithProvider.displayName = 'DeFiContainerWithProvider';

export { DeFiContainerWithProvider };
