import { IMPL_ADA } from '@onekeyhq/shared/src/engine/engineConsts';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

function isCardanoNetworkId(networkId?: string) {
  return Boolean(
    networkId && networkUtils.getNetworkImpl({ networkId }) === IMPL_ADA,
  );
}

/**
 * Returns true when wallet creation will immediately derive a Cardano account,
 * so the initial V2 wallet session can request Cardano seed derivation upfront.
 */
export function shouldDeriveCardanoForWalletSession({
  networkId,
  customNetworks,
}: {
  networkId?: string;
  customNetworks?: { networkId: string }[];
}): boolean {
  if (isCardanoNetworkId(networkId)) {
    return true;
  }
  return Boolean(
    customNetworks?.some((network) => isCardanoNetworkId(network.networkId)),
  );
}
