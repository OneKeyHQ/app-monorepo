import networkUtils, {
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

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

export type IHomeWalletTabSupportConfirmedCache = Map<
  string,
  IScopedHomeWalletTabSupportState
>;

export const HOME_WALLET_TAB_SUPPORT_CACHE_MAX_SIZE = 8;

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

export function rememberConfirmedHomeWalletTabSupport({
  confirmedByScope,
  result,
  scopeKey,
  maxSize = HOME_WALLET_TAB_SUPPORT_CACHE_MAX_SIZE,
}: {
  confirmedByScope: IHomeWalletTabSupportConfirmedCache;
  result: IScopedHomeWalletTabSupportState | undefined;
  scopeKey: string;
  maxSize?: number;
}) {
  if (result?.scopeKey !== scopeKey || !result.isReady || maxSize <= 0) {
    return;
  }

  confirmedByScope.delete(scopeKey);
  confirmedByScope.set(scopeKey, result);
  while (confirmedByScope.size > maxSize) {
    const oldestScopeKey = confirmedByScope.keys().next().value;
    if (oldestScopeKey === undefined) {
      break;
    }
    confirmedByScope.delete(oldestScopeKey);
  }
}

function applyHomeWalletTabPerpsConfig({
  state,
  perpDisabled,
}: {
  state: IHomeWalletTabSupportState;
  perpDisabled: boolean;
}): IHomeWalletTabSupportState {
  return {
    ...state,
    isPerpsSupported: state.isReady && state.isDeFiSupported && !perpDisabled,
  };
}

export function resolveHomeWalletTabSupport({
  result,
  scopeKey,
  confirmedByScope,
  perpDisabled,
}: {
  result: IScopedHomeWalletTabSupportState | undefined;
  scopeKey: string;
  confirmedByScope: IHomeWalletTabSupportConfirmedCache;
  perpDisabled: boolean;
}): IHomeWalletTabSupportState {
  if (result?.scopeKey === scopeKey && result.isReady) {
    return applyHomeWalletTabPerpsConfig({ state: result, perpDisabled });
  }

  const confirmed = confirmedByScope.get(scopeKey);
  if (confirmed) {
    confirmedByScope.delete(scopeKey);
    confirmedByScope.set(scopeKey, confirmed);
    return applyHomeWalletTabPerpsConfig({
      state: confirmed,
      perpDisabled,
    });
  }

  return result?.scopeKey === scopeKey ? result : HOME_WALLET_TAB_SUPPORT_INIT;
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
      // All Networks is an aggregate product surface. Keep DeFi available even
      // while the enabled-network capability map is refreshing or temporarily
      // incomplete; Perps still respects its independent global kill switch.
      isDeFiSupported = true;
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
