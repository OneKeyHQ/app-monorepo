import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

export async function buildAllEnabledNetworkCustomNetworks({
  walletId,
  networkId,
  indexedAccountId,
}: {
  walletId: string | undefined;
  networkId: string | undefined;
  indexedAccountId: string | undefined;
}): Promise<
  {
    networkId: string;
    deriveType: IAccountDeriveTypes;
  }[]
> {
  if (
    !walletId ||
    !indexedAccountId ||
    !networkId ||
    !networkUtils.isAllNetwork({ networkId })
  ) {
    return [];
  }

  const { compatibleNetworksWithoutAccount, networkInfoMap } =
    await backgroundApiProxy.serviceAllNetwork.getEnabledNetworksAccountCompatibility(
      {
        walletId,
        indexedAccountId,
        filterNetworksWithoutAccount: true,
        withNetworksInfo: true,
      },
    );

  return compatibleNetworksWithoutAccount.map((network) => ({
    networkId: network.id,
    deriveType: networkInfoMap[network.id].deriveType,
  }));
}
