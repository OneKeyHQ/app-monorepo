import { useCallback, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { EarnNavigation } from '../earnUtils';

// OK-59303: the protocol-count probe below only decides which route to open,
// so it must never hold the tap hostage. Past this budget the asset's own
// protocol list is authoritative enough to navigate on, and the request keeps
// warming ServiceStaking's 5s memoize for the next tap.
const PROTOCOL_COUNT_PROBE_TIMEOUT = 800;

export function useNavigateToEarnAsset() {
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountId = activeAccount.account?.id;
  const accountReady = activeAccount.ready;
  const activeNetworkId = activeAccount.network?.id;
  // A tap that is still resolving must not queue another navigation: repeated
  // taps on an unresponsive row used to stack pushes that all landed at once.
  const isNavigatingRef = useRef(false);

  return useCallback(
    async (
      asset: IEarnAvailableAsset,
      categoryType?: EAvailableAssetsTypeEnum,
    ) => {
      if (isNavigatingRef.current) {
        return;
      }
      isNavigatingRef.current = true;

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

      try {
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
            const allProtocols = await Promise.race([
              backgroundApiProxy.serviceStaking.getProtocolList({
                symbol: asset.symbol,
                accountId,
                networkId: accountNetworkId,
                includeWithdrawOnly: true,
              }),
              waitAsync(PROTOCOL_COUNT_PROBE_TIMEOUT).then(() => {
                // Resolving to undefined keeps the asset's own protocol count
                // instead of pretending the symbol has no protocol at all.
                return undefined;
              }),
            ]);
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
              logoURI: asset.logoURI,
            });
            return;
          }
        }

        navigateToProtocolList();
      } finally {
        isNavigatingRef.current = false;
      }
    },
    [accountId, accountReady, activeNetworkId, navigation],
  );
}
