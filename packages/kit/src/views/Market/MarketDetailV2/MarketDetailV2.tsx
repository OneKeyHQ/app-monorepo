import type { IPageScreenProps } from '@onekeyhq/components';
import { Page } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  type ETabMarketRoutes,
  ETabRoutes,
  type ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { MarketWatchListProviderMirror } from '../MarketWatchListProviderMirror';

import { SwapPanel, TokenDetailHeader } from './components';
import { useMarketDetail } from './hooks/useMarketDetail';

function MarketDetail({
  route: _route,
}: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetail>) {
  // TODO: new route params
  // const { token: coinGeckoId } = route.params;

  const { tokenDetail } = useMarketDetail({
    tokenAddress: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN',
    networkId: 'sol--101',
  });

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Market}
      />
      <Page.Body>
        <TokenDetailHeader tokenDetail={tokenDetail} />

        <SwapPanel />
      </Page.Body>
    </Page>
  );
}

export default function MarketDetailWithProvider(
  props: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetail>,
) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <MarketWatchListProviderMirror
        storeName={EJotaiContextStoreNames.marketWatchList}
      >
        <MarketDetail {...props} />
      </MarketWatchListProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
