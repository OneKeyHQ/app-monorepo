import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, XStack, useMedia } from '@onekeyhq/components';
import {
  type ETabMarketV2Routes,
  ETabRoutes,
  type ITabMarketV2ParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '../../../components/AccountSelector';
import { NetworkSelectorTriggerHome } from '../../../components/AccountSelector/NetworkSelectorTrigger';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { HeaderLeftCloseButton } from '../../../components/TabPageHeader/HeaderLeft';
import { ProviderJotaiContextMarketV2 } from '../../../states/jotai/contexts/marketV2';

import { useAutoRefreshTokenDetail } from './hooks';
import { DesktopLayout } from './layouts/DesktopLayout';
import { MobileLayout } from './layouts/MobileLayout';

function MarketDetail({
  route,
}: IPageScreenProps<ITabMarketV2ParamList, ETabMarketV2Routes.MarketDetail>) {
  const { tokenAddress, networkId } = route.params;

  // Start auto-refresh for token details every 5 seconds
  useAutoRefreshTokenDetail({
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
      <Page.Body>{media.gtMd ? <DesktopLayout /> : <MobileLayout />}</Page.Body>
    </Page>
  );
}

function MarketDetailV2(
  props: IPageScreenProps<
    ITabMarketV2ParamList,
    ETabMarketV2Routes.MarketDetail
  >,
) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.market,
        sceneUrl: ETabRoutes.Market,
      }}
      enabledNum={[0]}
    >
      <ProviderJotaiContextMarketV2>
        <MarketDetail {...props} />
      </ProviderJotaiContextMarketV2>
    </AccountSelectorProviderMirror>
  );
}

export { MarketDetailV2 };
