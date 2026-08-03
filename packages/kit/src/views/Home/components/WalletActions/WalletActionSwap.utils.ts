import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ISwapInitParams } from '@onekeyhq/shared/types/swap/types';
import { ESwapSource } from '@onekeyhq/shared/types/swap/types';

export function buildWalletHomeSwapInitParams({
  isExtPopupOrSidePanel,
  networkId,
}: {
  isExtPopupOrSidePanel?: boolean;
  networkId?: string;
}): ISwapInitParams {
  const params: ISwapInitParams = {
    swapSource: ESwapSource.WALLET_HOME,
  };

  // All Networks is an aggregate Home context, not an importable Swap network.
  if (
    isExtPopupOrSidePanel ||
    !networkId ||
    networkUtils.isAllNetwork({ networkId })
  ) {
    return params;
  }

  return {
    ...params,
    importNetworkId: networkId,
  };
}
