import { useCallback, useMemo } from 'react';

import { Page, XStack, YStack, useMedia, useTheme } from '@onekeyhq/components';
import { UniversalSearchInput } from '@onekeyhq/kit/src/components/TabPageHeader/UniversalSearchInput';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useIsAccountSelectorSyncLoading } from '../../states/jotai/contexts/accountSelector';
import { HistoryIconButton } from '../../views/Discovery/pages/components/HistoryIconButton';

import {
  GiftAction,
  WalletConnectionForWeb,
  WalletConnectionGroup,
} from './components';
import { HeaderNotificationIconButton } from './components/HeaderNotificationIconButton';
import { DappHeader } from './DappHeader';
import { DiscoveryHeaderSegment, HeaderLeft } from './HeaderLeft';
import { MDHeader } from './MDHeader';
import { UrlAccountPageHeader } from './urlAccountPageHeader';

import type { ITabPageHeaderProp } from './type';

export { DiscoveryHeaderSegment };

function InPageHeader({
  tabRoute,
  sceneName,
  hasNoUsableWallet,
}: {
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  hasNoUsableWallet?: boolean;
}) {
  const isSyncLoading = useIsAccountSelectorSyncLoading(0);

  const item = useMemo(() => {
    if (
      tabRoute === ETabRoutes.Home &&
      sceneName !== EAccountSelectorSceneName.homeUrlAccount
    ) {
      if (hasNoUsableWallet && !isSyncLoading) {
        return null;
      }
      return <WalletConnectionGroup tabRoute={tabRoute} />;
    }
    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      return <UrlAccountPageHeader />;
    }
  }, [sceneName, tabRoute, hasNoUsableWallet, isSyncLoading]);

  if (!item) {
    return null;
  }

  return (
    <XStack px="$pagePadding" pt="$5" pb="$2.5" bg="$bgApp" borderRadius="$4">
      {item}
    </XStack>
  );
}

function BaseDesktopTabPageHeader({
  sceneName,
  tabRoute,
  selectedHeaderTab,
  customHeaderRightItems,
  customHeaderLeftItems,
  hasNoUsableWallet,
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
      <InPageHeader
        tabRoute={tabRoute}
        sceneName={sceneName}
        hasNoUsableWallet={hasNoUsableWallet}
      />
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
  customToolbarItems,
  hideSearch = false,
  hideHeaderLeft = false,
  headerPx,
  pageScrollPosition,
  hasNoUsableWallet,
}: ITabPageHeaderProp) {
  const media = useMedia();

  if (platformEnv.isWebDappMode) {
    return (
      <DappHeader
        tabRoute={tabRoute}
        sceneName={sceneName}
        hideSearch={hideSearch}
        selectedHeaderTab={selectedHeaderTab}
        customHeaderRightItems={customHeaderRightItems}
        customHeaderLeftItems={customHeaderLeftItems}
        customToolbarItems={customToolbarItems}
        hideHeaderLeft={hideHeaderLeft}
        renderCustomHeaderRightItems={renderCustomHeaderRightItems}
      />
    );
  }

  if (media.md || platformEnv.isNative) {
    return (
      <MDHeader
        tabRoute={tabRoute}
        sceneName={sceneName}
        hideSearch={hideSearch}
        selectedHeaderTab={selectedHeaderTab}
        customHeaderLeftItems={customHeaderLeftItems}
        customHeaderRightItems={customHeaderRightItems}
        renderCustomHeaderRightItems={renderCustomHeaderRightItems}
        headerPx={headerPx}
        pageScrollPosition={pageScrollPosition}
        hasNoUsableWallet={hasNoUsableWallet}
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
      hasNoUsableWallet={hasNoUsableWallet}
    />
  );
}
