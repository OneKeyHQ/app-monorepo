import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import type { IAppNavigation } from '../../hooks/useAppNavigation';

const NetworkNameToIdMap: Record<string, string> = {
  ethereum: getNetworkIdsMap().eth,
  btc: getNetworkIdsMap().btc,
  sui: getNetworkIdsMap().sui,
  solana: getNetworkIdsMap().sol,
  aptos: getNetworkIdsMap().apt,
  cosmos: getNetworkIdsMap().cosmoshub,
  sbtc: getNetworkIdsMap().sbtc,
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
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.ProtocolDetailsV2,
      params: {
        accountId: earnAccount?.accountId || accountId || '',
        networkId,
        indexedAccountId:
          earnAccount?.account.indexedAccountId || indexedAccountId,
        symbol,
        provider,
        vault,
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

  // generate share link
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
};
