import { XStack, YStack, useMedia } from '@onekeyhq/components';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { DeFiListView } from '../components/DeFiListView';
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

  const isTableLayout = media.gtMd;

  if (isTableLayout) {
    return (
      <XStack py="$3" px="$5" gap="$6">
        <YStack flex={1}>
          <TokenListBlock />
          <DeFiListView />
          <PopularTrading />
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

  return null;
}

function PortfolioContainerWithProvider() {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });

  return (
    <HomeTokenListProviderMirrorWrapper accountId={account?.id ?? ''}>
      <PortfolioContainer />
    </HomeTokenListProviderMirrorWrapper>
  );
}
PortfolioContainerWithProvider.displayName = 'PortfolioContainerWithProvider';

export { PortfolioContainerWithProvider };
