import { memo, useEffect, useMemo } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootSiblingParent } from 'react-native-root-siblings';

import { Box, useIsVerticalLayout, useThemeValue } from '@onekeyhq/components';
import NavHeader from '@onekeyhq/components/src/NavHeader/NavHeader';
import { setMainScreenDom } from '@onekeyhq/components/src/utils/SelectAutoHide';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  available,
  enable,
} from '@onekeyhq/kit/src/store/reducers/autoUpdater';
import appUpdates from '@onekeyhq/kit/src/utils/updates/AppUpdates';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { NetworkAccountSelectorEffectsSingleton } from '../../components/NetworkAccountSelector/hooks/useAccountSelectorEffects';
import { WalletSelectorEffectsSingleton } from '../../components/WalletSelector/hooks/useWalletSelectorEffects';
import { createLazyComponent } from '../../utils/createLazyComponent';
import { HomeRoutes } from '../types';

import type { HomeRoutesParams, ScreensList } from '../types';

const DAppList = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/Discover/DAppList'),
);
const DiscoverHome = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/Discover/Home'),
);
const MyDAppList = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/Discover/MyDAppList'),
);
const FullTokenList = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/FullTokenList/FullTokenList'),
);
const OnekeyLiteDetail = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/Hardware/OnekeyLite/Detail'),
);
const MarketDetail = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/Market/MarketDetail'),
);
const VolumeHaptic = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/Me/GenaralSection/VolumeHaptic'),
);
const CloudBackup = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/Me/SecuritySection/CloudBackup'),
);
const CloudBackupDetails = createLazyComponent(
  () =>
    import(
      '@onekeyhq/kit/src/views/Me/SecuritySection/CloudBackup/BackupDetails'
    ),
);
const CloudBackupPreviousBackups = createLazyComponent(
  () =>
    import(
      '@onekeyhq/kit/src/views/Me/SecuritySection/CloudBackup/PreviousBackups'
    ),
);
const Protected = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/Protected'),
);
const PushNotification = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/PushNotification'),
);
const PushNotificationManageAccountDynamic = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/PushNotification/AccountDynamic'),
);
const PushNotificationManagePriceAlert = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/PushNotification/PriceAlertListStack'),
);
const RevokePage = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/Revoke'),
);
const RevokeRedirectPage = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/Revoke/Redirect'),
);
const TokenDetail = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/TokenDetail'),
);
const TransactionHistory = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/TransactionHistory'),
);
const UpdateAlert = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/Update/Alert'),
);

const NFTMarketCollectionScreen = createLazyComponent(
  () => import('../../views/NFTMarket/CollectionDetail'),
);
const NFTMarketLiveMintingList = createLazyComponent(
  () => import('../../views/NFTMarket/LiveMintingList'),
);
const NFTMarketStatsList = createLazyComponent(
  () => import('../../views/NFTMarket/StatsList'),
);
const RouteOnboarding = createLazyComponent(
  () => import('../../views/Onboarding/routes/RouteOnboarding'),
);
const SwapHistory = createLazyComponent(
  () => import('../../views/Swap/History'),
);

const Drawer = createLazyComponent(() => import('../Drawer'));

const ChainWebEmbed = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/ChainWebEmbed'),
);

const AddressBook = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/AddressBook/Listing'),
);

const PNLDetailScreen = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/NFTMarket/PNL/PNLDetail'),
);

const OverviewDefiListScreen = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/Overview'),
);

const WalletSwitch = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/Me/UtilSection/WalletSwitch'),
);

const AnnualLoading = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/AnnualReport/Welcome'),
);

const AnnualReport = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/AnnualReport/Report'),
);
const BulkSender = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/BulkSender'),
);

export const stackScreenList: ScreensList<HomeRoutes> = [
  {
    name: HomeRoutes.FullTokenListScreen,
    component: FullTokenList,
    i18nTitle: 'asset__tokens',
  },
  {
    name: HomeRoutes.ScreenTokenDetail,
    component: TokenDetail,
    alwaysShowBackButton: true,
  },
  {
    name: HomeRoutes.ScreenOnekeyLiteDetail,
    component: OnekeyLiteDetail,
  },
  {
    name: HomeRoutes.ExploreScreen,
    component: DiscoverHome,
  },
  {
    name: HomeRoutes.DAppListScreen,
    component: DAppList,
  },
  {
    name: HomeRoutes.MyDAppListScreen,
    component: MyDAppList,
  },
  {
    name: HomeRoutes.TransactionHistoryScreen,
    component: TransactionHistory,
  },
  {
    name: HomeRoutes.Protected,
    component: Protected,
  },
  {
    name: HomeRoutes.AddressBook,
    component: AddressBook,
    i18nTitle: 'title__address_book',
  },
  {
    name: HomeRoutes.SwapHistory,
    component: SwapHistory,
  },
  {
    name: HomeRoutes.VolumeHaptic,
    component: VolumeHaptic,
  },
  {
    name: HomeRoutes.CloudBackup,
    component: CloudBackup,
  },
  {
    name: HomeRoutes.CloudBackupPreviousBackups,
    component: CloudBackupPreviousBackups,
  },
  {
    name: HomeRoutes.CloudBackupDetails,
    component: CloudBackupDetails,
  },
  {
    name: HomeRoutes.PushNotification,
    component: PushNotification,
  },
  {
    name: HomeRoutes.PushNotificationManagePriceAlert,
    component: PushNotificationManagePriceAlert,
  },
  {
    name: HomeRoutes.PushNotificationManageAccountDynamic,
    component: PushNotificationManageAccountDynamic,
  },
  {
    name: HomeRoutes.MarketDetail,
    component: MarketDetail,
    alwaysShowBackButton: true,
  },
  {
    name: HomeRoutes.Revoke,
    component: RevokePage,
    alwaysShowBackButton: true,
  },
  {
    name: HomeRoutes.NFTMarketStatsList,
    component: NFTMarketStatsList,
  },
  {
    name: HomeRoutes.NFTMarketLiveMintingList,
    component: NFTMarketLiveMintingList,
  },
  {
    name: HomeRoutes.NFTMarketCollectionScreen,
    component: NFTMarketCollectionScreen,
  },
  {
    name: HomeRoutes.RevokeRedirect,
    component: RevokeRedirectPage,
  },
  {
    name: HomeRoutes.NFTPNLScreen,
    component: PNLDetailScreen,
  },
  {
    name: HomeRoutes.OverviewDefiListScreen,
    component: OverviewDefiListScreen,
  },
  {
    name: HomeRoutes.WalletSwitch,
    component: WalletSwitch,
  },
  {
    name: HomeRoutes.AnnualLoading,
    component: AnnualLoading,
  },
  {
    name: HomeRoutes.AnnualReport,
    component: AnnualReport,
  },
  {
    name: HomeRoutes.BulkSender,
    component: BulkSender,
    alwaysShowBackButton: true,
  },
];

export const StackNavigator = createNativeStackNavigator<HomeRoutesParams>();

const Dashboard = memo(() => {
  const isVerticalLayout = useIsVerticalLayout();
  const [bgColor, borderBottomColor] = useThemeValue([
    'background-default',
    'border-subdued',
  ]);

  const stackScreens = useMemo(() => {
    if (!isVerticalLayout) {
      return null;
    }

    return stackScreenList.map(({ name, component, ...stackOptions }) => (
      <StackNavigator.Screen
        key={name}
        name={name}
        component={component}
        options={{
          animation: platformEnv.isNativeAndroid ? 'none' : 'default',
          // eslint-disable-next-line react/no-unstable-nested-components
          header: (props) => (
            <NavHeader
              style={{
                backgroundColor: bgColor,
                borderBottomWidth: 0,
                shadowColor: borderBottomColor,
              }}
              {...props}
              {...stackOptions}
            />
          ),
        }}
      />
    ));
  }, [bgColor, borderBottomColor, isVerticalLayout]);

  return (
    <StackNavigator.Navigator>
      <StackNavigator.Group screenOptions={{ headerShown: false }}>
        <StackNavigator.Screen
          name={HomeRoutes.InitialTab}
          component={Drawer}
        />
        {process.env.NODE_ENV !== 'production' && (
          <StackNavigator.Screen
            name={HomeRoutes.Dev}
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            component={require('../Dev').default}
          />
        )}
        <StackNavigator.Screen
          name={HomeRoutes.HomeOnboarding}
          component={RouteOnboarding}
        />
      </StackNavigator.Group>
      <StackNavigator.Group>{stackScreens}</StackNavigator.Group>
    </StackNavigator.Navigator>
  );
});
Dashboard.displayName = 'Dashboard';

function MainScreen() {
  const { dispatch } = backgroundApiProxy;

  useEffect(() => {
    appUpdates.addUpdaterListener();
    appUpdates
      .checkUpdate()
      ?.then((versionInfo) => {
        if (versionInfo) {
          dispatch(enable(), available(versionInfo));
        }
      })
      .catch();
  }, [dispatch]);

  return (
    <RootSiblingParent>
      <Box ref={setMainScreenDom} w="full" h="full">
        <Dashboard />
        <NetworkAccountSelectorEffectsSingleton />
        <WalletSelectorEffectsSingleton />
        {/* TODO Waiting notification component */}
        <UpdateAlert />
        <ChainWebEmbed />
      </Box>
    </RootSiblingParent>
  );
}

export default MainScreen;
