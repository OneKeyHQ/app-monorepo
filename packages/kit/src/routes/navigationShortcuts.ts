import { getAppNavigation } from '../hooks/useAppNavigation';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { HomeRoutes, MainRoutes, RootRoutes, TabRoutes } from './routesEnum';
import { buildAppRootTabName } from './routesUtils';

/*

window.$$navigationShortcuts.navigateToTokenDetail({
  accountId:"hd-1--m/44'/60'/0'/0/0",
  networkId: 'evm--56',
  tokenId: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
});

 */

function navigateToTokenDetail({
  accountId,
  networkId,
  tokenId,
}: {
  accountId: string;
  networkId: string;
  tokenId: string; // tokenIdOnNetwork
}) {
  const navigation = getAppNavigation();
  navigation?.navigate(RootRoutes.Main, {
    screen: MainRoutes.Tab,
    params: {
      screen: TabRoutes.Home,
      params: {
        screen: HomeRoutes.ScreenTokenDetail,
        params: {
          accountId,
          networkId,
          tokenId,
        },
      },
    },
  });
}

function navigateToMarketDetail({ marketTokenId }: { marketTokenId: string }) {
  const navigation = getAppNavigation();
  navigation?.navigate(RootRoutes.Main, {
    screen: MainRoutes.Tab,
    params: {
      screen: TabRoutes.Market,
      params: {
        screen: HomeRoutes.MarketDetail,
        params: {
          marketTokenId,
        },
      },
    },
  });
}

function navigateToAppRootTab(tabName: TabRoutes) {
  const navigation = getAppNavigation();
  navigation?.navigate(RootRoutes.Main, {
    screen: MainRoutes.Tab,
    params: {
      screen: tabName,
      params: {
        screen: buildAppRootTabName(tabName) as any,
      },
    },
  });
}

function navigateToHome() {
  navigateToAppRootTab(TabRoutes.Home);
}

function navigateToSwap() {
  navigateToAppRootTab(TabRoutes.Swap);
}

function navigateToMarket() {
  navigateToAppRootTab(TabRoutes.Market);
}

function navigateToNFT() {
  navigateToAppRootTab(TabRoutes.NFT);
}

function navigateToDiscover() {
  navigateToAppRootTab(TabRoutes.Discover);
}

function navigateToMe() {
  navigateToAppRootTab(TabRoutes.Me);
}

function navigateToDeveloper() {
  navigateToAppRootTab(TabRoutes.Developer);
}

// TODO background check, not allowed in background
export const navigationShortcuts = {
  navigateToAppRootTab,
  navigateToHome,
  navigateToDiscover,
  navigateToMarket,
  navigateToSwap,
  navigateToDeveloper,
  navigateToNFT,
  navigateToMe,
  navigateToTokenDetail,
  navigateToMarketDetail,
};
if (process.env.NODE_ENV !== 'production') {
  global.$$navigationShortcuts = navigationShortcuts;
}
