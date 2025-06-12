import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, Stack, XStack } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  type ETabMarketV2Routes,
  ETabRoutes,
  type ITabMarketV2ParamList,
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
import { TradingView } from '../../../components/TradingView';
import { MarketWatchListProviderMirror } from '../MarketWatchListProviderMirror';

import { SwapPanel, TokenDetailHeader } from './components';
import { TokenActivityOverview } from './components/TokenActivityOverview';
import { useMarketDetail } from './hooks/useMarketDetail';

function MarketDetail({
  route,
}: IPageScreenProps<ITabMarketV2ParamList, ETabMarketV2Routes.MarketDetail>) {
  const { tokenAddress, networkId } = route.params;

  const { tokenDetail }: { tokenDetail: IMarketTokenDetailV2 | undefined } =
    useMarketDetail({
      tokenAddress,
      networkId,
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
        <TokenDetailHeader tokenDetail={tokenDetail} networkId={networkId} />
        <XStack>
          <TradingView
            mode="realtime"
            identifier="BTCUSDT"
            baseToken="BTC"
            targetToken="USDT"
            onLoadEnd={() => {}}
          />

          <Stack w="$100">
            <SwapPanel tokenDetail={tokenDetail} networkId={networkId} />

            <TokenActivityOverview tokenDetail={tokenDetail} />
          </Stack>
        </XStack>
      </Page.Body>
    </Page>
  );
}

export default function MarketDetailWithProvider(
  props: IPageScreenProps<
    ITabMarketV2ParamList,
    ETabMarketV2Routes.MarketDetail
  >,
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
