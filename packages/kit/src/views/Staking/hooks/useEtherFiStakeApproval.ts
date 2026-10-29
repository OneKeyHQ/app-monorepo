import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

export function useEtherFiStakeApproval({
  enabled,
  networkId,
  provider,
  symbol,
  vault,
}: {
  enabled: boolean;
  networkId: string;
  provider: string;
  symbol?: string;
  vault?: string;
}) {
  const scope = [
    networkId,
    provider.toLowerCase(),
    symbol,
    vault?.toLowerCase(),
  ].join('|');
  const { result, run } = usePromiseResult(
    async () => {
      if (!enabled || !symbol || !vault) return undefined;
      try {
        const detail =
          await backgroundApiProxy.serviceStaking.getProtocolDetailsV2({
            networkId,
            provider,
            symbol,
            vault,
          });
        const protocol = detail.protocol;
        if (
          protocol?.provider.toLowerCase() !== provider.toLowerCase() ||
          protocol.networkId !== networkId ||
          protocol.symbol.toLowerCase() !== symbol.toLowerCase() ||
          protocol.vault.toLowerCase() !== vault.toLowerCase() ||
          !protocol.approve?.approveTarget ||
          !protocol.approve.approveType
        ) {
          return { scope, error: true };
        }
        return { scope, approve: protocol.approve };
      } catch {
        return { scope, error: true };
      }
    },
    [enabled, networkId, provider, scope, symbol, vault],
    { undefinedResultIfReRun: true },
  );
  const current = result?.scope === scope ? result : undefined;
  return {
    approve: current?.approve,
    error: Boolean(current?.error),
    retry: run,
  };
}
