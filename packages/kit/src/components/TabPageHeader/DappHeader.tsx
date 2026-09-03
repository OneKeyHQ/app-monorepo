import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { HeaderIconButton, Page, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';

import useAppNavigation from '../../hooks/useAppNavigation';
import { KeylessWebConnectAlertContainer } from '../../provider/Container/KeylessWebConnectAlertContainer';
import {
  useAccountSelectorContextData,
  useActiveAccount,
} from '../../states/jotai/contexts/accountSelector/atoms';
import { HomeTokenListProviderMirror } from '../../views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { getUniversalSearchSource } from '../../views/UniversalSearch/universalSearchSource';
import { AccountSelectorProviderMirror } from '../AccountSelector/AccountSelectorProvider';

import {
  HeaderNotificationIconButton,
  WebHeaderNavigation,
} from './components';
import { WebAccountSelectorTrigger } from './components/WebAccountPanel/WebAccountSelectorTrigger';
import { WebConnectButton } from './components/WebAccountPanel/WebConnectButton';
import { WebSettingsTrigger } from './components/WebAccountPanel/WebSettingsTrigger';
import { HeaderTitle } from './HeaderTitle';

import type { ITabPageHeaderProp } from './type';

// Reference-stable: PageHeader diffs options shallowly before setOptions, so
// a fresh style object every render would re-trigger navigation updates.
const transparentHeaderStyle = { backgroundColor: 'transparent' };

function RightActions({ tabRoute }: { tabRoute: ETabRoutes }) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const {
    activeAccount: { wallet, account },
  } = useActiveAccount({
    num: 0,
  });

  const isWalletConnected = !!wallet && !!account;
  const handleSearchPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.UniversalSearchModal, {
      screen: EUniversalSearchPages.UniversalSearch,
      params: {
        source: getUniversalSearchSource(tabRoute),
      },
    });
  }, [navigation, tabRoute]);

  return (
    <XStack ai="center" gap="$3" $gtMd={{ gap: '$5' }}>
      <HeaderIconButton
        size="medium"
        icon="SearchOutline"
        title={intl.formatMessage({
          id: ETranslations.global_search_everything,
        })}
        onPress={handleSearchPress}
        testID="header-right-search"
      />
      <HeaderNotificationIconButton
        testID="header-right-notification"
        size="medium"
      />
      <KeylessWebConnectAlertContainer />
      {isWalletConnected ? (
        <WebAccountSelectorTrigger tabRoute={tabRoute} />
      ) : (
        <>
          <WebSettingsTrigger />
          <WebConnectButton />
        </>
      )}
    </XStack>
  );
}

export function DappHeader({ sceneName, tabRoute }: ITabPageHeaderProp) {
  const { config } = useAccountSelectorContextData();

  const renderHeaderLeft = useCallback(() => <WebHeaderNavigation />, []);

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
    <>
      <Page.Header
        headerShown
        headerTitleAlign="center"
        headerShadowVisible={false}
        headerStyle={transparentHeaderStyle}
        headerTitle={renderHeaderTitle}
        headerRight={renderHeaderRight}
        headerLeft={renderHeaderLeft}
      />
      <XStack h="$px" bg="$borderSubdued" />
    </>
  );
}
