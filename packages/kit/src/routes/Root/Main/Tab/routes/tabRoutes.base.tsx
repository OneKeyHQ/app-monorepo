import { TabRoutes } from '../../../../routesEnum';

import type { TabRouteConfigBase } from '../../../../types';

export const tabRoutesOrders = [
  TabRoutes.Home,
  TabRoutes.Market,
  TabRoutes.Swap,
  TabRoutes.NFT,
  TabRoutes.Discover,
  TabRoutes.Me,
];
if (process.env.NODE_ENV !== 'production') {
  tabRoutesOrders.push(TabRoutes.Developer);
}

export const swapAndMarketRoutes = [TabRoutes.Swap, TabRoutes.Market];

export const tabRoutesConfigBaseMap: Record<TabRoutes, TabRouteConfigBase> = {
  [TabRoutes.Home]: {
    name: TabRoutes.Home,
    tabBarIcon: (focused) =>
      focused ? 'CreditCardSolid' : 'CreditCardOutline',
    translationId: 'wallet__wallet',
    navHeaderType: 'AccountSelector',
  },
  [TabRoutes.Market]: {
    name: TabRoutes.Market,
    tabBarIcon: (focused) =>
      focused ? 'ChartLineSquareSolid' : 'ChartLineSquareOutline',
    translationId: 'market__market',
    hideDesktopNavHeader: true,
    hideMobileNavHeader: true,
    // hideOnMobile: true,
  },
  [TabRoutes.Swap]: {
    name: TabRoutes.Swap,
    tabBarIcon: (focused) =>
      focused ? 'ArrowsRightLeftOutline' : 'ArrowsRightLeftOutline',
    translationId: 'form__trade',
    hideDesktopNavHeader: true,
    hideMobileNavHeader: true,
  },
  [TabRoutes.NFT]: {
    name: TabRoutes.NFT,
    tabBarIcon: (focused) => (focused ? 'PhotoSolid' : 'PhotoOutline'),
    translationId: 'title__nft',
    hideDesktopNavHeader: true,
    hideMobileNavHeader: true,
    hideOnMobile: true,
  },
  [TabRoutes.Discover]: {
    name: TabRoutes.Discover,
    tabBarIcon: (focused) => (focused ? 'CompassSolid' : 'CompassOutline'),
    translationId: 'title__explore',
    hideDesktopNavHeader: true,
    hideMobileNavHeader: true,
  },
  [TabRoutes.Me]: {
    name: TabRoutes.Me,
    tabBarIcon: (focused) => (focused ? 'Bars4Solid' : 'Bars4Outline'),
    translationId: 'title__menu',
    navHeaderType: 'AccountSelector',
  },
  [TabRoutes.Developer]: {
    name: TabRoutes.Developer,
    tabBarIcon: (focused) => (focused ? 'ChipOutline' : 'ChipOutline'),
    translationId: 'form__dev_mode',
    hideOnProduction: true,
  },
};

export const bottomTabBarRoutes: {
  name: TabRoutes;
  key: TabRoutes;
}[] = tabRoutesOrders
  .map((name) => {
    if (tabRoutesConfigBaseMap[name].hideOnMobile) {
      return null;
    }
    if (
      process.env.NODE_ENV === 'production' &&
      tabRoutesConfigBaseMap[name].hideOnProduction
    ) {
      return null;
    }
    return {
      name,
      key: name,
    };
  })
  .filter(Boolean);

export const bottomTabBarDescriptors = Object.entries(
  tabRoutesConfigBaseMap,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
).reduce((prev, current, index) => {
  const [name, options] = current;
  // @ts-ignore
  prev[name] = {
    options,
  };
  return prev;
}, {});
