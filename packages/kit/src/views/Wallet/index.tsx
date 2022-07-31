import React, { FC, useCallback, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Empty,
  useIsVerticalLayout,
  useThemeValue,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import IconAccount from '@onekeyhq/kit/assets/3d_account.png';
import IconWallet from '@onekeyhq/kit/assets/3d_wallet.png';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';
import {
  useActiveWalletAccount,
  useAppSelector,
} from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { setHomeTabName } from '../../store/reducers/status';
import OfflineView from '../Offline';
import { TxHistoryListView } from '../TxHistory/TxHistoryListView';

import AccountInfo, {
  FIXED_HORIZONTAL_HEDER_HEIGHT,
  FIXED_VERTICAL_HEADER_HEIGHT,
} from './AccountInfo';
import AssetsList from './AssetsList';
import BackupToast from './BackupToast';
import CollectiblesList from './Collectibles';
// import HistoricalRecord from './HistoricalRecords';
import { WalletHomeTabEnum } from './type';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

const Home: FC = () => {
  const intl = useIntl();
  const { screenWidth } = useUserDevice();
  const [tabbarBgColor, borderDefault] = useThemeValue([
    'background-default',
    'border-subdued',
  ]);
  const homeTabName = useAppSelector((s) => s.status.homeTabName);
  const isVerticalLayout = useIsVerticalLayout();
  const { wallet, account, network } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps['navigation']>();
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

  if (!wallet) {
    return (
      <Box flex="1" justifyContent="center" bg="background-default">
        <Empty
          imageUrl={IconWallet}
          title={intl.formatMessage({ id: 'empty__no_wallet_title' })}
          subTitle={intl.formatMessage({ id: 'empty__no_wallet_desc' })}
        />
        <Box
          position="relative"
          w={{ md: 'full' }}
          alignItems="center"
          h="56px"
          justifyContent="center"
        >
          <Button
            leftIconName="PlusOutline"
            type="primary"
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.CreateWallet,
                params: {
                  screen: CreateWalletModalRoutes.GuideModal,
                },
              });
            }}
            size="lg"
          >
            {intl.formatMessage({ id: 'action__create_wallet' })}
          </Button>
        </Box>
        <OfflineView />
      </Box>
    );
  }

  if (!account) {
    return (
      <Box flex="1" justifyContent="center" bg="background-default">
        <Empty
          imageUrl={IconAccount}
          title={intl.formatMessage({ id: 'empty__no_account_title' })}
          subTitle={intl.formatMessage({ id: 'empty__no_account_desc' })}
        />
        <Box
          position="relative"
          w={{ md: 'full' }}
          alignItems="center"
          h="56px"
          justifyContent="center"
        >
          <Button
            leftIconName="PlusOutline"
            type="primary"
            onPress={() => {
              if (wallet.type === 'imported') {
                return navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.CreateWallet,
                  params: {
                    screen: CreateWalletModalRoutes.AddExistingWalletModal,
                    params: { mode: 'imported' },
                  },
                });
              }
              if (wallet.type === 'watching') {
                return navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.CreateWallet,
                  params: {
                    screen: CreateWalletModalRoutes.AddExistingWalletModal,
                    params: { mode: 'watching' },
                  },
                });
              }

              return navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.CreateAccount,
                params: {
                  screen: CreateAccountModalRoutes.CreateAccountForm,
                  params: {
                    walletId: wallet.id,
                  },
                },
              });
            }}
            size="lg"
          >
            {intl.formatMessage({ id: 'action__create_account' })}
          </Button>
        </Box>
        <OfflineView />
      </Box>
    );
  }

  return (
    <>
      <Tabs.Container
        initialTabName={homeTabName}
        // @ts-ignore fix type when remove react-native-collapsible-tab-view
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          if (account.id && network?.id) {
            backgroundApiProxy.engine.clearPriceCache();
            await backgroundApiProxy.serviceToken.fetchAccountTokens({
              activeAccountId: account.id,
              activeNetworkId: network.id,
              withBalance: true,
              withPrice: true,
              wait: true,
            });
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
          <AssetsList />
        </Tabs.Tab>
        <Tabs.Tab
          name={WalletHomeTabEnum.Collectibles}
          label={intl.formatMessage({ id: 'asset__collectibles' })}
        >
          <CollectiblesList address={account?.address} network={network} />
        </Tabs.Tab>
        <Tabs.Tab
          name={WalletHomeTabEnum.History}
          label={intl.formatMessage({ id: 'transaction__history' })}
        >
          {/* {platformEnv.isLegacyHistory ? (
            <HistoricalRecord
              accountId={account?.id}
              networkId={network?.id}
              isTab
            />
          ) : ( */}
          <TxHistoryListView
            accountId={account?.id}
            networkId={network?.id}
            isHomeTab
          />
          {/* )} */}
        </Tabs.Tab>
      </Tabs.Container>
      {backupToast()}
      <OfflineView />
    </>
  );
};

export default Home;
