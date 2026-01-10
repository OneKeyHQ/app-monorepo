import { useCallback, useMemo } from 'react';

import { Page, XStack, YStack, useMedia, useTheme } from '@onekeyhq/components';
import { UniversalSearchInput } from '@onekeyhq/kit/src/components/TabPageHeader/UniversalSearchInput';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';
import { HistoryIconButton } from '../../views/Discovery/pages/components/HistoryIconButton';
import { HomeTokenListProviderMirror } from '../../views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { AccountSelectorProviderMirror } from '../AccountSelector';

import {
  GiftAction,
  WalletConnectionForWeb,
  WalletConnectionGroup,
} from './components';
import { HeaderNotificationIconButton } from './components/HeaderNotificationIconButton';
import { DiscoveryHeaderSegment, HeaderLeft } from './HeaderLeft';
import { HeaderMDSearch } from './HeaderMDSearch';
import { HeaderRight } from './HeaderRight';
import { HeaderTitle } from './HeaderTitle';
import { MDHeader } from './MDHeader';
import { UrlAccountPageHeader } from './urlAccountPageHeader';

import type { ITabPageHeaderProp } from './type';

export { DiscoveryHeaderSegment };

function InPageHeader({
  tabRoute,
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
}) {
  const item = useMemo(() => {
    if (
      tabRoute === ETabRoutes.Home &&
      sceneName !== EAccountSelectorSceneName.homeUrlAccount
    ) {
      return <WalletConnectionGroup tabRoute={tabRoute} />;
    }
    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      return <UrlAccountPageHeader />;
    }
  }, [sceneName, tabRoute]);
  return (
    <XStack px="$5" pt="$5" pb="$2.5" bg="$bgApp" borderRadius="$4">
      {item}
    </XStack>
  );
}

function BaseDesktopTabPageHeader({
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
      <InPageHeader tabRoute={tabRoute} sceneName={sceneName} />
    </>
  );
}

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
  const media = useMedia();

  if (media.md || platformEnv.isNative) {
    return (
      <MDHeader
        tabRoute={tabRoute}
        sceneName={sceneName}
        hideSearch={hideSearch}
        selectedHeaderTab={selectedHeaderTab}
        renderCustomHeaderRightItems={renderCustomHeaderRightItems}
      />
    );
  }

  return (
    <BaseDesktopTabPageHeader
      tabRoute={tabRoute}
      sceneName={sceneName}
      hideSearch={hideSearch}
      selectedHeaderTab={selectedHeaderTab}
      customHeaderRightItems={customHeaderRightItems}
      customHeaderLeftItems={customHeaderLeftItems}
      hideHeaderLeft={hideHeaderLeft}
      renderCustomHeaderRightItems={renderCustomHeaderRightItems}
    />
  );
}
