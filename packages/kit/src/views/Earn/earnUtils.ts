import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalStakingRoutes,
  ERootRoutes,
  ETabEarnRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IEarnAvailableAssetProtocol } from '@onekeyhq/shared/types/earn';

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

  toTokenProviderListPage: async (
    navigation: ReturnType<typeof useAppNavigation>,
    {
      networkId,
      accountId,
      indexedAccountId,
      symbol,
      protocols,
      logoURI,
    }: {
      networkId: string;
      accountId: string;
      indexedAccountId?: string;
      symbol: string;
      protocols: IEarnAvailableAssetProtocol[];
      logoURI?: string;
    },
  ) => {
    defaultLogger.staking.page.selectAsset({ tokenSymbol: symbol });

    if (protocols.length === 1) {
      // Only fetch earnAccount if we have an accountId
      let earnAccount;
      if (accountId || indexedAccountId) {
        try {
          earnAccount = await backgroundApiProxy.serviceStaking.getEarnAccount({
            accountId,
            indexedAccountId,
            networkId,
          });
        } catch (error) {
          // Continue with original accountId even if fetch fails
        }
      }

      const protocol = protocols[0];
      navigation.navigate(ERootRoutes.Main, {
        screen: ETabRoutes.Earn,
        params: {
          screen: ETabEarnRoutes.EarnProtocolDetails,
          params: {
            networkId: protocol.networkId,
            accountId: earnAccount?.accountId || accountId,
            indexedAccountId:
              earnAccount?.account.indexedAccountId || indexedAccountId,
            symbol,
            provider: protocol.provider,
            vault: protocol.vault,
          },
        },
      });
      return;
    }

    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Earn,
      params: {
        screen: ETabEarnRoutes.EarnProtocols,
        params: {
          symbol,
          filterNetworkId: undefined,
          logoURI: encodeURIComponent(logoURI ?? ''),
        },
      },
    });
  },
};
