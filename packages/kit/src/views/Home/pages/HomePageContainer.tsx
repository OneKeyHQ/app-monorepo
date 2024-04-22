import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { Animated, Easing } from 'react-native';

import { Page, Stack, Tab, YStack } from '@onekeyhq/components';
import DAppConnectExtensionFloatingTrigger from '@onekeyhq/kit/src/views/DAppConnection/components/DAppConnectExtensionFloatingTrigger';
import { getEnabledNFTNetworkIds } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { EmptyAccount, EmptyWallet } from '../../../components/Empty';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { UpdateReminder } from '../../../components/UpdateReminder';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { UrlAccountAutoReplaceHistory } from '../../Landing';
import { OnboardingOnMount } from '../../Onboarding/components';
import HomeSelector from '../components/HomeSelector';
import useHomePageWidth from '../hooks/useHomePageWidth';

import { HomeHeaderContainer } from './HomeHeaderContainer';
import { NFTListContainer } from './NFTListContainer';
import { TokenListContainerWithProvider } from './TokenListContainer';
import { TxHistoryListContainer } from './TxHistoryContainer';
import WalletContentWithAuth from './WalletContentWithAuth';

let CONTENT_ITEM_WIDTH: Animated.Value | undefined;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function HomePage({ onPressHide }: { onPressHide: () => void }) {
  const { screenWidth, pageWidth } = useHomePageWidth();
  if (CONTENT_ITEM_WIDTH == null) {
    CONTENT_ITEM_WIDTH = new Animated.Value(pageWidth);
  }
  useEffect(() => {
    if (!CONTENT_ITEM_WIDTH) {
      return;
    }
    Animated.timing(CONTENT_ITEM_WIDTH, {
      toValue: pageWidth,
      duration: 400,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [pageWidth]);
  const intl = useIntl();
  const {
    activeAccount: { account, accountName, network, deriveInfo, wallet, ready },
  } = useActiveAccount({ num: 0 });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addressType = deriveInfo?.labelKey
    ? intl.formatMessage({
        id: deriveInfo?.labelKey,
      })
    : deriveInfo?.label ?? '';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isHide, setIsHide] = useState(false);

  const vaultSettings = usePromiseResult(
    async () =>
      network
        ? backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId: network?.id ?? '',
          })
        : Promise.resolve(undefined),
    [network],
  ).result;
  const isNFTEnabled =
    vaultSettings?.NFTEnabled &&
    getEnabledNFTNetworkIds().includes(network?.id ?? '');
  const isRequiredValidation = vaultSettings?.validationRequired;

  const tabs = useMemo(
    () =>
      [
        {
          title: intl.formatMessage({
            id: 'asset__tokens',
          }),
          page: memo(TokenListContainerWithProvider, () => true),
        },
        isNFTEnabled
          ? {
              title: intl.formatMessage({
                id: 'asset__collectibles',
              }),
              page: memo(NFTListContainer, () => true),
            }
          : null,
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
      ].filter(Boolean),
    [intl, isNFTEnabled],
  );

  const renderTabs = useCallback(
    () => (
      <Tab
        data={tabs}
        ListHeaderComponent={<HomeHeaderContainer />}
        initialScrollIndex={0}
        contentItemWidth={CONTENT_ITEM_WIDTH}
        contentWidth={screenWidth}
        showsVerticalScrollIndicator={false}
      />
    ),
    [tabs, screenWidth],
  );

  const renderHomePageContent = useCallback(() => {
    if (!account) {
      return (
        <YStack height="100%">
          <UpdateReminder />
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
      );
    }
    if (isRequiredValidation) {
      return (
        <WalletContentWithAuth
          networkId={network?.id ?? ''}
          accountId={account?.id ?? ''}
        >
          <>{renderTabs()}</>
        </WalletContentWithAuth>
      );
    }

    return <>{renderTabs()}</>;
  }, [
    account,
    accountName,
    network?.id,
    network?.name,
    deriveInfo?.labelKey,
    deriveInfo?.label,
    intl,
    isRequiredValidation,
    renderTabs,
  ]);

  const renderHomePage = useCallback(() => {
    if (!ready) return null;
    if (wallet) {
      // This is a temporary hack solution, need to fix the layout of headerLeft and headerRight
      return (
        <>
          <TabPageHeader sceneName={EAccountSelectorSceneName.home} />
          <Page.Body>{renderHomePageContent()}</Page.Body>
        </>
      );
    }

    return (
      <>
        <TabPageHeader sceneName={EAccountSelectorSceneName.home} />
        <Page.Body>
          <Stack h="100%" justifyContent="center">
            <EmptyWallet />
          </Stack>
        </Page.Body>
      </>
    );
  }, [ready, wallet, renderHomePageContent]);

  return useMemo(
    () => <Page skipLoading={platformEnv.isNativeIOS}>{renderHomePage()}</Page>,
    [renderHomePage],
  );
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
      <DAppConnectExtensionFloatingTrigger />
      <OnboardingOnMount />
      <UrlAccountAutoReplaceHistory num={0} />
    </AccountSelectorProviderMirror>
  );
}

export default HomePageContainer;
