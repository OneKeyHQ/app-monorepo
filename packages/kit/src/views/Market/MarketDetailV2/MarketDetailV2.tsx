import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, XStack, useMedia } from '@onekeyhq/components';
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
import { ProviderJotaiContextMarketV2 } from '../../../states/jotai/contexts/marketV2';

import { useMarketDetail } from './hooks/useMarketDetail';
import { DesktopLayout } from './layouts/DesktopLayout';
import { MobileLayout } from './layouts/MobileLayout';

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

  const media = useMedia();

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.market}
        tabRoute={ETabRoutes.Market}
        customHeaderLeftItems={customHeaderLeft}
      />
      <Page.Body>
        {media.gtMd ? (
          <DesktopLayout
            tokenAddress={tokenAddress}
            networkId={networkId}
            tokenDetail={tokenDetail}
          />
        ) : (
          <MobileLayout
            tokenAddress={tokenAddress}
            networkId={networkId}
            tokenDetail={tokenDetail}
          />
        )}
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
