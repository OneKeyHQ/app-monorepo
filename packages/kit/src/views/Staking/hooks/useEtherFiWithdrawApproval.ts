import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { getEtherFiVaultConfig } from '@onekeyhq/shared/src/utils/etherFiVaults';
import { EApproveType } from '@onekeyhq/shared/types/staking';

export function useEtherFiWithdrawApproval({
  enabled,
  accountId,
  networkId,
  provider,
  symbol,
  vault,
}: {
  enabled: boolean;
  accountId: string;
  networkId: string;
  provider: string;
  symbol?: string;
  vault?: string;
}) {
  const scope = useMemo(
    () => ({ enabled, accountId, networkId, provider, symbol, vault }),
    [enabled, accountId, networkId, provider, symbol, vault],
  );
  const { result, run } = usePromiseResult(
    async () => {
      if (!scope.enabled) return undefined;
      const expected = getEtherFiVaultConfig(scope.vault);
      if (
        !scope.accountId ||
        !scope.symbol ||
        !scope.vault ||
        !expected ||
        scope.networkId !== getNetworkIdsMap().eth
      ) {
        return { scope, error: true };
      }
      try {
        const detail =
          await backgroundApiProxy.serviceStaking.getProtocolDetailsV2({
            accountId: scope.accountId,
            networkId: scope.networkId,
            provider: scope.provider,
            symbol: scope.symbol,
            vault: scope.vault,
          });
        const approval = detail.withdrawApprove;
        if (
          detail.protocol?.provider.toLowerCase() !==
            scope.provider.toLowerCase() ||
          detail.protocol.networkId !== scope.networkId ||
          detail.protocol.symbol.toLowerCase() !== scope.symbol.toLowerCase() ||
          detail.protocol.vault.toLowerCase() !== scope.vault.toLowerCase() ||
          approval?.approveType !== EApproveType.Legacy ||
          approval.amountUnit !== 'shares' ||
          approval.tokenAddress?.toLowerCase() !== scope.vault.toLowerCase() ||
          approval.approveTarget?.toLowerCase() !== expected.queue
        ) {
          return { scope, error: true };
        }
        return { scope, approval };
      } catch {
        return { scope, error: true };
      }
    },
    [scope],
    { undefinedResultIfReRun: true, resumeOnEffectReconnect: true },
  );
  const current = result?.scope === scope ? result : undefined;
  return {
    approval: current?.approval,
    error: Boolean(current?.error),
    retry: run,
  };
}
