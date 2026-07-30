import networkUtils, { isEnabledNetworksInAllNetworks } from './networkUtils';

import type { IServerNetwork } from '../../types';

export type IHomeWalletTabSupportNetwork = Pick<
  IServerNetwork,
  'id' | 'isAllNetworks' | 'isTestnet'
>;

export type IHomeWalletTabSupportState = {
  isReady: boolean;
  isDeFiSupported: boolean;
  isPerpsSupported: boolean;
};

export type IScopedHomeWalletTabSupportState = IHomeWalletTabSupportState & {
  scopeKey: string;
};

export type IAllNetworksState = {
  enabledNetworks: Record<string, boolean>;
  disabledNetworks: Record<string, boolean>;
};

export const HOME_WALLET_TAB_SUPPORT_INIT: IHomeWalletTabSupportState = {
  isReady: false,
  isDeFiSupported: false,
  isPerpsSupported: false,
};

export function buildHomeWalletTabSupportScopeKey({
  accountScopeId,
  networkId,
  isAllNetworks,
}: {
  accountScopeId: string;
  networkId: string;
  isAllNetworks: boolean;
}) {
  return [accountScopeId, networkId, isAllNetworks ? 'all' : 'single']
    .map((part) => `${part.length}:${part}`)
    .join('|');
}

export function resolveHomeWalletTabSupportAccountScopeId({
  indexedAccountId,
  accountId,
  walletId,
}: {
  indexedAccountId?: string;
  accountId?: string;
  walletId?: string;
}) {
  return indexedAccountId || accountId || walletId || '';
}

export function resolveHomeWalletTabSupport({
  result,
  scopeKey,
  lastReadyResult,
}: {
  result: IScopedHomeWalletTabSupportState | undefined;
  scopeKey: string;
  lastReadyResult: IScopedHomeWalletTabSupportState | undefined;
}): IHomeWalletTabSupportState {
  if (result?.scopeKey === scopeKey) {
    return result;
  }

  return lastReadyResult ?? HOME_WALLET_TAB_SUPPORT_INIT;
}

export function hasDeFiSupportedEnabledNetwork({
  allNetworks,
  allNetworksState,
  deFiEnabledNetworksMap,
}: {
  allNetworks: IHomeWalletTabSupportNetwork[];
  allNetworksState: IAllNetworksState;
  deFiEnabledNetworksMap: Record<string, boolean>;
}) {
  return allNetworks.some(
    (network) =>
      !!deFiEnabledNetworksMap[network.id] &&
      isEnabledNetworksInAllNetworks({
        networkId: network.id,
        isTestnet: network.isTestnet,
        enabledNetworks: allNetworksState.enabledNetworks,
        disabledNetworks: allNetworksState.disabledNetworks,
      }),
  );
}

export function buildHomeWalletTabSupport({
  network,
  allNetworks,
  allNetworksState,
  deFiEnabledNetworksMap,
  perpDisabled,
  isReady = true,
}: {
  network?: IHomeWalletTabSupportNetwork | null;
  allNetworks?: IHomeWalletTabSupportNetwork[];
  allNetworksState?: IAllNetworksState;
  deFiEnabledNetworksMap: Record<string, boolean>;
  perpDisabled: boolean;
  isReady?: boolean;
}): IHomeWalletTabSupportState {
  if (!isReady) {
    return HOME_WALLET_TAB_SUPPORT_INIT;
  }

  let isDeFiSupported = false;

  if (network?.id) {
    if (networkUtils.isAllNetwork({ networkId: network.id })) {
      // Home treats All Networks as an aggregate product surface while its
      // capability map is unavailable. Background callers that provide the
      // enabled-network state still receive the stricter per-network verdict.
      isDeFiSupported = allNetworksState
        ? hasDeFiSupportedEnabledNetwork({
            allNetworks: allNetworks ?? [],
            allNetworksState,
            deFiEnabledNetworksMap,
          })
        : true;
    } else {
      isDeFiSupported = !!deFiEnabledNetworksMap[network.id];
    }
  }

  return {
    isReady: true,
    isDeFiSupported,
    isPerpsSupported: !perpDisabled && isDeFiSupported,
  };
}
