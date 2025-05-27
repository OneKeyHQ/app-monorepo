import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, XStack } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  type ETabMarketRoutes,
  ETabRoutes,
  type ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketTokenDetail as IMarketTokenDetailV2 } from '@onekeyhq/shared/types/marketV2';

import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '../../../components/AccountSelector';
import { NetworkSelectorTriggerHome } from '../../../components/AccountSelector/NetworkSelectorTrigger';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { HeaderLeftCloseButton } from '../../../components/TabPageHeader/HeaderLeft';
import { MarketWatchListProviderMirror } from '../MarketWatchListProviderMirror';

import { SwapPanel, TokenDetailHeader } from './components';
import { TokenActivityOverview } from './components/TokenActivityOverview';
import { useMarketDetail } from './hooks/useMarketDetail';

function MarketDetail({
  route: _route,
}: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetail>) {
  // TODO: new route params
  // const { token: coinGeckoId } = route.params;

  const { tokenDetail }: { tokenDetail: IMarketTokenDetailV2 | undefined } =
    useMarketDetail({
      tokenAddress: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
      networkId: 'evm--1',
    });

  const customHeaderLeft = (
    <XStack gap="$3" ai="center">
      <HeaderLeftCloseButton />
      <AccountSelectorTriggerHome num={0} />
      <NetworkSelectorTriggerHome
        num={0}
        recordNetworkHistoryEnabled
        hideOnNoAccount
      />
    </XStack>
  );

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.market}
        tabRoute={ETabRoutes.Market}
        customHeaderLeftItems={customHeaderLeft}
      />
      <Page.Body>
        <TokenDetailHeader tokenDetail={tokenDetail} />
        <TokenActivityOverview tokenDetail={tokenDetail} />
        <SwapPanel tokenDetail={tokenDetail} networkId="evm--1" />
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
