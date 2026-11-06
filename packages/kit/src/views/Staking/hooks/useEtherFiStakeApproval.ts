import { useLayoutEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EtherFiLiquidReferContract } from '@onekeyhq/shared/src/consts/addresses';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EApproveType } from '@onekeyhq/shared/types/staking';

export function useEtherFiStakeApproval({
  enabled,
  networkId,
  provider,
  symbol,
  vault,
  wrappedNative = false,
}: {
  enabled: boolean;
  networkId: string;
  provider: string;
  symbol?: string;
  vault?: string;
  wrappedNative?: boolean;
}) {
  const scope = useMemo(
    () => ({ enabled, networkId, provider, symbol, vault, wrappedNative }),
    [enabled, networkId, provider, symbol, vault, wrappedNative],
  );
  const committedScopeRef = useRef(scope);
  useLayoutEffect(() => {
    committedScopeRef.current = scope;
  }, [scope]);
  const { result, run } = usePromiseResult(
    async () => {
      // A retry can use a callback from a suspended render; use the committed scope.
      const currentScope =
        scope === committedScopeRef.current ? scope : committedScopeRef.current;
      const {
        enabled: requestEnabled,
        networkId: requestNetworkId,
        provider: requestProvider,
        symbol: requestSymbol,
        vault: requestVault,
        wrappedNative: requestWrappedNative,
      } = currentScope;
      if (!requestEnabled || !requestSymbol || !requestVault) return undefined;
      try {
        const detail =
          await backgroundApiProxy.serviceStaking.getProtocolDetailsV2({
            networkId: requestNetworkId,
            provider: requestProvider,
            symbol: requestSymbol,
            vault: requestVault,
          });
        const protocol = detail.protocol;
        if (
          protocol?.provider.toLowerCase() !== requestProvider.toLowerCase() ||
          protocol.networkId !== requestNetworkId ||
          protocol.symbol.toLowerCase() !== requestSymbol.toLowerCase() ||
          protocol.vault.toLowerCase() !== requestVault.toLowerCase() ||
          requestNetworkId !== getNetworkIdsMap().eth
        ) {
          return { scope: currentScope, error: true };
        }
        if (requestWrappedNative) {
          if (
            requestSymbol.toUpperCase() !== 'ETH' ||
            !earnUtils.isEtherFiProvider({ providerName: requestProvider })
          ) {
            return { scope: currentScope, error: true };
          }
          // EtherFi wraps ETH to canonical WETH, which uses a legacy approval
          // to the LiquidRefer contract for the deposit.
          return {
            scope: currentScope,
            approve: {
              approveType: EApproveType.Legacy,
              approveTarget: EtherFiLiquidReferContract,
            },
          };
        }
        if (
          typeof protocol.approve?.approveTarget !== 'string' ||
          protocol.approve.approveTarget.toLowerCase() !==
            EtherFiLiquidReferContract.toLowerCase() ||
          (protocol.approve.approveType !== EApproveType.Legacy &&
            protocol.approve.approveType !== EApproveType.Permit)
        ) {
          return { scope: currentScope, error: true };
        }
        return { scope: currentScope, approve: protocol.approve };
      } catch {
        return { scope: currentScope, error: true };
      }
    },
    [scope],
    { undefinedResultIfReRun: true, resumeOnEffectReconnect: true },
  );
  const current = enabled && result?.scope === scope ? result : undefined;
  return {
    approve: current?.approve,
    error: Boolean(current?.error),
    retry: run,
  };
}
