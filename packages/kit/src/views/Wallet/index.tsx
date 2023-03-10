import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, useIsVerticalLayout, useUserDevice } from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import IdentityAssertion from '../../components/IdentityAssertion';
import { OneKeyPerfTraceLog } from '../../components/OneKeyPerfTraceLog';
import { useOnboardingRequired } from '../../hooks/useOnboardingRequired';
import { useHtmlPreloadSplashLogoRemove } from '../../provider/AppLoading';
import { setHomeTabName } from '../../store/reducers/status';
import OfflineView from '../Offline';
import { GuideToPushFirstTimeCheck } from '../PushNotification/GuideToPushFirstTime';
import { TxHistoryListView } from '../TxHistory/TxHistoryListView';

import AccountInfo, {
  FIXED_HORIZONTAL_HEDER_HEIGHT,
  FIXED_VERTICAL_HEADER_HEIGHT,
} from './AccountInfo';
import AssetsList from './AssetsList';
import BackupToast from './BackupToast';
import NFTList from './NFT/NFTList';
import ToolsPage from './Tools';
import { HomeTabOrder, WalletHomeTabEnum } from './type';

const AccountHeader = () => <AccountInfo />;

// HomeTabs
const WalletTabs: FC = () => {
  const intl = useIntl();
  const { screenWidth } = useUserDevice();
  const isVerticalLayout = useIsVerticalLayout();
  const { wallet, account, network, accountId, networkId } =
    useActiveWalletAccount();
  const [backupMap, updateBackMap] = useState<
    Record<string, boolean | undefined>
  >({});
  const [refreshing, setRefreshing] = useState(false);

  const backupToast = useCallback(() => {
    if (wallet && !wallet?.backuped && backupMap[wallet?.id] === undefined) {
      return (
        <BackupToast
          walletId={wallet.id}
          onClose={() => {
            updateBackMap((prev) => {
              prev[wallet?.id] = false;
              return { ...prev };
            });
          }}
        />
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.id, wallet?.backuped]);

  useEffect(() => {
    // reset to first Tab on mount
    backgroundApiProxy.dispatch(setHomeTabName(HomeTabOrder[0]));
  }, []);

  return (
    <>
      <Tabs.Container
        canOpenDrawer
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          if (account?.id && network?.id) {
            backgroundApiProxy.engine.clearPriceCache();
            try {
              await backgroundApiProxy.serviceToken.fetchAccountTokens({
                accountId: account.id,
                networkId: network.id,
                forceReloadTokens: true,
                includeTop50TokensQuery: true,
              });
            } catch (e) {
              debugLogger.common.error(e);
            }
          }
          setTimeout(() => setRefreshing(false), 10);
        }}
        onIndexChange={(index) => {
          backgroundApiProxy.dispatch(setHomeTabName(HomeTabOrder[index]));
        }}
        renderHeader={AccountHeader}
        headerHeight={
          isVerticalLayout
            ? FIXED_VERTICAL_HEADER_HEIGHT
            : FIXED_HORIZONTAL_HEDER_HEIGHT
        }
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
          <NFTList />
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
      {backupToast()}
    </>
  );
};

export default function Wallet() {
  useOnboardingRequired(true);
  useHtmlPreloadSplashLogoRemove();
  return (
    <>
      <IdentityAssertion>
        <WalletTabs />
      </IdentityAssertion>
      <OfflineView />
    </>
  );
}
