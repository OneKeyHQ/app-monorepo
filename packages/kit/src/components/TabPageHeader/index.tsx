import { useCallback } from 'react';

import {
  Page,
  View,
  XStack,
  YStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import { UniversalSearchInput } from '@onekeyhq/kit/src/components/TabPageHeader/UniversalSearchInput';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';
import { HistoryIconButton } from '../../views/Discovery/pages/components/HistoryIconButton';
import { HomeTokenListProviderMirror } from '../../views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { AccountSelectorProviderMirror } from '../AccountSelector';

import { GiftAction, WalletConnectionForWeb } from './components';
import { HeaderNotificationIconButton } from './components/HeaderNotificationIconButton';
import { DiscoveryHeaderSegment, HeaderLeft } from './HeaderLeft';
import { HeaderMDSearch } from './HeaderMDSearch';
import { HeaderRight, SelectorTrigger } from './HeaderRight';
import { HeaderTitle } from './HeaderTitle';

import type { ITabPageHeaderProp } from './type';

export { DiscoveryHeaderSegment };

export function TabPageHeader({
  sceneName,
  tabRoute,
  selectedHeaderTab,
  renderCustomHeaderRightItems,
  customHeaderRightItems,
  customHeaderLeftItems,
  hideSearch = false,
  hideHeaderLeft = false,
}: ITabPageHeaderProp) {
  const renderHeaderLeft = useCallback(
    () => (
      <HeaderLeft
        selectedHeaderTab={selectedHeaderTab}
        sceneName={sceneName}
        tabRoute={tabRoute}
        customHeaderLeftItems={customHeaderLeftItems}
      />
    ),
    [selectedHeaderTab, sceneName, tabRoute, customHeaderLeftItems],
  );

  const { config } = useAccountSelectorContextData();

  const renderHeaderRight = useCallback(
    () =>
      config ? (
        <HomeTokenListProviderMirror>
          <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
            <HeaderRight
              selectedHeaderTab={selectedHeaderTab}
              sceneName={sceneName}
              tabRoute={tabRoute}
              customHeaderRightItems={customHeaderRightItems}
              renderCustomHeaderRightItems={renderCustomHeaderRightItems}
            />
          </AccountSelectorProviderMirror>
        </HomeTokenListProviderMirror>
      ) : null,
    [
      config,
      selectedHeaderTab,
      sceneName,
      tabRoute,
      customHeaderRightItems,
      renderCustomHeaderRightItems,
    ],
  );

  const renderHeaderTitle = useCallback(
    () => <HeaderTitle sceneName={sceneName} />,
    [sceneName],
  );

  const { gtMd } = useMedia();
  const theme = useTheme();

  const renderUniversalSearchInput = useCallback(
    () => <UniversalSearchInput />,
    [],
  );

  const renderDesktopModeRightButtons = useCallback(() => {
    if (tabRoute === ETabRoutes.Perp && customHeaderRightItems) {
      return (
        <>
          {customHeaderRightItems}
          <YStack pl="$5">
            <HeaderNotificationIconButton testID="header-right-notification" />
          </YStack>
        </>
      );
    }
    return (
      <>
        {tabRoute === ETabRoutes.WebviewPerpTrade ? (
          <WalletConnectionForWeb tabRoute={tabRoute} />
        ) : null}
        {tabRoute === ETabRoutes.Earn ? (
          <XStack px="$5">
            <GiftAction copyAsUrl />
          </XStack>
        ) : null}
        {tabRoute === ETabRoutes.Discovery ? (
          <XStack px="$5">
            <HistoryIconButton />
          </XStack>
        ) : null}
        <HeaderNotificationIconButton testID="header-right-notification" />
      </>
    );
  }, [customHeaderRightItems, tabRoute]);

  const renderHeaderLeftInHomeRouter = useCallback(() => {
    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      return renderHeaderLeft();
    }
    return null;
  }, [renderHeaderLeft, sceneName]);

  if (platformEnv.isWebDappMode) {
    if (gtMd) {
      return (
        <Page.Header
          headerTitleAlign="center"
          headerStyle={{ backgroundColor: theme.bgSubdued.val }}
          headerTitle={renderHeaderTitle}
          headerRight={renderHeaderRight}
          headerLeft={renderHeaderLeft}
        />
      );
    }
    return (
      <>
        <Page.Header
          headerTitleAlign="left"
          headerTitle={renderHeaderTitle}
          headerRight={renderHeaderRight}
          headerLeft={renderHeaderLeft}
        />
        {!hideSearch ? (
          <HeaderMDSearch tabRoute={tabRoute} sceneName={sceneName} />
        ) : null}
      </>
    );
  }

  if (gtMd) {
    return (
      <>
        <Page.Header
          headerShown
          headerTitleAlign="center"
          headerStyle={{ backgroundColor: theme.bgSubdued.val }}
          headerTitle={renderUniversalSearchInput}
          headerRight={renderDesktopModeRightButtons}
          headerLeft={
            tabRoute === ETabRoutes.Home
              ? renderHeaderLeftInHomeRouter
              : undefined
          }
        />
        {tabRoute === ETabRoutes.Home &&
        sceneName !== EAccountSelectorSceneName.homeUrlAccount ? (
          <XStack px="$5" pt="$5" pb="$2.5" bg="$bgApp" borderRadius="$4">
            {hideHeaderLeft ? undefined : renderHeaderLeft()}
          </XStack>
        ) : null}
        {sceneName === EAccountSelectorSceneName.homeUrlAccount ? (
          <XStack px="$5" pt="$5" pb="$2.5" bg="$bgApp" borderRadius="$4">
            {renderHeaderTitle()}
          </XStack>
        ) : null}
      </>
    );
  }
  return (
    <>
      <Page.Header headerShown={false} />
      {tabRoute === ETabRoutes.Home ||
      tabRoute === ETabRoutes.Discovery ||
      tabRoute === ETabRoutes.Earn ||
      tabRoute === ETabRoutes.Perp ? (
        <>
          <XStack
            alignItems="center"
            justifyContent="space-between"
            px="$5"
            h="$11"
          >
            <View>
              <HeaderLeft
                selectedHeaderTab={selectedHeaderTab}
                sceneName={sceneName}
                tabRoute={tabRoute}
                customHeaderLeftItems={customHeaderLeftItems}
              />
            </View>
            <View>
              <HeaderTitle sceneName={sceneName} />
            </View>
            <XStack flexShrink={1}>
              <HomeTokenListProviderMirror>
                {sceneName !== EAccountSelectorSceneName.homeUrlAccount ? (
                  <HeaderRight
                    selectedHeaderTab={selectedHeaderTab}
                    sceneName={sceneName}
                    tabRoute={tabRoute}
                    customHeaderRightItems={customHeaderRightItems}
                    renderCustomHeaderRightItems={renderCustomHeaderRightItems}
                  />
                ) : (
                  <SelectorTrigger />
                )}
              </HomeTokenListProviderMirror>
            </XStack>
          </XStack>

          {!hideSearch ? (
            <HeaderMDSearch tabRoute={tabRoute} sceneName={sceneName} />
          ) : null}
        </>
      ) : null}
    </>
  );
}
