import { StackActions } from '@react-navigation/native';

import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { WEB_APP_URL } from '@onekeyhq/shared/src/config/appConfig';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';

const localStorageKey = '$onekeyPrevSelectedUrlAccount';
export function savePrevUrlAccount({
  address,
  networkId,
}: {
  address: string | undefined;
  networkId: string | undefined;
}) {
  if (!platformEnv.isWeb) {
    return;
  }
  if (address && networkId) {
    localStorage.setItem(
      localStorageKey,
      JSON.stringify({ address, networkId }),
    );
  } else {
    localStorage.setItem(localStorageKey, '');
  }
}

export function getPrevUrlAccount() {
  try {
    if (!platformEnv.isWeb) {
      return;
    }
    const prevAccount = localStorage.getItem(localStorageKey);
    return prevAccount
      ? (JSON.parse(prevAccount) as {
          address: string;
          networkId: string;
        })
      : undefined;
  } catch (error) {
    return undefined;
  }
}

type IUrlAccountRouteBuildParams = {
  account: INetworkAccount | undefined;
  address: string | undefined;
  networkId: string | undefined;
  networkCode: string | undefined;
};

// http://localhost:3000/wallet/account/evm--1/0xF907eBC4348b02F4b808Ec84591AAfD281c4422D
// export const urlAccountLandingRewrite = '/wallet/account/:address/:networkId?';
export const urlAccountLandingRewrite = '/:networkId/:address?'; // visible url
// export const urlAccountPageRewrite = '/url-account/:networkId/:address'; // hidden url
export async function buildUrlAccountLandingRoute({
  account,
  address,
  networkId,
  networkCode,
  includingOrigin,
}: IUrlAccountRouteBuildParams & {
  includingOrigin?: boolean;
}) {
  const isAllNetwork = networkUtils.isAllNetwork({ networkId });
  let networkSegment = networkCode || networkId || '';
  if (isAllNetwork) {
    let createAtNetworkCode = '';
    networkSegment = account?.createAtNetwork || '';
    if (account?.createAtNetwork) {
      const createAtNetworkInfo =
        await backgroundApiProxy.serviceNetwork.getNetworkSafe({
          networkId: account?.createAtNetwork,
        });
      createAtNetworkCode = createAtNetworkInfo?.code || '';
    }
    const isEvm = networkUtils.isEvmNetwork({ networkId: networkSegment });
    if (isEvm) {
      networkSegment = IMPL_EVM;
    } else {
      networkSegment =
        createAtNetworkCode || account?.createAtNetwork || networkSegment;
    }
  }
  const path = `/${networkSegment || '--'}/${address || '--'}`;
  if (includingOrigin) {
    const origin =
      platformEnv.isWeb && !platformEnv.isDev
        ? window.location.origin
        : WEB_APP_URL;
    return `${origin}${path}`;
  }
  return path;
}

export async function buildUrlAccountFullUrl({
  account,
  network,
}: {
  account: INetworkAccount;
  network: IServerNetwork;
}) {
  return buildUrlAccountLandingRoute({
    account,
    address: account.address,
    networkId: network.id,
    networkCode: network.code,
    includingOrigin: true,
  });
}

export async function replaceUrlAccountLandingRoute({
  account,
  address,
  networkId,
  networkCode,
}: IUrlAccountRouteBuildParams) {
  if (!platformEnv.isWeb) {
    return;
  }
  if (address && (networkId || networkCode)) {
    const url = await buildUrlAccountLandingRoute({
      account,
      address,
      networkId,
      networkCode,
    });
    window.history.replaceState(null, '', url);
  } else {
    window.history.replaceState(null, '', '/');
  }
  if (accountUtils.isUrlAccountFn({ accountId: account?.id })) {
    savePrevUrlAccount({ address, networkId });
  }
}

export const urlAccountNavigation = {
  pushHomePage(navigation: IAppNavigation) {
    navigation.dispatch(
      // StackActions.replace(ETabHomeRoutes.TabHome, routeParams),
      // StackActions.replace(ETabHomeRoutes.TabHome),
      StackActions.push(ETabHomeRoutes.TabHome),
    );
  },
  replaceHomePage(navigation: IAppNavigation, params?: object | undefined) {
    navigation.dispatch(
      // StackActions.replace(ETabHomeRoutes.TabHome, routeParams),
      StackActions.replace(ETabHomeRoutes.TabHome, params),
    );
  },
  pushUrlAccountPage(
    navigation: IAppNavigation,
    params: {
      address: string | undefined;
      networkId: string | undefined;
      activeAccountNetworkId?: string;
    },
  ) {
    navigation.dispatch(
      StackActions.push(ETabHomeRoutes.TabHomeUrlAccountPage, params),
    );
  },
  pushUrlAccountPageLanding(
    navigation: IAppNavigation,
    params: {
      address: string | undefined;
      networkId: string | undefined;
    },
  ) {
    navigation.dispatch(
      StackActions.push(ETabHomeRoutes.TabHomeUrlAccountLanding, params),
    );
  },
  async pushUrlAccountPageFromDeeplink(
    navigation: IAppNavigation,
    params: {
      address: string | undefined;
      networkId: string | undefined;
    },
  ) {
    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Home,
      params: {
        screen: ETabHomeRoutes.TabHome,
      },
    });

    await timerUtils.wait(100);
    console.log('pushUrlAccountPageFromDeeplink >>>>>', params);
    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Home,
      params: {
        screen: ETabHomeRoutes.TabHomeUrlAccountPage,
        params,
      },
    });
  },
};
