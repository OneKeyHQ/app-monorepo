import { StackActions } from '@react-navigation/native';

import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { WEB_APP_URL } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabHomeRoutes } from '@onekeyhq/shared/src/routes';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

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
  address: string | undefined;
  networkId: string | undefined;
  networkCode: string | undefined;
};

// http://localhost:3000/wallet/account/evm--1/0xF907eBC4348b02F4b808Ec84591AAfD281c4422D
// export const urlAccountLandingRewrite = '/wallet/account/:address/:networkId?';
export const urlAccountLandingRewrite = '/:networkId/:address?'; // visible url
// export const urlAccountPageRewrite = '/url-account/:networkId/:address'; // hidden url
export function buildUrlAccountLandingRoute({
  address,
  networkId,
  networkCode,
  includingOrigin,
}: IUrlAccountRouteBuildParams & {
  includingOrigin?: boolean;
}) {
  const path = `/${networkCode || networkId || ''}/${address || ''}`;
  if (includingOrigin) {
    const origin = platformEnv.isWeb ? window.location.origin : WEB_APP_URL;
    return `${origin}${path}`;
  }
  return path;
}

export function buildUrlAccountFullUrl({
  account,
  network,
}: {
  account: INetworkAccount;
  network: IServerNetwork;
}) {
  return buildUrlAccountLandingRoute({
    address: account.address,
    networkId: network.id,
    networkCode: network.code,
    includingOrigin: true,
  });
}

export function replaceUrlAccountLandingRoute({
  address,
  networkId,
  networkCode,
}: IUrlAccountRouteBuildParams) {
  if (!platformEnv.isWeb) return;
  if (address && (networkId || networkCode)) {
    const url = buildUrlAccountLandingRoute({
      address,
      networkId,
      networkCode,
    });
    window.history.replaceState(null, '', url);
  } else {
    window.history.replaceState(null, '', '/');
  }
  savePrevUrlAccount({ address, networkId });
}

export const urlAccountNavigation = {
  pushHomePage(navigation: IAppNavigation) {
    navigation.dispatch(
      // StackActions.replace(ETabHomeRoutes.TabHome, routeParams),
      // StackActions.replace(ETabHomeRoutes.TabHome),
      StackActions.push(ETabHomeRoutes.TabHome),
    );
  },
  replaceHomePage(navigation: IAppNavigation) {
    navigation.dispatch(
      // StackActions.replace(ETabHomeRoutes.TabHome, routeParams),
      StackActions.replace(ETabHomeRoutes.TabHome),
    );
  },
  pushUrlAccountPage(
    navigation: IAppNavigation,
    params: {
      address: string | undefined;
      networkId: string | undefined;
    },
  ) {
    navigation.dispatch(
      StackActions.push(ETabHomeRoutes.TabHomeUrlAccountPage, params),
    );
  },
};
