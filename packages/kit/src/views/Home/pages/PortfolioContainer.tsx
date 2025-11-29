import { Stack } from '@onekeyhq/components';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { DeFiListView } from '../components/DeFiListView';
import { EarnListView } from '../components/EarnListView';
import { HomeTokenListProviderMirrorWrapper } from '../components/HomeTokenListProvider';
import { PopularTrading } from '../components/PopularTrading';
import { RecentHistory } from '../components/RecentHistory';
import { SupportHub } from '../components/SupportHub';
import { TokenListView } from '../components/TokenListView';
import { Upgrade } from '../components/Upgrade';

function PortfolioContainer() {
  return (
    <Stack>
      <TokenListView />
      <DeFiListView />
      <PopularTrading />
      <EarnListView />
      <Upgrade />
      <SupportHub />
      <RecentHistory />
    </Stack>
  );
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
