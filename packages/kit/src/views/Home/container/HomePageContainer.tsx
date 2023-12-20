import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { RefreshControl, useWindowDimensions } from 'react-native';
import { YStack } from 'tamagui';

import { Page, Tab, XStack } from '@onekeyhq/components';
import { getTokens } from '@onekeyhq/components/src/hooks';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorActiveAccount,
  AccountSelectorProvider,
  AccountSelectorProviderMirror,
  AccountSelectorTrigger,
  AccountSelectorTriggerHome,
} from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EOnboardingPages } from '../../Onboarding/router/type';

import { DefiListContainer } from './DefiListContainer';
import { NFTListContainer } from './NFTListContainer';
import { TokenListContainerWithProvider } from './TokenListContainer';
import { TxHistoryListContainer } from './TxHistoryContainer';
import { WalletActionsContainer } from './WalletActionsContainer';

function HomePage() {
  const screenWidth = useWindowDimensions().width;
  const sideBarWidth = getTokens().size.sideBarWidth.val;
  const intl = useIntl();

  const onRefresh = useCallback(() => {
    // tabsViewRef?.current?.setRefreshing(true);
  }, []);

  const tabs = useMemo(
    () => [
      {
        title: intl.formatMessage({
          id: 'asset__tokens',
        }),
        page: memo(TokenListContainerWithProvider, () => true),
      },
      {
        title: intl.formatMessage({
          id: 'asset__collectibles',
        }),
        page: memo(NFTListContainer, () => true),
      },
      {
        title: intl.formatMessage({
          id: 'transaction__history',
        }),
        page: memo(TxHistoryListContainer, () => true),
      },
      {
        title: 'Defi',
        page: memo(DefiListContainer, () => true),
      },
    ],
    [intl],
  );

  const renderHeaderView = useCallback(
    () => (
      <XStack justifyContent="space-between" alignItems="center" px="$2">
        <YStack>
          <AccountSelectorTrigger num={0} />
          <AccountSelectorActiveAccount num={0} />
        </YStack>
        <WalletActionsContainer />
      </XStack>
    ),
    [],
  );

  const navigation = useAppNavigation();
  const navigateOnboardingModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.GetStarted,
    });
  }, [navigation]);

  useMemo(() => {
    navigateOnboardingModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const headerTitle = useCallback(
    () => (
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.home,
          sceneUrl: '',
        }}
      >
        <AccountSelectorTriggerHome num={0} />
      </AccountSelectorProviderMirror>
    ),
    [],
  );

  return useMemo(
    () => (
      <Page>
        <Page.Header headerTitle={headerTitle} />
        <Page.Body alignItems="center">
          <Tab
            // @ts-expect-error
            data={tabs}
            ListHeaderComponent={<>{renderHeaderView()}</>}
            initialScrollIndex={0}
            stickyHeaderIndices={[1]}
            $md={{
              width: '100%',
            }}
            $gtMd={{
              width: screenWidth - sideBarWidth - 150,
              maxWidth: 1024,
            }}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          />
        </Page.Body>
      </Page>
    ),
    [headerTitle, tabs, renderHeaderView, screenWidth, sideBarWidth, onRefresh],
  );
}

function HomePageContainer() {
  return (
    <AccountSelectorProvider
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HomePage />
    </AccountSelectorProvider>
  );
}

export { HomePageContainer };
