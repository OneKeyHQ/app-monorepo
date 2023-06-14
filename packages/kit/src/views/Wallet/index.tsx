import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

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
import NFTList from './NFT/NFTList';
import ToolsPage from './Tools';
import { HomeTabIndex, HomeTabOrder, WalletHomeTabEnum } from './type';

const AccountHeader = () => <AccountInfo />;
// const AccountHeader = () => null;

// HomeTabs
const WalletTabs: FC = () => {
  const intl = useIntl();
  const ref = useRef<ForwardRefHandle>(null);
  const defaultIndexRef = useRef<number>(
    HomeTabIndex[getStatus().homeTabName as WalletHomeTabEnum] ?? 0,
  );
  const { screenWidth } = useUserDevice();
  const isVerticalLayout = useIsVerticalLayout();
  const { homeTabName } = useStatus();
  const { wallet, account, network, accountId, networkId } =
    useActiveWalletAccount();
  const [refreshing, setRefreshing] = useState(false);

  const onIndexChange = useCallback((index: number) => {
    backgroundApiProxy.dispatch(setHomeTabName(HomeTabOrder[index]));
  }, []);

  useEffect(() => {
    const idx = HomeTabIndex[homeTabName as WalletHomeTabEnum];
    if (typeof idx !== 'number' || idx === defaultIndexRef.current) {
      return;
    }
    debugLogger.common.info(
      `switch wallet tab index, old=${defaultIndexRef.current}, new=${idx}`,
    );
    ref.current?.setPageIndex?.(idx);
    onIndexChange(idx);
    defaultIndexRef.current = idx;
  }, [homeTabName, onIndexChange]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    backgroundApiProxy.serviceOverview.refreshCurrentAccount().finally(() => {
      setTimeout(() => setRefreshing(false), 50);
    });
  }, []);

  const timer = useRef<ReturnType<typeof setTimeout>>();

  const walletTabs = (
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
      <Tabs.Tab
        name={WalletHomeTabEnum.Tokens}
        label={intl.formatMessage({ id: 'asset__tokens' })}
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
      </Tabs.Tab>
      <Tabs.Tab
        name={WalletHomeTabEnum.Collectibles}
        label={intl.formatMessage({ id: 'asset__collectibles' })}
      >
        <NFTList accountId={accountId} networkId={networkId} />
      </Tabs.Tab>
      <Tabs.Tab
        name={WalletHomeTabEnum.History}
        label={intl.formatMessage({ id: 'transaction__history' })}
      >
        <TxHistoryListView
          accountId={account?.id}
          networkId={network?.id}
          isHomeTab
        />
        {/* )} */}
      </Tabs.Tab>
      <Tabs.Tab
        name={WalletHomeTabEnum.Tools}
        label={intl.formatMessage({ id: 'form__tools' })}
      >
        <ToolsPage />
      </Tabs.Tab>
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
          {() => walletTabs}
        </Protected>
      </Center>
    );
  }
  return walletTabs;
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
