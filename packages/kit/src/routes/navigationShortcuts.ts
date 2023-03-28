import { getAppNavigation } from '../hooks/useAppNavigation';

import { buildTabName } from './Root/Main/Tab/tabNavHeader';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { HomeRoutes, MainRoutes, RootRoutes, TabRoutes } from './routesEnum';

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

// TODO background check, not allowed in background
function navigateToHome() {
  const navigation = getAppNavigation();
  navigation?.navigate(RootRoutes.Main, {
    screen: MainRoutes.Tab,
    params: {
      screen: TabRoutes.Home,
      params: {
        screen: buildTabName(TabRoutes.Home) as any,
      },
    },
  });
}
export const navigationShortcuts = {
  navigateToHome,
  navigateToTokenDetail,
};
if (process.env.NODE_ENV !== 'production') {
  global.$$navigationShortcuts = navigationShortcuts;
}
