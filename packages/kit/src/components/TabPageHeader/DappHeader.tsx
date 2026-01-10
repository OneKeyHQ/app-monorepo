import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  HeaderIconButton,
  Page,
  Popover,
  Tooltip,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
import { HeaderTitle } from './HeaderTitle';

import type { ITabPageHeaderProp } from './type';

function MoreDappAction() {
  const intl = useIntl();
  return (
    <Popover
      title={intl.formatMessage({ id: ETranslations.address_book_menu_title })}
      showHeader={false}
      keepChildrenMounted
      floatingPanelProps={{
        maxWidth: 288,
        width: 288,
        p: 0,
        overflow: 'hidden',
        style: { transformOrigin: 'bottom left' },
      }}
      placement="bottom-end"
      renderTrigger={
        <Tooltip
          placement="bottom"
          renderTrigger={
            <HeaderIconButton
              testID="moreActions"
              title={intl.formatMessage({ id: ETranslations.explore_options })}
              icon="DotGridOutline"
            />
          }
          renderContent={intl.formatMessage({
            id: ETranslations.address_book_menu_title,
          })}
        />
      }
      renderContent={<YStack>123</YStack>}
    />
  );
}

function RightActions({ tabRoute }: { tabRoute: ETabRoutes }) {
  return (
    <XStack ai="center" gap="$2">
      <WalletConnectionForWeb tabRoute={tabRoute} />
      <XStack
        ai="center"
        gap="$2.5"
        px="$1.5"
        py="$1"
        borderRadius="$2"
        bg="$bgStrong"
      >
        <HeaderNotificationIconButton testID="header-right-notification" />
        <MoreDappAction />
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
