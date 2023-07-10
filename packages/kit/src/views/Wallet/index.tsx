import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

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
  useStatus,
} from '@onekeyhq/kit/src/hooks/redux';
import RefreshLightningNetworkToken from '@onekeyhq/kit/src/views/LightningNetwork/RefreshLightningNetworkToken';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import IdentityAssertion from '../../components/IdentityAssertion';
import { OneKeyPerfTraceLog } from '../../components/OneKeyPerfTraceLog';
import Protected, { ValidationFields } from '../../components/Protected';
import { useManageNetworks } from '../../hooks';
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
  const { screenWidth } = useUserDevice();
  const isVerticalLayout = useIsVerticalLayout();
  const { homeTabName } = useStatus();
  const { wallet, network, accountId, networkId, walletId } =
    useActiveWalletAccount();
  const { enabledNetworks } = useManageNetworks();
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
    () => usedTabs.findIndex((tab) => tab.name === homeTabName),
    [usedTabs, homeTabName],
  );

  const onIndexChange = useCallback(
    (index: number) => {
      // Android animation redux causes ui stuttering
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        backgroundApiProxy.dispatch(
          setHomeTabName(getHomeTabNameByIndex(index)),
        );
      }, 500);
    },
    [getHomeTabNameByIndex],
  );

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const idx = getHomeTabIndex();

    const setIndex = (index: number) => {
      ref.current?.setPageIndex?.(index);
      onIndexChange(index);
    };

    if (platformEnv.isNativeIOS) {
      setTimeout(() => {
        setIndex(idx);
      });
    } else {
      setIndex(idx);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [homeTabName, onIndexChange, getHomeTabIndex]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    backgroundApiProxy.serviceOverview.refreshCurrentAccount().finally(() => {
      setTimeout(() => setRefreshing(false), 50);
    });
  }, []);

  useEffect(() => {
    onRefresh();
  }, [networkId, accountId, walletId, onRefresh]);

  useEffect(() => {
    if (isAllNetworks(networkId)) {
      onRefresh();
    }
  }, [onRefresh, enabledNetworks, networkId]);

  const tabContents = usedTabs.map((t) => t.tab);

  const walletTabsContainer = (
    <Tabs.Container
      canOpenDrawer
      initialTabName={homeTabName}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onIndexChange={(index: number) => {
        onIndexChange(index);
      }}
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
      {tabContents.filter(Boolean).map((tab) => tab)}
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

export default function Wallet() {
  useOnboardingRequired(true);
  useHtmlPreloadSplashLogoRemove();

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
}
