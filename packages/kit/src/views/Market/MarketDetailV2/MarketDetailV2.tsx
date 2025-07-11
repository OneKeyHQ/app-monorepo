import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, XStack, useMedia } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
import { TabPageHeader } from '../../../components/TabPageHeader';
import { HeaderLeftCloseButton } from '../../../components/TabPageHeader/HeaderLeft';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';

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
    </XStack>
  );

  const media = useMedia();

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
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
      <MarketWatchListProviderMirrorV2
        storeName={EJotaiContextStoreNames.marketWatchListV2}
      >
        <MarketDetail {...props} />
      </MarketWatchListProviderMirrorV2>
    </AccountSelectorProviderMirror>
  );
}

export { MarketDetailV2 };
