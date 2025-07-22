import { useCallback, useEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/native';

import type {
  IPageNavigationProp,
  IPageScreenProps,
} from '@onekeyhq/components';
import { NavBackButton, Page, XStack, useMedia } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ETabMarketV2Routes,
  ETabRoutes,
  type ITabMarketV2ParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { HeaderLeftCloseButton } from '../../../components/TabPageHeader/HeaderLeft';
import { useTokenDetailActions } from '../../../states/jotai/contexts/marketV2';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';

import { TokenDetailHeader } from './components/TokenDetailHeader/TokenDetailHeader';
import { useAutoRefreshTokenDetail } from './hooks';
import { DesktopLayout } from './layouts/DesktopLayout';
import { MobileLayout } from './layouts/MobileLayout';

function MarketDetail({
  route,
}: IPageScreenProps<ITabMarketV2ParamList, ETabMarketV2Routes.MarketDetail>) {
  const { tokenAddress, networkId } = route.params;
  const media = useMedia();
  const tokenDetailActions = useTokenDetailActions();
  const navigation =
    useNavigation<IPageNavigationProp<ITabMarketV2ParamList>>();

  // Clear all token detail content when unmount
  useEffect(() => {
    const actions = tokenDetailActions.current;
    return () => {
      actions.setTokenDetail(undefined);
      actions.setTokenDetailLoading(false);
      actions.setTokenAddress('');
      actions.setNetworkId('');
    };
  }, [tokenDetailActions]);

  // Start auto-refresh for token details every 5 seconds
  useAutoRefreshTokenDetail({
    tokenAddress,
    networkId,
  });

  const handleBackPress = useCallback(() => {
    navigation.navigate(ETabMarketV2Routes.TabMarket);
  }, [navigation]);

  const customHeaderLeft = useMemo(
    () => (
      <XStack gap="$3" ai="center">
        {platformEnv.isNative ? (
          <HeaderLeftCloseButton />
        ) : (
          <NavBackButton onPress={handleBackPress} />
        )}

        {/* <TokenDetailHeader
          containerProps={{ p: '$0' }}
          showStats={false}
          showMediaAndSecurity={false}
        /> */}
      </XStack>
    ),
    [handleBackPress],
  );

  const customHeaderRight = useMemo(() => null, []);

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Market}
        customHeaderLeftItems={customHeaderRight}
        customHeaderRightItems={customHeaderLeft}
        hideSearch={!media.gtMd}
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
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
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
