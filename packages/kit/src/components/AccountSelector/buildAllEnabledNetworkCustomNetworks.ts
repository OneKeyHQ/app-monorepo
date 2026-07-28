import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import networkUtils, {
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';

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

  const [{ enabledNetworks, disabledNetworks }, networksResp] =
    await Promise.all([
      backgroundApiProxy.serviceAllNetwork.getAllNetworksState(),
      backgroundApiProxy.serviceNetwork.getAllNetworks({
        excludeTestNetwork: true,
        excludeAllNetworkItem: true,
      }),
    ]);

  const enabledNetworkIds = networksResp.networks
    .filter((network) =>
      isEnabledNetworksInAllNetworks({
        networkId: network.id,
        disabledNetworks,
        enabledNetworks,
        isTestnet: network.isTestnet,
      }),
    )
    .map((network) => network.id);

  const compatibleNetworks =
    await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
      {
        walletId,
        networkIds: enabledNetworkIds,
      },
    );

  const networksByImpl: Record<string, typeof compatibleNetworks.mainnetItems> =
    {};

  for (const network of compatibleNetworks.mainnetItems) {
    networksByImpl[network.impl] = networksByImpl[network.impl] ?? [];
    networksByImpl[network.impl].push(network);
  }

  const { accounts: allDbAccounts } =
    await backgroundApiProxy.serviceAccount.getAllAccounts();

  const customNetworks: {
    networkId: string;
    deriveType: IAccountDeriveTypes;
  }[] = [];

  for (const networksInGroup of Object.values(networksByImpl)) {
    const firstNetwork = networksInGroup[0];
    if (firstNetwork) {
      const [{ networkAccounts }, vaultSettings] = await Promise.all([
        backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
          {
            allDbAccounts,
            skipDbQueryIfNotFoundFromAllDbAccounts: true,
            indexedAccountId,
            networkId: firstNetwork.id,
            excludeEmptyAccount: true,
          },
        ),
        backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId: firstNetwork.id,
        }),
      ]);

      let shouldCreateGroup = !networkAccounts || networkAccounts.length === 0;
      if (!shouldCreateGroup && !vaultSettings.mergeDeriveAssetsEnabled) {
        const currentDeriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: firstNetwork.id,
          });
        shouldCreateGroup = !networkAccounts.some(
          (account) => account.deriveType === currentDeriveType,
        );
      }

      if (shouldCreateGroup) {
        for (const network of networksInGroup) {
          customNetworks.push({
            networkId: network.id,
            deriveType:
              await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                {
                  networkId: network.id,
                },
              ),
          });
        }
      }
    }
  }

  return customNetworks;
}
