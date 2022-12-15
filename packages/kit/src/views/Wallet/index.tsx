import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  useIsVerticalLayout,
  useThemeValue,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import {
  useActiveWalletAccount,
  useAppSelector,
} from '@onekeyhq/kit/src/hooks/redux';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import IdentityAssertion from '../../components/IdentityAssertion';
import { OneKeyPerfTraceLog } from '../../components/OneKeyPerfTraceLog';
import { useOnboardingRequired } from '../../hooks/useOnboardingRequired';
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
import { DefiList } from './DefiList';
import NFTList from './NFT/NFTList';
import ToolsPage from './Tools';
import { WalletHomeTabEnum } from './type';

const WalletTabs: FC = () => {
  const intl = useIntl();
  const { screenWidth } = useUserDevice();
  const [tabbarBgColor, borderDefault] = useThemeValue([
    'background-default',
    'border-subdued',
  ]);
  const hideSmallBalance = useAppSelector((s) => s.settings.hideSmallBalance);
  const homeTabName = useAppSelector((s) => s.status.homeTabName);
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

  return (
    <>
      <Tabs.Container
        initialTabName={homeTabName}
        // @ts-ignore fix type when remove react-native-collapsible-tab-view
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          if (account?.id && network?.id) {
            backgroundApiProxy.engine.clearPriceCache();
            try {
              await backgroundApiProxy.serviceToken.fetchAccountTokens({
                activeAccountId: account.id,
                activeNetworkId: network.id,
                withBalance: true,
                wait: true,
                forceReloadTokens: true,
              });
            } catch (e) {
              debugLogger.common.error(e);
            }
          }
          setTimeout(() => setRefreshing(false), 10);
        }}
        onTabChange={({ tabName }) => {
          backgroundApiProxy.dispatch(setHomeTabName(tabName));
        }}
        renderHeader={() => <AccountInfo />}
        width={isVerticalLayout ? screenWidth : screenWidth - 224} // reduce the width on iPad, sidebar's width is 244
        pagerProps={{ scrollEnabled: false }}
        headerHeight={
          isVerticalLayout
            ? FIXED_VERTICAL_HEADER_HEIGHT
            : FIXED_HORIZONTAL_HEDER_HEIGHT
        }
        containerStyle={{
          maxWidth: MAX_PAGE_CONTAINER_WIDTH,
          width: '100%',
          marginHorizontal: 'auto', // Center align vertically
          backgroundColor: tabbarBgColor,
          alignSelf: 'center',
          flex: 1,
        }}
        headerContainerStyle={{
          shadowOffset: { width: 0, height: 0 },
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: borderDefault,
        }}
      >
        <Tabs.Tab
          name={WalletHomeTabEnum.Tokens}
          label={intl.formatMessage({ id: 'asset__tokens' })}
        >
          <>
            <AssetsList
              hideSmallBalance={hideSmallBalance}
              accountId={accountId}
              networkId={networkId}
              ListFooterComponent={<Box h={16} />}
              limitSize={20}
            />
            <DefiList />
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
  return (
    <>
      <IdentityAssertion>
        <WalletTabs />
      </IdentityAssertion>
      <OfflineView />
    </>
  );
}
