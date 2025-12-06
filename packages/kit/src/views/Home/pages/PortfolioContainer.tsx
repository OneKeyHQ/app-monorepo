import {
  SizableText,
  Stack,
  Tabs,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { ProviderJotaiContextDeFiList } from '../../../states/jotai/contexts/deFiList';
import { DeFiListBlock } from '../components/DeFiListBlock';
import { EarnListView } from '../components/EarnListView';
import { HomeTokenListProviderMirrorWrapper } from '../components/HomeTokenListProvider';
import { PopularTrading } from '../components/PopularTrading';
import { RecentHistory } from '../components/RecentHistory';
import { SupportHub } from '../components/SupportHub';
import { TokenListBlock } from '../components/TokenListBlock';
import { Upgrade } from '../components/Upgrade';
import { PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH } from '../types';

function PortfolioContainer() {
  const media = useMedia();

  const tableLayout = media.gtMd;

  if (tableLayout) {
    return (
      <XStack py="$3" px="$5" gap="$8">
        <YStack flex={1}>
          {/* <TokenListBlock tableLayout />
          <DeFiListBlock tableLayout /> */}
          <PopularTrading tableLayout />
          <EarnListView />
          <Upgrade />
          <SupportHub />
        </YStack>
        <YStack
          width={PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH}
          flexShrink={0}
        >
          <RecentHistory />
        </YStack>
      </XStack>
    );
  }

  return (
    <YStack gap="$8" px="$5" py="$3">
      <PopularTrading />
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
        <PortfolioContainer />
      </ProviderJotaiContextDeFiList>
    </HomeTokenListProviderMirrorWrapper>
  );
}
PortfolioContainerWithProvider.displayName = 'PortfolioContainerWithProvider';

export { PortfolioContainerWithProvider };
