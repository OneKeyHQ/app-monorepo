import type { FC } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useThemeValue } from '@onekeyhq/components';
import { LayoutHeaderDesktop } from '@onekeyhq/components/src/Layout/Header/LayoutHeaderDesktop';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { HeaderTitleProps } from '@onekeyhq/components/src/NavHeader/HeaderTitle';
import NavHeader from '@onekeyhq/components/src/NavHeader/NavHeader';
import AddressBook from '@onekeyhq/kit/src/views/AddressBook/Listing';
import AnnualReport from '@onekeyhq/kit/src/views/AnnualReport/Report';
import AnnualLoading from '@onekeyhq/kit/src/views/AnnualReport/Welcome';
import BulkSender from '@onekeyhq/kit/src/views/BulkSender';
import DiscoverScreen from '@onekeyhq/kit/src/views/Discover';
import DAppList from '@onekeyhq/kit/src/views/Discover/DAppList';
import DiscoverHome from '@onekeyhq/kit/src/views/Discover/Home';
import MyDAppList from '@onekeyhq/kit/src/views/Discover/MyDAppList';
import OnekeyLiteDetail from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Detail';
import MarketScreen from '@onekeyhq/kit/src/views/Market';
import MarketDetail from '@onekeyhq/kit/src/views/Market/MarketDetail';
import MeScreen from '@onekeyhq/kit/src/views/Me';
import VolumeHaptic from '@onekeyhq/kit/src/views/Me/GenaralSection/VolumeHaptic';
import CloudBackup from '@onekeyhq/kit/src/views/Me/SecuritySection/CloudBackup';
import CloudBackupDetails from '@onekeyhq/kit/src/views/Me/SecuritySection/CloudBackup/BackupDetails';
import CloudBackupPreviousBackups from '@onekeyhq/kit/src/views/Me/SecuritySection/CloudBackup/PreviousBackups';
import WalletSwitch from '@onekeyhq/kit/src/views/Me/UtilSection/WalletSwitch';
import NFTMarket from '@onekeyhq/kit/src/views/NFTMarket/Home';
import OverviewDefiListScreen from '@onekeyhq/kit/src/views/Overview';
import Protected from '@onekeyhq/kit/src/views/Protected';
import PushNotification from '@onekeyhq/kit/src/views/PushNotification';
import PushNotificationManageAccountDynamic from '@onekeyhq/kit/src/views/PushNotification/AccountDynamic';
import PushNotificationManagePriceAlert from '@onekeyhq/kit/src/views/PushNotification/PriceAlertListStack';
import RevokePage from '@onekeyhq/kit/src/views/Revoke';
import RevokeRedirectPage from '@onekeyhq/kit/src/views/Revoke/Redirect';
import SwapScreen from '@onekeyhq/kit/src/views/Swap';
import SwapHistory from '@onekeyhq/kit/src/views/Swap/History';
import TokenDetail from '@onekeyhq/kit/src/views/TokenDetail';
import HomeScreen from '@onekeyhq/kit/src/views/Wallet';

import { toFocusedLazy } from '../../components/LazyRenderWhenFocus';
import FullTokenList from '../../views/FullTokenList/FullTokenList';
import NFTMarketCollectionScreen from '../../views/NFTMarket/CollectionDetail';
import NFTMarketLiveMintingList from '../../views/NFTMarket/LiveMintingList';
import PNLDetailScreen from '../../views/NFTMarket/PNL/PNLDetail';
import NFTMarketStatsList from '../../views/NFTMarket/StatsList';
import { HomeRoutes, TabRoutes } from '../types';

import type { ScreensList } from '../types';

export interface TabRouteConfig {
  name: TabRoutes;
  translationId: LocaleIds;
  component: FC;
  tabBarIcon: (props: { focused?: boolean }) => string;
  children?: ({
    name: HomeRoutes;
    component: FC<any>;
    alwaysShowBackButton?: boolean;
  } & HeaderTitleProps)[];
}

export const tabRoutes: TabRouteConfig[] = [
  {
    name: TabRoutes.Home,
    component: toFocusedLazy(HomeScreen, {
      rootTabName: TabRoutes.Home,
    }),
    tabBarIcon: (focused) =>
      focused ? 'CreditCardSolid' : 'CreditCardOutline',
    translationId: 'form__account',
    children: [
      {
        name: HomeRoutes.ScreenTokenDetail,
        component: TokenDetail,
        alwaysShowBackButton: true,
      },
      {
        name: HomeRoutes.FullTokenListScreen,
        component: FullTokenList,
        title: 'asset__tokens',
      },
      {
        name: HomeRoutes.Revoke,
        component: RevokePage,
        alwaysShowBackButton: true,
      },
      {
        name: HomeRoutes.RevokeRedirect,
        component: RevokeRedirectPage,
      },
      {
        name: HomeRoutes.NFTMarketCollectionScreen,
        component: NFTMarketCollectionScreen,
      },
      {
        name: HomeRoutes.NFTPNLScreen,
        component: PNLDetailScreen,
        alwaysShowBackButton: true,
      },
      {
        name: HomeRoutes.OverviewDefiListScreen,
        component: OverviewDefiListScreen,
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
    ],
  },
  {
    name: TabRoutes.Market,
    component: MarketScreen,
    tabBarIcon: (focused) =>
      focused ? 'ChartLineSquareSolid' : 'ChartLineSquareOutline',
    translationId: 'title__market',
    children: [
      {
        name: HomeRoutes.MarketDetail,
        component: MarketDetail,
        alwaysShowBackButton: true,
      },
    ],
  },
  {
    name: TabRoutes.Swap,
    component: SwapScreen,
    tabBarIcon: () => 'ArrowsRightLeftOutline',
    translationId: 'title__Swap_Bridge',
    children: [
      {
        name: HomeRoutes.SwapHistory,
        component: SwapHistory,
      },
    ],
  },
  {
    name: TabRoutes.NFT,
    component: toFocusedLazy(NFTMarket, {
      rootTabName: TabRoutes.NFT,
    }),
    tabBarIcon: (focused) => (focused ? 'PhotoSolid' : 'PhotoOutline'),
    translationId: 'title__nft',
    children: [
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
        name: HomeRoutes.NFTPNLScreen,
        component: PNLDetailScreen,
        alwaysShowBackButton: true,
      },
    ],
  },
  {
    name: TabRoutes.Discover,
    component: toFocusedLazy(DiscoverScreen, {
      rootTabName: TabRoutes.Discover,
    }),
    tabBarIcon: (focused) => (focused ? 'CompassSolid' : 'CompassOutline'),
    translationId: 'title__explore',
    children: [
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
    ],
  },
  {
    name: TabRoutes.Me,
    component: toFocusedLazy(MeScreen, {
      rootTabName: TabRoutes.Me,
    }),
    tabBarIcon: (focused) => (focused ? 'Bars4Solid' : 'Bars4Outline'),
    translationId: 'title__menu',
    children: [
      {
        name: HomeRoutes.ScreenOnekeyLiteDetail,
        component: OnekeyLiteDetail,
      },
      {
        name: HomeRoutes.Protected,
        component: Protected,
      },
      {
        name: HomeRoutes.AddressBook,
        component: AddressBook,
        title: 'title__address_book',
      },
      {
        name: HomeRoutes.WalletSwitch,
        component: WalletSwitch,
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
    ],
  },
];

if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const DevelopScreen = require('@onekeyhq/kit/src/views/Developer').default;

  tabRoutes.push({
    name: TabRoutes.Developer,
    component: toFocusedLazy(DevelopScreen, {
      rootTabName: TabRoutes.Developer,
    }),
    tabBarIcon: () => 'ChipOutline',
    translationId: 'form__dev_mode',
  });
}

const Stack = createNativeStackNavigator();

function buildTabName(name: TabRoutes) {
  return `tab-${name}`;
}

export const getStackTabScreen = (tabName: TabRoutes) => {
  const tab = tabRoutes.find((t) => t.name === tabName) as TabRouteConfig;
  const screens: ScreensList<string> = [
    {
      // fix: Found screens with the same name nested inside one another
      name: buildTabName(tab.name),
      component: tab.component,
      alwaysShowBackButton: false,
      title: tab.translationId,
    },
    ...(tab.children || []),
  ];

  const StackNavigatorComponent = () => {
    const [bgColor, borderBottomColor] = useThemeValue([
      'background-default',
      'border-subdued',
    ]);
    return (
      <Stack.Navigator>
        {screens.map(({ name, component, ...stackOptions }, index) => {
          const tabsWithHeader = [TabRoutes.Home, TabRoutes.Swap].map(
            buildTabName,
          );
          const customRenderHeader =
            index === 0 && tabsWithHeader.includes(name)
              ? () => <LayoutHeaderDesktop title={stackOptions.title} />
              : // @ts-ignore
                (props) => (
                  <NavHeader
                    style={{
                      backgroundColor: bgColor,
                      borderBottomWidth: 0,
                      shadowColor: borderBottomColor,
                    }}
                    {...props}
                    {...stackOptions}
                  />
                );
          return (
            // show navigation header
            <Stack.Screen
              key={name}
              name={name}
              component={component}
              options={{
                header: customRenderHeader,
                headerShown: index > 0 || Boolean(customRenderHeader),
              }}
            />
          );
        })}
      </Stack.Navigator>
    );
  };

  return StackNavigatorComponent;
};
