import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { isZcashShieldedSpend } from './zcashConfirmDisplay';

// Shielded spends show the account's private address instead of its t1;
// undefined (keep the default row) when it is unavailable.
export function useZcashConfirmAccountAddress({
  accountId,
  networkId,
  encodedTx,
}: {
  accountId: string;
  networkId: string;
  encodedTx: unknown;
}): string | undefined {
  const isShielded = isZcashShieldedSpend(encodedTx);
  const { result } = usePromiseResult(async () => {
    if (!isShielded || !accountId || !networkId) return undefined;
    try {
      const addresses =
        await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountAddresses(
          { networkId, accountId },
        );
      return addresses?.privateAddress;
    } catch (error) {
      console.error('[zcash] confirm private address unavailable', error);
      return undefined;
    }
  }, [isShielded, accountId, networkId]);
  return isShielded ? result : undefined;
}
