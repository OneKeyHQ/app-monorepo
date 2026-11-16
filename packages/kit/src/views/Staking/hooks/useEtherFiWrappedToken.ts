import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EthereumWETH } from '@onekeyhq/shared/src/consts/addresses';

export function useEtherFiWrappedToken({
  enabled,
  accountId,
  networkId,
}: {
  enabled: boolean;
  accountId: string;
  networkId: string;
}) {
  const scope = useMemo(
    () => ({ enabled, accountId, networkId }),
    [enabled, accountId, networkId],
  );
  const { result, run } = usePromiseResult(
    async () => {
      if (!scope.enabled || scope.networkId !== getNetworkIdsMap().eth) {
        return undefined;
      }
      try {
        const details =
          await backgroundApiProxy.serviceToken.fetchTokensDetails({
            accountId: scope.accountId,
            networkId: scope.networkId,
            contractList: [EthereumWETH],
          });
        const token = details[0]?.info;
        if (
          !token ||
          token.isNative ||
          token.address?.toLowerCase() !== EthereumWETH.toLowerCase() ||
          token.symbol?.toUpperCase() !== 'WETH' ||
          token.decimals !== 18 ||
          (token.networkId && token.networkId !== scope.networkId)
        ) {
          return { scope, error: true };
        }
        return { scope, token };
      } catch {
        return { scope, error: true };
      }
    },
    [scope],
    { undefinedResultIfReRun: true, resumeOnEffectReconnect: true },
  );
  const current = result?.scope === scope ? result : undefined;
  return { token: current?.token, error: Boolean(current?.error), retry: run };
}
