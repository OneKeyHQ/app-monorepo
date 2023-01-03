import type { FC } from 'react';
import { useCallback } from 'react';

import { HeaderBackButton as NavigationHeaderBackButton } from '@react-navigation/elements';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useThemeValue } from '@onekeyhq/components';
import { LayoutHeaderDesktop } from '@onekeyhq/components/src/Layout/Header/LayoutHeaderDesktop';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import AddressBook from '@onekeyhq/kit/src/views/AddressBook/Listing';
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
import Webview from '@onekeyhq/kit/src/views/Webview';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { toFocusedLazy } from '../../components/LazyRenderWhenFocus';
import FullTokenList from '../../views/FullTokenList/FullTokenList';
import NFTMarketCollectionScreen from '../../views/NFTMarket/CollectionDetail';
import NFTMarketLiveMintingList from '../../views/NFTMarket/LiveMintingList';
import PNLDetailScreen from '../../views/NFTMarket/PNL/PNLDetail';
import NFTMarketStatsList from '../../views/NFTMarket/StatsList';
import renderCustomSubStackHeader from '../Stack/Header';
import { HomeRoutes, TabRoutes } from '../types';

export interface TabRouteConfig {
  name: TabRoutes;
  translationId: LocaleIds;
  component: FC;
  tabBarIcon: (props: { focused?: boolean }) => string;
  children?: {
    name: HomeRoutes;
    component: FC<any>;
    alwaysShowBackButton?: boolean;
  }[];
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
      },
      {
        name: HomeRoutes.VolumeHaptic,
        component: VolumeHaptic,
      },
      {
        name: HomeRoutes.SettingsWebviewScreen,
        component: Webview,
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

export const getStackTabScreen = (tabName: TabRoutes, goBack: () => void) => {
  const tab = tabRoutes.find((t) => t.name === tabName) as TabRouteConfig;
  const screens = [
    {
      // fix: Found screens with the same name nested inside one another
      name: buildTabName(tab.name),
      component: tab.component,
      alwaysShowBackButton: false,
    },
    ...(tab.children || []),
  ];

  const StackNavigatorComponent = () => {
    const [bgColor, textColor, borderBottomColor] = useThemeValue([
      'background-default',
      'text-default',
      'border-subdued',
    ]);

    const headerLeft = useCallback(
      ({ tintColor }) => (
        <NavigationHeaderBackButton
          tintColor={tintColor}
          onPress={goBack}
          canGoBack
        />
      ),
      [],
    );
    const renderHeader = useCallback(() => <LayoutHeaderDesktop />, []);
    return (
      <Stack.Navigator
        screenOptions={{
          headerBackTitle: '',
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: bgColor,
            // @ts-expect-error
            borderBottomWidth: 0,
            shadowColor: borderBottomColor,
          },
          header: platformEnv.isNativeIOS
            ? renderCustomSubStackHeader
            : undefined,
          headerTintColor: textColor,
        }}
      >
        {screens.map((s, index) => {
          const tabsWithHeader = [TabRoutes.Home, TabRoutes.Swap].map(
            buildTabName,
          );
          const customRenderHeader =
            index === 0 && tabsWithHeader.includes(s.name)
              ? renderHeader
              : undefined;
          return (
            // show navigation header
            <Stack.Group
              key={s.name}
              screenOptions={{
                header: customRenderHeader,
                headerLeft:
                  s.alwaysShowBackButton && platformEnv.isRuntimeBrowser
                    ? headerLeft
                    : undefined,
                // lazy: true,
                headerShown: index > 0 || Boolean(customRenderHeader),
              }}
            >
              <Stack.Screen name={s.name} component={s.component} />
            </Stack.Group>
          );
        })}
      </Stack.Navigator>
    );
  };

  return StackNavigatorComponent;
};
