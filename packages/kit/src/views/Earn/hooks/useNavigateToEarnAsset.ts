import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { EarnNavigation } from '../earnUtils';

export function useNavigateToEarnAsset() {
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountId = activeAccount.account?.id;
  const accountReady = activeAccount.ready;
  const activeNetworkId = activeAccount.network?.id;

  return useCallback(
    async (
      asset: IEarnAvailableAsset,
      categoryType?: EAvailableAssetsTypeEnum,
    ) => {
      defaultLogger.staking.page.selectAsset({ tokenSymbol: asset.symbol });

      const defaultCategory =
        categoryType === EAvailableAssetsTypeEnum.SimpleEarn ||
        categoryType === EAvailableAssetsTypeEnum.FixedRate
          ? (categoryType as 'simpleEarn' | 'fixedRate')
          : undefined;
      const navigateToProtocolList = () => {
        EarnNavigation.pushToEarnProtocols(navigation, {
          symbol: asset.symbol,
          filterNetworkId: undefined,
          logoURI: asset.logoURI
            ? encodeURIComponent(asset.logoURI)
            : undefined,
          defaultCategory,
        });
      };

      if (asset.protocols.length === 1) {
        const accountNetworkId =
          activeNetworkId ?? asset.protocols[0]?.networkId;
        const canQueryWithAccount =
          accountReady && Boolean(accountId) && Boolean(accountNetworkId);
        if (!canQueryWithAccount) {
          navigateToProtocolList();
          return;
        }

        let totalProtocols = 1;
        try {
          const allProtocols =
            await backgroundApiProxy.serviceStaking.getProtocolList({
              symbol: asset.symbol,
              accountId,
              networkId: accountNetworkId,
              includeWithdrawOnly: true,
            });
          totalProtocols = allProtocols?.length ?? 1;
        } catch {
          // Fall back to the protocol count already returned with the asset.
        }

        if (totalProtocols <= 1) {
          const protocol = asset.protocols[0];
          await EarnNavigation.pushToEarnProtocolDetails(navigation, {
            networkId: protocol.networkId,
            symbol: asset.symbol,
            provider: protocol.provider,
            vault: protocol.vault,
          });
          return;
        }
      }

      navigateToProtocolList();
    },
    [accountId, accountReady, activeNetworkId, navigation],
  );
}
