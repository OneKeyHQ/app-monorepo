import { rootNavigationRef } from '@onekeyhq/components';
import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalStakingRoutes,
  ERootRoutes,
  ETabEarnRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import type useAppNavigation from '../../hooks/useAppNavigation';
import type { IAppNavigation } from '../../hooks/useAppNavigation';

const NetworkNameToIdMap: Record<string, string> = {
  ethereum: getNetworkIdsMap().eth,
  btc: getNetworkIdsMap().btc,
  sui: getNetworkIdsMap().sui,
  solana: getNetworkIdsMap().sol,
  aptos: getNetworkIdsMap().apt,
  cosmos: getNetworkIdsMap().cosmoshub,
  sbtc: getNetworkIdsMap().sbtc,
  bsc: getNetworkIdsMap().bsc,
};

const NetworkIdToNameMap: Record<string, string> = Object.fromEntries(
  Object.entries(NetworkNameToIdMap).map(([name, id]) => [id, name]),
);

export const EarnNetworkUtils = {
  // convert network name to network id
  getNetworkIdByName(networkName: string): string | undefined {
    return NetworkNameToIdMap[networkName.toLowerCase()];
  },

  // convert network id to network name
  getNetworkNameById(networkId: string): string | undefined {
    return NetworkIdToNameMap[networkId];
  },

  // generate share link network param
  getShareNetworkParam(networkId: string): string {
    return this.getNetworkNameById(networkId) || 'unknown';
  },
};

async function safePushToEarnRoute(
  navigation: IAppNavigation,
  route: ETabEarnRoutes,
  params?: any,
) {
  const rootState = rootNavigationRef.current?.getRootState?.();
  const mainRoute = rootState?.routes?.find((r) => r.name === ERootRoutes.Main);

  const tabState =
    (mainRoute as { state?: { index?: number; routes?: { name?: string }[] } })
      ?.state || {};
  const currentTab = tabState.routes?.[tabState.index ?? 0]?.name as
    | ETabRoutes
    | undefined;

  // 在「发现」Tab 内的 DeFi 子页，保持在当前 Tab 栈内导航，避免切到隐藏的 Earn Tab。
  if (currentTab === ETabRoutes.Discovery) {
    if (rootNavigationRef.current) {
      rootNavigationRef.current.navigate(ERootRoutes.Main, {
        screen: ETabRoutes.Discovery,
        params: {
          screen: route,
          params,
        },
      });
    } else {
      navigation.navigate(ETabRoutes.Discovery as any, {
        screen: route,
        params,
      });
    }
    return;
  }

  if (currentTab !== ETabRoutes.Earn) {
    navigation.switchTab(ETabRoutes.Earn, {
      screen: route,
      params,
    });
    return;
  }

  navigation.navigate(ERootRoutes.Main, {
    screen: ETabRoutes.Earn,
    params: {
      screen: route,
      params,
    },
  });
}

export const EarnNavigation = {
  // navigate from deep link (compatible with old format)
  async pushDetailPageFromDeeplink(
    navigation: IAppNavigation,
    {
      accountId,
      networkId,
      indexedAccountId,
      symbol,
      provider,
      vault,
    }: {
      accountId?: string;
      networkId: string;
      indexedAccountId?: string;
      symbol: string;
      provider: string;
      vault?: string;
    },
  ) {
    const earnAccount = await backgroundApiProxy.serviceStaking.getEarnAccount({
      accountId: accountId ?? '',
      indexedAccountId,
      networkId,
    });
    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Earn,
      params: {
        screen: ETabEarnRoutes.EarnProtocolDetails,
        params: {
          accountId: earnAccount?.accountId || accountId || '',
          networkId,
          indexedAccountId:
            earnAccount?.account.indexedAccountId || indexedAccountId,
          symbol,
          provider,
          vault,
        },
      },
    });
  },

  // navigate from new share link
  pushDetailPageFromShareLink(
    navigation: IAppNavigation,
    {
      network,
      symbol,
      provider,
      vault,
    }: {
      network: string;
      symbol: string;
      provider: string;
      vault?: string;
    },
  ) {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.ProtocolDetailsV2Share,
      params: {
        network,
        symbol,
        provider,
        vault,
      },
    });
  },

  // generate share link (for modal)
  generateShareLink({
    networkId,
    symbol,
    provider,
    vault,
    isDevMode = false,
  }: {
    networkId: string;
    symbol: string;
    provider: string;
    vault?: string;
    isDevMode?: boolean;
  }): string {
    let origin = WEB_APP_URL;
    if (platformEnv.isWeb) {
      origin = globalThis.location.origin;
    }
    if (!platformEnv.isWeb && isDevMode) {
      origin = WEB_APP_URL_DEV;
    }

    const networkName = EarnNetworkUtils.getShareNetworkParam(networkId);
    const baseUrl = `/defi/${networkName}/${symbol.toLowerCase()}/${provider.toLowerCase()}`;
    const queryParams = new URLSearchParams();

    if (vault) {
      queryParams.append('vault', vault);
    }

    const queryString = queryParams.toString();
    return queryString
      ? `${origin}${baseUrl}?${queryString}`
      : `${origin}${baseUrl}`;
  },

  // generate earn share link (for EarnProtocolDetails page)
  generateEarnShareLink({
    networkId,
    symbol,
    provider,
    vault,
    isDevMode = false,
  }: {
    networkId: string;
    symbol: string;
    provider: string;
    vault?: string;
    isDevMode?: boolean;
  }): string {
    let origin = WEB_APP_URL;
    if (platformEnv.isWeb) {
      origin = globalThis.location.origin;
    }
    if (!platformEnv.isWeb && isDevMode) {
      origin = WEB_APP_URL_DEV;
    }

    const networkName = EarnNetworkUtils.getShareNetworkParam(networkId);
    const baseUrl = `/earn/${networkName}/${symbol.toLowerCase()}/${provider.toLowerCase()}`;
    const queryParams = new URLSearchParams();

    if (vault) {
      queryParams.append('vault', vault);
    }

    const queryString = queryParams.toString();
    return queryString
      ? `${origin}${baseUrl}?${queryString}`
      : `${origin}${baseUrl}`;
  },

  pushToEarnHome(
    navigation: IAppNavigation,
    params?: {
      tab?: 'assets' | 'portfolio' | 'faqs';
    },
  ) {
    void safePushToEarnRoute(navigation, ETabEarnRoutes.EarnHome, params);
  },

  pushToEarnProtocols(
    navigation: IAppNavigation,
    params: {
      symbol: string;
      filterNetworkId?: string;
      logoURI?: string;
    },
  ) {
    void safePushToEarnRoute(navigation, ETabEarnRoutes.EarnProtocols, params);
  },

  async pushToEarnProtocolDetails(
    navigation: IAppNavigation,
    params: {
      networkId: string;
      accountId?: string;
      indexedAccountId?: string;
      symbol: string;
      provider: string;
      vault?: string;
    },
  ) {
    let earnAccount;
    if (params.accountId || params.indexedAccountId) {
      try {
        earnAccount = await backgroundApiProxy.serviceStaking.getEarnAccount({
          accountId: params.accountId ?? '',
          indexedAccountId: params.indexedAccountId,
          networkId: params.networkId,
        });
      } catch (e) {
        console.log('Failed to get earn account', e);
        // ignore error
      }
    }

    void safePushToEarnRoute(navigation, ETabEarnRoutes.EarnProtocolDetails, {
      networkId: params.networkId,
      accountId: earnAccount?.accountId || params.accountId || '',
      indexedAccountId:
        earnAccount?.account.indexedAccountId || params.indexedAccountId,
      symbol: params.symbol,
      provider: params.provider,
      vault: params.vault,
    });
  },

  pushToEarnProtocolDetailsShare(
    navigation: IAppNavigation,
    params: {
      network: string;
      symbol: string;
      provider: string;
      vault?: string;
    },
  ) {
    void safePushToEarnRoute(
      navigation,
      ETabEarnRoutes.EarnProtocolDetailsShare,
      params,
    );
  },
};
