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

import { ProviderJotaiContextDeFiList } from '../../../states/jotai/contexts/deFiList';
import useActiveTabDAppInfo from '../../DAppConnection/hooks/useActiveTabDAppInfo';
import { DeFiListBlock } from '../components/DeFiListBlock';
import { PullToRefresh, onHomePageRefresh } from '../components/PullToRefresh';
import { SupportHub } from '../components/SupportHub';
import { Upgrade } from '../components/Upgrade';

function DeFiContainer() {
  const media = useMedia();

  const tableLayout = media.gtMd;

  const { result: extensionActiveTabDAppInfo } = useActiveTabDAppInfo();
  const addPaddingOnListFooter = useMemo(
    () => !!extensionActiveTabDAppInfo?.showFloatingPanel,
    [extensionActiveTabDAppInfo?.showFloatingPanel],
  );

  if (tableLayout) {
    return (
      <XStack gap="$6">
        <YStack flex={1} gap="$8" pt="$3" pb="$8">
          <DeFiListBlock tableLayout />
          <Upgrade />
          <SupportHub />
        </YStack>
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
  const tabBarHeight = useScrollContentTabBarOffset();
  return (
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
  );
}
DeFiContainerWithProvider.displayName = 'DeFiContainerWithProvider';

export { DeFiContainerWithProvider };
