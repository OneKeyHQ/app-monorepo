import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { RefreshControl } from 'react-native';

import { Page, Stack, Tab, YStack } from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '../../../components/AccountSelector';
import { EmptyAccount, EmptyWallet } from '../../../components/Empty';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { OnboardingOnMount } from '../../Onboarding/components';
import HomeSelector from '../components/HomeSelector';

import { HomeHeaderContainer } from './HomeHeaderContainer';
import { NFTListContainer } from './NFTListContainer';
import { TokenListContainerWithProvider } from './TokenListContainer';
import { TxHistoryListContainer } from './TxHistoryContainer';

function HomePage({ onPressHide }: { onPressHide: () => void }) {
  const intl = useIntl();
  const {
    activeAccount: { account, accountName, network, deriveInfo, wallet, ready },
  } = useActiveAccount({ num: 0 });
  const [isHide, setIsHide] = useState(false);

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
      // {
      //   title: 'Defi',
      //   page: memo(DefiListContainer, () => true),
      // },
      {
        title: intl.formatMessage({
          id: 'transaction__history',
        }),
        page: memo(TxHistoryListContainer, () => true),
      },
    ],
    [intl],
  );

  const headerLeft = useCallback(
    () =>
      isHide ? null : (
        <AccountSelectorProviderMirror
          enabledNum={[0]}
          config={{
            sceneName: EAccountSelectorSceneName.home,
            sceneUrl: '',
          }}
        >
          <AccountSelectorTriggerHome num={0} linkNetwork />
        </AccountSelectorProviderMirror>
      ),
    [isHide],
  );

  const renderHomePage = useCallback(() => {
    if (!ready) return null;
    if (wallet) {
      return (
        <>
          <Page.Header
            headerLeft={headerLeft}
            headerRight={() => (
              <HeaderButtonGroup testID="Wallet-Page-Header-Right">
                <HeaderIconButton icon="PlaceholderOutline" />
                <HeaderIconButton icon="PlaceholderOutline" />
              </HeaderButtonGroup>
            )}
          />
          <Page.Body>
            {/* {process.env.NODE_ENV !== 'production' ? (
              <Button
                onPress={async () => {
                  setIsHide((v) => !v);
                  await timerUtils.wait(1000);
                  onPressHide();
                }}
              >
                home-hide-test
              </Button>
            ) : null} */}
            {account ? (
              <Tab
                data={tabs}
                ListHeaderComponent={<HomeHeaderContainer />}
                initialScrollIndex={0}
                refreshControl={
                  <RefreshControl refreshing={false} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <YStack height="100%">
                <HomeSelector padding="$5" />
                <Stack flex={1} justifyContent="center">
                  <EmptyAccount
                    name={accountName}
                    chain={network?.name ?? ''}
                    type={
                      (deriveInfo?.labelKey
                        ? intl.formatMessage({
                            id: deriveInfo?.labelKey,
                          })
                        : deriveInfo?.label) ?? ''
                    }
                  />
                </Stack>
              </YStack>
            )}
          </Page.Body>
        </>
      );
    }

    return (
      <Page.Body>
        <Stack h="100%" justifyContent="center">
          <EmptyWallet />
        </Stack>
      </Page.Body>
    );
  }, [
    account,
    accountName,
    deriveInfo?.label,
    deriveInfo?.labelKey,
    headerLeft,
    intl,
    network?.name,
    onRefresh,
    ready,
    tabs,
    wallet,
  ]);

  return useMemo(() => <Page>{renderHomePage()}</Page>, [renderHomePage]);
}

function HomePageContainer() {
  const [isHide, setIsHide] = useState(false);
  console.log('HomePageContainer render');

  if (isHide) {
    return null;
  }
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HomePage onPressHide={() => setIsHide((v) => !v)} />
      <OnboardingOnMount />
    </AccountSelectorProviderMirror>
  );
}

export { HomePageContainer };
