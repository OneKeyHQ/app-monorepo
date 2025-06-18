import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, Stack, XStack, YStack } from '@onekeyhq/components';
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
import { ProviderJotaiContextMarketV2 } from '../../../states/jotai/contexts/marketV2';

import { InformationTabs, SwapPanel, TokenDetailHeader } from './components';
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

        <XStack flex={1}>
          <YStack flex={1}>
            <Stack flex={1}>
              <TradingView
                mode="realtime"
                identifier="binance"
                baseToken={tokenDetail?.symbol ?? ''}
                targetToken="USDT"
                tokenAddress={tokenAddress}
                networkId={networkId}
                onLoadEnd={() => {}}
              />
            </Stack>

            <Stack h={300}>
              <InformationTabs
                tokenAddress={tokenAddress}
                networkId={networkId}
              />
            </Stack>
          </YStack>

          <Stack w="$100">
            <SwapPanel tokenDetail={tokenDetail} networkId={networkId} />

            <TokenActivityOverview tokenDetail={tokenDetail} />
          </Stack>
        </XStack>
      </Page.Body>
    </Page>
  );
}

function MarketDetailWithProvider(
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
      <ProviderJotaiContextMarketV2>
        <MarketDetail {...props} />
      </ProviderJotaiContextMarketV2>
    </AccountSelectorProviderMirror>
  );
}

export { MarketDetailWithProvider };
