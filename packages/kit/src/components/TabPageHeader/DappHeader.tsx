import { useCallback } from 'react';

import { Page, XStack, useTheme } from '@onekeyhq/components';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { useAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';
import { HomeTokenListProviderMirror } from '../../views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { AccountSelectorProviderMirror } from '../AccountSelector';

import {
  DownloadButton,
  HeaderNotificationIconButton,
  LanguageButton,
  ThemeButton,
  WalletConnectionForWeb,
  WebHeaderNavigation,
} from './components';
import { MoreAction } from './HeaderRight';
import { HeaderTitle } from './HeaderTitle';

import type { ITabPageHeaderProp } from './type';

function RightActions({ tabRoute }: { tabRoute: ETabRoutes }) {
  return (
    <XStack ai="center" gap="$2">
      <WalletConnectionForWeb tabRoute={tabRoute} />
      <XStack ai="center" gap="$2.5" px="$1.5" borderRadius="$2" bg="$bgStrong">
        <HeaderNotificationIconButton testID="header-right-notification" />
        <MoreAction />
        <DownloadButton />
        <LanguageButton />
        <ThemeButton />
      </XStack>
    </XStack>
  );
}

export function DappHeader({ sceneName, tabRoute }: ITabPageHeaderProp) {
  const theme = useTheme();
  const renderHeaderLeft = useCallback(() => <WebHeaderNavigation />, []);
  const { config } = useAccountSelectorContextData();

  const renderHeaderRight = useCallback(
    () =>
      config ? (
        <HomeTokenListProviderMirror>
          <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
            <RightActions tabRoute={tabRoute} />
          </AccountSelectorProviderMirror>
        </HomeTokenListProviderMirror>
      ) : null,
    [config, tabRoute],
  );

  const renderHeaderTitle = useCallback(
    () => <HeaderTitle sceneName={sceneName} />,
    [sceneName],
  );
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
