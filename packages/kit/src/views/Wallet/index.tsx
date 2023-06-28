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
import {
  getStatus,
  useActiveWalletAccount,
  useStatus,
} from '@onekeyhq/kit/src/hooks/redux';
import RefreshLightningNetworkToken from '@onekeyhq/kit/src/views/LightningNetwork/RefreshLightningNetworkToken';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import IdentityAssertion from '../../components/IdentityAssertion';
import { OneKeyPerfTraceLog } from '../../components/OneKeyPerfTraceLog';
import Protected, { ValidationFields } from '../../components/Protected';
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
import { generateHomeTabIndexMap, getHomeTabNameByIndex } from './helper';
import NFTList from './NFT/NFTList';
import ToolsPage from './Tools';
import { WalletHomeTabEnum } from './type';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

const AccountHeader = () => <AccountInfo />;
// const AccountHeader = () => null;

// HomeTabs
const WalletTabs: FC = () => {
  const intl = useIntl();
  const ref = useRef<ForwardRefHandle>(null);
  const { screenWidth } = useUserDevice();
  const isVerticalLayout = useIsVerticalLayout();
  const { homeTabName } = useStatus();
  const { wallet, account, network, accountId, networkId, walletId } =
    useActiveWalletAccount();
  const [refreshing, setRefreshing] = useState(false);

  const HomeTabIndexMap = useMemo(
    () => generateHomeTabIndexMap(network),
    [network],
  );
  const defaultIndexRef = useRef<number>(
    HomeTabIndexMap[getStatus().homeTabName as WalletHomeTabEnum] ?? 0,
  );
  const onIndexChange = useCallback(
    (index: number) => {
      backgroundApiProxy.dispatch(
        setHomeTabName(
          getHomeTabNameByIndex({
            network,
            index,
          }),
        ),
      );
    },
    [network],
  );

  useEffect(() => {
    const idx = HomeTabIndexMap[homeTabName as WalletHomeTabEnum];
    if (typeof idx !== 'number' || idx === defaultIndexRef.current) {
      return;
    }
    debugLogger.common.info(
      `switch wallet tab index, old=${defaultIndexRef.current}, new=${idx}`,
    );
    ref.current?.setPageIndex?.(idx);
    onIndexChange(idx);
    defaultIndexRef.current = idx;
  }, [homeTabName, onIndexChange, HomeTabIndexMap]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    backgroundApiProxy.serviceOverview.refreshCurrentAccount().finally(() => {
      setTimeout(() => setRefreshing(false), 50);
    });
  }, []);

  useEffect(() => {
    backgroundApiProxy.serviceOverview.fetchAccountOverview({
      networkId,
      accountId,
      walletId,
    });
  }, [networkId, accountId, walletId]);

  const timer = useRef<ReturnType<typeof setTimeout>>();

  const tabContents = [
    <Tabs.Tab
      name={WalletHomeTabEnum.Tokens}
      label={intl.formatMessage({ id: 'asset__tokens' })}
      key={WalletHomeTabEnum.Tokens}
    >
      <>
        <AssetsList
          accountId={accountId}
          networkId={networkId}
          ListFooterComponent={<Box h={6} />}
          limitSize={10}
          renderDefiList
        />
        <OneKeyPerfTraceLog name="App RootTabHome AssetsList render" />
        <GuideToPushFirstTimeCheck />
      </>
    </Tabs.Tab>,
    network?.settings.hiddenNFTTab ? null : (
      <Tabs.Tab
      name={WalletHomeTabEnum.Collectibles}
      label={intl.formatMessage({ id: 'asset__collectibles' })}
      key={WalletHomeTabEnum.Collectibles}
    >
      <NFTList />
    </Tabs.Tab>
    )
    ,
    isAllNetworks(networkId) ? null : (
      <Tabs.Tab
        name={WalletHomeTabEnum.History}
        label={intl.formatMessage({ id: 'transaction__history' })}
        key={WalletHomeTabEnum.History}
      >
        <TxHistoryListView
          accountId={account?.id}
          networkId={network?.id}
          isHomeTab
        />
      </Tabs.Tab>
    ),
    <Tabs.Tab
      name={WalletHomeTabEnum.Tools}
      label={intl.formatMessage({ id: 'form__tools' })}
      key={WalletHomeTabEnum.Tools}
    >
      <ToolsPage />
    </Tabs.Tab>,
  ].filter(Boolean);

  const walletTabsContainer = (
    <Tabs.Container
      canOpenDrawer
      initialTabName={homeTabName}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onIndexChange={(index: number) => {
        defaultIndexRef.current = index;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          onIndexChange(defaultIndexRef.current);
        }, 1500);
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
