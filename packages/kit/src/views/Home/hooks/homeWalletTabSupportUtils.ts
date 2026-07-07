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

export type IAllNetworksState = {
  enabledNetworks: Record<string, boolean>;
  disabledNetworks: Record<string, boolean>;
};

export const HOME_WALLET_TAB_SUPPORT_INIT: IHomeWalletTabSupportState = {
  isReady: false,
  isDeFiSupported: false,
  isPerpsSupported: false,
};

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
}: {
  network?: IHomeWalletTabSupportNetwork | null;
  allNetworks?: IHomeWalletTabSupportNetwork[];
  allNetworksState?: IAllNetworksState;
  deFiEnabledNetworksMap: Record<string, boolean>;
  perpDisabled: boolean;
}): IHomeWalletTabSupportState {
  let isDeFiSupported = false;

  if (network?.id) {
    if (networkUtils.isAllNetwork({ networkId: network.id })) {
      isDeFiSupported =
        !!allNetworksState &&
        hasDeFiSupportedEnabledNetwork({
          allNetworks: allNetworks ?? [],
          allNetworksState,
          deFiEnabledNetworksMap,
        });
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
