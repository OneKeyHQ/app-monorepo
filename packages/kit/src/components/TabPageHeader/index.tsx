import { useCallback } from 'react';

import { Page, XStack, useMedia, useTheme } from '@onekeyhq/components';
import { UniversalSearchInput } from '@onekeyhq/kit/src/components/TabPageHeader/UniversalSearchInput';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { useAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';
import { HomeTokenListProviderMirror } from '../../views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { AccountSelectorProviderMirror } from '../AccountSelector';

import { HeaderNotificationIconButton } from './components/HeaderNotificationIconButton';
import { DiscoveryHeaderSegment, HeaderLeft } from './HeaderLeft';
import { HeaderMDSearch } from './HeaderMDSearch';
import { HeaderRight } from './HeaderRight';
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

  const renderNotificationRightButton = useCallback(
    () => <HeaderNotificationIconButton testID="header-right-notification" />,
    [],
  );

  if (platformEnv.isWeb) {
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
          headerTitleAlign="center"
          headerStyle={{ backgroundColor: theme.bgSubdued.val }}
          headerTitle={renderUniversalSearchInput}
          headerRight={renderNotificationRightButton}
        />
        {tabRoute === ETabRoutes.Home ? (
          <XStack p="$5" bg="$bgApp" borderRadius="$4">
            {hideHeaderLeft ? undefined : renderHeaderLeft()}
          </XStack>
        ) : null}
      </>
    );
  }
  return (
    <>
      {tabRoute === ETabRoutes.Home || tabRoute === ETabRoutes.Discovery ? (
        <Page.Header
          headerTitleAlign="left"
          headerTitle={renderHeaderTitle}
          headerRight={renderHeaderRight}
          headerLeft={renderHeaderLeft}
        />
      ) : (
        <Page.Header headerShown={false} />
      )}
      {!hideSearch ? (
        <HeaderMDSearch tabRoute={tabRoute} sceneName={sceneName} />
      ) : null}
    </>
  );
}
