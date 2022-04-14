import React, { FC, useEffect, useState } from 'react';

import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Empty,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components';
import {
  MaterialTabBar,
  Tabs,
} from '@onekeyhq/components/src/CollapsibleTabView';
import { Body2StrongProps } from '@onekeyhq/components/src/Typography';
import IconAccount from '@onekeyhq/kit/assets/3d_account.png';
import IconWallet from '@onekeyhq/kit/assets/3d_wallet.png';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import OfflineView from '../Offline';

import AccountInfo, {
  FIXED_HORIZONTAL_HEDER_HEIGHT,
  FIXED_VERTICAL_HEADER_HEIGHT,
} from './AccountInfo';
import AssetsList from './AssetsList';
import CollectiblesList from './Collectibles';
import HistoricalRecord from './HistoricalRecords';

import type { TextStyle } from 'react-native';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

enum TabEnum {
  Tokens = 'Tokens',
  Collectibles = 'Collectibles',
  History = 'History',
}

// offline check url, CORS error in firefox
// fix ERROR: internetReachability.ts:71 HEAD net::ERR_ABORTED 404 (Not Found)
NetInfo.configure({
  reachabilityUrl:
    platformEnv.isExtension || platformEnv.isDesktop
      ? 'https://defi.onekey.so/onestep/v1/test'
      : '',
});

const Home: FC = () => {
  const intl = useIntl();
  const [
    tabbarBgColor,
    activeLabelColor,
    labelColor,
    indicatorColor,
    borderDefault,
  ] = useThemeValue([
    'background-default',
    'text-default',
    'text-subdued',
    'action-primary-default',
    'border-subdued',
  ]);
  const isVerticalLayout = useIsVerticalLayout();
  const { wallet, account, network } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const [offline, setOffline] = useState(false);
  const [backupTip, setBackupTip] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      if (wallet && !wallet.backuped && backupTip) {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.CreateWallet,
          params: {
            screen: CreateWalletModalRoutes.BackupTipsModal,
            params: { walletId: wallet.id },
          },
        });
      }
      setBackupTip(() => false);
    }, 2000);

    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(state.type === NetInfoStateType.none);
    });
    return () => {
      unsubscribe();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <OfflineView offline={offline} />
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
                    params: { mode: 'privatekey' },
                  },
                });
              }
              if (wallet.type === 'watching') {
                return navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.CreateWallet,
                  params: {
                    screen: CreateWalletModalRoutes.AddExistingWalletModal,
                    params: { mode: 'address' },
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
        <OfflineView offline={offline} />
      </Box>
    );
  }

  return (
    <>
      <Tabs.Container
        renderHeader={AccountInfo}
        headerHeight={
          isVerticalLayout
            ? FIXED_VERTICAL_HEADER_HEIGHT
            : FIXED_HORIZONTAL_HEDER_HEIGHT
        }
        containerStyle={{
          maxWidth: MAX_PAGE_CONTAINER_WIDTH + 32,
          width: '100%',
          marginHorizontal: 'auto',
          backgroundColor: tabbarBgColor,
        }}
        headerContainerStyle={{
          shadowOffset: { width: 0, height: 0 },
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: borderDefault,
        }}
        renderTabBar={(props) => (
          <MaterialTabBar
            {...props}
            activeColor={activeLabelColor}
            inactiveColor={labelColor}
            labelStyle={{
              ...(Body2StrongProps as TextStyle),
            }}
            indicatorStyle={{ backgroundColor: indicatorColor }}
            style={{
              backgroundColor: tabbarBgColor,
            }}
            contentContainerStyle={{ maxWidth: MAX_PAGE_CONTAINER_WIDTH }}
            tabStyle={{ backgroundColor: tabbarBgColor }}
          />
        )}
      >
        <Tabs.Tab
          name={TabEnum.Tokens}
          label={intl.formatMessage({ id: 'asset__tokens' })}
        >
          <AssetsList />
        </Tabs.Tab>
        <Tabs.Tab
          name={TabEnum.Collectibles}
          label={intl.formatMessage({ id: 'asset__collectibles' })}
        >
          <CollectiblesList address={account?.address} network={network} />
        </Tabs.Tab>
        <Tabs.Tab
          name={TabEnum.History}
          label={intl.formatMessage({ id: 'transaction__history' })}
        >
          <HistoricalRecord
            accountId={account?.id}
            networkId={network?.id}
            isTab
          />
        </Tabs.Tab>
      </Tabs.Container>
      <OfflineView offline={offline} />
    </>
  );
};

export default Home;
