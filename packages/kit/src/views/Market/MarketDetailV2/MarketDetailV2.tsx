import { useCallback, useEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/native';

import type {
  IPageNavigationProp,
  IPageScreenProps,
} from '@onekeyhq/components';
import { NavBackButton, Page, XStack, useMedia } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '../../../components/AccountSelector';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { TabPageHeaderContainer } from '../../../components/TabPageHeader/components/TabPageHeaderContainer';
import { HeaderLeftCloseButton } from '../../../components/TabPageHeader/HeaderLeft';
import { useTokenDetailActions } from '../../../states/jotai/contexts/marketV2';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';

import { TokenDetailHeader } from './components/TokenDetailHeader/TokenDetailHeader';
import { useAutoRefreshTokenDetail } from './hooks';
import { DesktopLayout } from './layouts/DesktopLayout';
import { MobileLayout } from './layouts/MobileLayout';

function MarketDetail({
  route,
}: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetailV2>) {
  const { tokenAddress, networkId } = route.params;
  const media = useMedia();
  const tokenDetailActions = useTokenDetailActions();
  const navigation = useNavigation<IPageNavigationProp<ITabMarketParamList>>();

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
    navigation.pop();
  }, [navigation]);

  const customHeaderLeft = useMemo(
    () => (
      <XStack gap="$3" ai="center">
        {platformEnv.isNative ? (
          <>
            <HeaderLeftCloseButton />

            <MarketWatchListProviderMirrorV2
              storeName={EJotaiContextStoreNames.marketWatchListV2}
            >
              <TokenDetailHeader
                containerProps={{ p: '$0' }}
                showStats={false}
                showMediaAndSecurity={false}
              />
            </MarketWatchListProviderMirrorV2>
          </>
        ) : (
          <>
            <NavBackButton onPress={handleBackPress} />
            <AccountSelectorTriggerHome num={0} />
          </>
        )}
      </XStack>
    ),
    [handleBackPress],
  );

  const customHeaderRight = useMemo(() => null, []);

  return (
    <Page>
      {platformEnv.isNative ? (
        <TabPageHeaderContainer>{customHeaderLeft}</TabPageHeaderContainer>
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.Market}
          customHeaderLeftItems={customHeaderLeft}
          customHeaderRightItems={
            platformEnv.isNative ? customHeaderRight : null
          }
          hideSearch={!media.gtMd}
        />
      )}

      <Page.Body>{media.gtLg ? <DesktopLayout /> : <MobileLayout />}</Page.Body>
    </Page>
  );
}

function MarketDetailV2(
  props: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetailV2>,
) {
  useEffect(() => {
    appEventBus.emit(EAppEventBusNames.HideTabBar, true);

    return () => {
      appEventBus.emit(EAppEventBusNames.HideTabBar, false);
    };
  }, []);

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
