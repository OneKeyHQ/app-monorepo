import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { Animated, Easing } from 'react-native';

import { Alert, Icon, Page, Stack, Tab, YStack } from '@onekeyhq/components';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { getEnabledNFTNetworkIds } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { useNetInfo } from '@onekeyhq/shared/src/modules3rdParty/@react-native-community/netinfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { EmptyAccount, EmptyWallet } from '../../../components/Empty';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { UpdateReminder } from '../../../components/UpdateReminder';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { HomeFirmwareUpdateReminder } from '../../FirmwareUpdate/components/HomeFirmwareUpdateReminder';
import HomeSelector from '../components/HomeSelector';
import { HomeSupportedWallet } from '../components/HomeSupportedWallet';
import useHomePageWidth from '../hooks/useHomePageWidth';

import { HomeHeaderContainer } from './HomeHeaderContainer';
import { NFTListContainerWithProvider } from './NFTListContainer';
import { TokenListContainerWithProvider } from './TokenListContainer';
import { TxHistoryListContainerWithProvider } from './TxHistoryContainer';
import WalletContentWithAuth from './WalletContentWithAuth';

let CONTENT_ITEM_WIDTH: Animated.Value | undefined;

export function HomePageView({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onPressHide,
  sceneName,
}: {
  onPressHide?: () => void;
  sceneName: EAccountSelectorSceneName;
}) {
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
    activeAccount: {
      account,
      accountName,
      network,
      deriveInfo,
      wallet,
      ready,
      device,
    },
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

  const { isInternetReachable } = useNetInfo();

  const isNFTEnabled =
    vaultSettings?.NFTEnabled &&
    getEnabledNFTNetworkIds().includes(network?.id ?? '');
  const isRequiredValidation = vaultSettings?.validationRequired;
  const softwareAccountDisabled = vaultSettings?.softwareAccountDisabled;
  const supportedDeviceTypes = vaultSettings?.supportedDeviceTypes;
  const watchingAccountEnabled = vaultSettings?.watchingAccountEnabled;

  const tabs = useMemo(
    () =>
      [
        {
          title: intl.formatMessage({
            id: ETranslations.global_crypto,
          }),
          page: memo(TokenListContainerWithProvider, () => true),
        },
        isNFTEnabled
          ? {
              title: intl.formatMessage({
                id: ETranslations.global_nft,
              }),
              page: memo(NFTListContainerWithProvider, () => true),
            }
          : null,
        // {
        //   title: 'Defi',
        //   page: memo(DefiListContainer, () => true),
        // },
        {
          title: intl.formatMessage({
            id: ETranslations.global_history,
          }),
          page: memo(TxHistoryListContainerWithProvider, () => true),
        },
      ].filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [intl, account?.id, network?.id, isNFTEnabled],
  );

  const onRefresh = useCallback(() => {
    appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
  }, []);

  const renderTabs = useCallback(
    () => (
      <Tab
        disableRefresh={!platformEnv.isNative}
        data={tabs}
        ListHeaderComponent={<HomeHeaderContainer />}
        initialScrollIndex={0}
        initialHeaderHeight={220}
        contentItemWidth={CONTENT_ITEM_WIDTH}
        contentWidth={screenWidth}
        showsVerticalScrollIndicator={false}
        onRefresh={onRefresh}
      />
    ),
    [tabs, screenWidth, onRefresh],
  );

  useEffect(() => {
    void Icon.prefetch('CloudOffOutline');
  }, []);

  const renderHomePageContent = useCallback(() => {
    if (
      (softwareAccountDisabled &&
        accountUtils.isHdWallet({
          walletId: wallet?.id ?? '',
        })) ||
      (supportedDeviceTypes &&
        device?.deviceType &&
        !supportedDeviceTypes.includes(device?.deviceType))
    ) {
      return (
        <HomeSupportedWallet
          supportedDeviceTypes={supportedDeviceTypes}
          watchingAccountEnabled={watchingAccountEnabled}
        />
      );
    }

    if (!account) {
      return (
        <YStack height="100%">
          <HomeSelector padding="$5" />
          <Stack flex={1} justifyContent="center">
            <EmptyAccount
              autoCreateAddress
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
    softwareAccountDisabled,
    wallet?.id,
    supportedDeviceTypes,
    device?.deviceType,
    account,
    isRequiredValidation,
    renderTabs,
    watchingAccountEnabled,
    accountName,
    network?.name,
    network?.id,
    deriveInfo?.labelKey,
    deriveInfo?.label,
    intl,
  ]);

  const renderHomePage = useCallback(() => {
    if (!ready) {
      return <TabPageHeader showHeaderRight sceneName={sceneName} />;
    }

    let content = (
      <Stack h="100%" justifyContent="center">
        <EmptyWallet />
      </Stack>
    );

    if (wallet) {
      content = renderHomePageContent();
      // This is a temporary hack solution, need to fix the layout of headerLeft and headerRight
    }
    return (
      <>
        <TabPageHeader showHeaderRight sceneName={sceneName} />
        <Page.Body>
          {isInternetReachable ? null : (
            <Alert
              type="critical"
              icon="CloudOffOutline"
              title={intl.formatMessage({
                id: ETranslations.feedback_you_are_offline,
              })}
              closable={false}
              fullBleed
            />
          )}
          {
            // The upgrade reminder does not need to be displayed on the Url Account page
            sceneName === EAccountSelectorSceneName.home ? (
              <>
                <UpdateReminder />
                <HomeFirmwareUpdateReminder />
              </>
            ) : null
          }
          {content}
        </Page.Body>
      </>
    );
  }, [
    ready,
    wallet,
    sceneName,
    isInternetReachable,
    intl,
    renderHomePageContent,
  ]);

  return useMemo(
    () => <Page fullPage>{renderHomePage()}</Page>,
    [renderHomePage],
  );
}
