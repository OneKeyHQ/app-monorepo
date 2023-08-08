import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type { ForwardRefHandle } from '@onekeyhq/app/src/views/NestedTabView/NestedTabView';
import {
  Box,
  Center,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import {
  useActiveWalletAccount,
  useAppSelector,
} from '@onekeyhq/kit/src/hooks/redux';
import RefreshLightningNetworkToken from '@onekeyhq/kit/src/views/LightningNetwork/RefreshLightningNetworkToken';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';
import { isLightningNetworkByNetworkId } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import IdentityAssertion from '../../components/IdentityAssertion';
import { OneKeyPerfTraceLog } from '../../components/OneKeyPerfTraceLog';
import Protected, { ValidationFields } from '../../components/Protected';
import { useAllNetworksAccountSelectModalShow } from '../../hooks/useAllNetwoks';
import { useHtmlPreloadSplashLogoRemove } from '../../hooks/useHtmlPreloadSplashLogoRemove';
import { useOnboardingRequired } from '../../hooks/useOnboardingRequired';
import { setHomeTabName } from '../../store/reducers/status';
import { GuideToPushFirstTimeCheck } from '../PushNotification/GuideToPushFirstTime';
import { TxHistoryListView } from '../TxHistory/TxHistoryListView';

import AccountInfo, {
  FIXED_HORIZONTAL_HEDER_HEIGHT,
  FIXED_VERTICAL_HEADER_HEIGHT,
} from './AccountInfo';
import AssetsList from './AssetsList';
import { BottomView } from './BottomView';
import NFTList from './NFT/NFTList';
import ToolsPage from './Tools';
import { WalletHomeTabEnum } from './type';

const AccountHeader = () => <AccountInfo />;

// HomeTabs
const WalletTabs: FC = () => {
  const intl = useIntl();
  const ref = useRef<ForwardRefHandle>(null);
  const currentIndexRef = useRef<number>(0);
  const { screenWidth } = useUserDevice();
  const isVerticalLayout = useIsVerticalLayout();
  const homeTabName = useAppSelector((s) => s.status.homeTabName);
  const { wallet, network, accountId, networkId, walletId } =
    useActiveWalletAccount();
  const [refreshing, setRefreshing] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout>>();

  const tokensTab = useMemo(
    () => (
      <Tabs.Tab
        name={WalletHomeTabEnum.Tokens}
        label={intl.formatMessage({ id: 'asset__tokens' })}
        key={WalletHomeTabEnum.Tokens}
      >
        <>
          <AssetsList
            walletId={walletId}
            accountId={accountId}
            networkId={networkId}
            ListFooterComponent={<Box h={6} />}
            limitSize={10}
            renderDefiList
          />
          <OneKeyPerfTraceLog name="App RootTabHome AssetsList render" />
          <GuideToPushFirstTimeCheck />
        </>
      </Tabs.Tab>
    ),
    [accountId, intl, networkId, walletId],
  );

  const nftTab = useMemo(
    () => (
      <Tabs.Tab
        name={WalletHomeTabEnum.Collectibles}
        label={intl.formatMessage({ id: 'asset__collectibles' })}
        key={WalletHomeTabEnum.Collectibles}
      >
        <NFTList />
      </Tabs.Tab>
    ),
    [intl],
  );

  const historyTab = useMemo(
    () => (
      <Tabs.Tab
        name={WalletHomeTabEnum.History}
        label={intl.formatMessage({ id: 'transaction__history' })}
        key={WalletHomeTabEnum.History}
      >
        <TxHistoryListView
          accountId={accountId}
          networkId={networkId}
          isHomeTab
        />
      </Tabs.Tab>
    ),
    [accountId, networkId, intl],
  );

  const toolsTab = useMemo(
    () => (
      <Tabs.Tab
        name={WalletHomeTabEnum.Tools}
        label={intl.formatMessage({ id: 'form__tools' })}
        key={WalletHomeTabEnum.Tools}
      >
        <ToolsPage />
      </Tabs.Tab>
    ),
    [intl],
  );

  const usedTabs = useMemo(() => {
    const defaultTabs = [
      {
        name: WalletHomeTabEnum.Tokens,
        tab: tokensTab,
      },
      {
        name: WalletHomeTabEnum.Collectibles,
        tab: nftTab,
      },
      {
        name: WalletHomeTabEnum.History,
        tab: historyTab,
      },
      {
        name: WalletHomeTabEnum.Tools,
        tab: toolsTab,
      },
    ];
    return defaultTabs.filter((t) => {
      if (t.name === WalletHomeTabEnum.Collectibles) {
        return !network?.settings.hiddenNFTTab;
      }
      if (t.name === WalletHomeTabEnum.History) {
        return !isAllNetworks(networkId);
      }
      if (t.name === WalletHomeTabEnum.Tools) {
        return !network?.settings?.hiddenToolTab;
      }
      return true;
    });
  }, [network?.settings, networkId, tokensTab, nftTab, historyTab, toolsTab]);

  const getHomeTabNameByIndex = useCallback(
    (index: number) => usedTabs[index]?.name,
    [usedTabs],
  );

  const getHomeTabIndex = useCallback(
    (tabName: string | undefined) => {
      const index = usedTabs.findIndex((tab) => tab.name === tabName);
      return index === -1 ? 0 : index;
    },
    [usedTabs],
  );

  const onIndexChange = useCallback(
    (index: number) => {
      currentIndexRef.current = index;
      if (timer.current) clearTimeout(timer.current);

      let intervalTime = 0;
      if (platformEnv.isNativeAndroid) {
        intervalTime = 500;
      }

      // Android animation redux causes ui stuttering
      timer.current = setTimeout(() => {
        debugLogger.common.info('setHomeTabIndex', index);
        backgroundApiProxy.dispatch(
          setHomeTabName(getHomeTabNameByIndex(index)),
        );
      }, intervalTime);
    },
    [getHomeTabNameByIndex],
  );

  const setIndex = useDebouncedCallback(
    (index: number) => {
      ref.current?.setPageIndex?.(index);
    },
    1000,
    {
      leading: false,
      trailing: true,
      maxWait: 1000,
    },
  );

  useEffect(() => {
    const idx = getHomeTabIndex(homeTabName);
    if (idx === currentIndexRef.current) return;
    setIndex(idx);
  }, [homeTabName, getHomeTabIndex, setIndex]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    backgroundApiProxy.serviceOverview.refreshCurrentAccount().finally(() => {
      setTimeout(() => setRefreshing(false), 50);
    });
  }, []);

  const tabContents = useMemo(
    () => usedTabs.map((t) => t.tab).filter(Boolean),
    [usedTabs],
  );

  const isLightningNetwork = useMemo(
    () => isLightningNetworkByNetworkId(networkId),
    [networkId],
  );

  const walletTabsContainer = (
    <Tabs.Container
      // IMPORTANT: key is used to force re-render when the tab is changed
      // otherwise android app will crash when tabs are changed
      key={platformEnv.isNativeAndroid ? `${tabContents.length}` : undefined}
      canOpenDrawer
      initialTabName={homeTabName}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onIndexChange={onIndexChange}
      onStartChange={() => {
        if (timer.current) clearTimeout(timer.current);
      }}
      renderHeader={AccountHeader}
      headerHeight={
        isVerticalLayout
          ? FIXED_VERTICAL_HEADER_HEIGHT
          : FIXED_HORIZONTAL_HEDER_HEIGHT
      }
      ref={ref}
      containerStyle={{
        maxWidth: MAX_PAGE_CONTAINER_WIDTH,
        // reduce the width on iPad, sidebar's width is 244
        width: isVerticalLayout ? screenWidth : screenWidth - 224,
        marginHorizontal: 'auto', // Center align vertically
        alignSelf: 'center',
        flex: 1,
      }}
    >
      {tabContents}
    </Tabs.Container>
  );

  if (!wallet) return null;

  if (network?.settings.validationRequired) {
    return (
      <Center w="full" h="full">
        <Protected
          walletId={wallet.id}
          networkId={network.id}
          field={ValidationFields.Account}
          placeCenter={!platformEnv.isNative}
          subTitle={intl.formatMessage(
            {
              id: 'title__password_verification_is_required_to_view_account_details_on_str',
            },
            { '0': network.name },
          )}
          checkIsNeedPassword={
            isLightningNetwork
              ? () =>
                  backgroundApiProxy.serviceLightningNetwork.checkAuth({
                    networkId,
                    accountId,
                  })
              : undefined
          }
        >
          {(password) => (
            <>
              <RefreshLightningNetworkToken
                accountId={accountId}
                password={password}
                networkId={network.id}
              />
              {walletTabsContainer}
            </>
          )}
        </Protected>
      </Center>
    );
  }
  return walletTabsContainer;
};

const Wallet = () => {
  useOnboardingRequired(true);
  useHtmlPreloadSplashLogoRemove();
  useAllNetworksAccountSelectModalShow();

  return (
    <>
      <Box flex={1}>
        <IdentityAssertion>
          <WalletTabs />
        </IdentityAssertion>
      </Box>
      <BottomView />
    </>
  );
};
Wallet.displayName = 'HomeTabWallet';

export default Wallet;
