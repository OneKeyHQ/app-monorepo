import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { usePromiseResult } from './usePromiseResult';

export function useTokenApproveAllowance({
  enabled,
  accountId,
  networkId,
  tokenAddress,
  spender,
}: {
  enabled: boolean;
  accountId: string;
  networkId: string;
  tokenAddress: string;
  spender?: string;
}) {
  const { result, isLoading } = usePromiseResult(
    async () => {
      if (!enabled || !spender || !tokenAddress) return null;
      const walletAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
      if (!walletAddress) return null;
      try {
        const r =
          await backgroundApiProxy.serviceSwap.fetchApproveAllowanceForDisplay({
            networkId,
            tokenAddress,
            spenderAddress: spender,
            walletAddress,
            accountId,
            amount: '0',
          });
        return r ?? null;
      } catch (e) {
        // UI falls back to a delta-only label; log so the failure is visible.
        defaultLogger.app.error.log(
          `useTokenApproveAllowance fetch failed: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
        return null;
      }
    },
    [accountId, enabled, networkId, spender, tokenAddress],
    { watchLoading: true },
  );

  // `approveAmounted` (sic, backend spelling) is already decimal-parsed.
  const allowanceParsed = useMemo(() => {
    const raw = result?.approveAmounted;
    if (raw === undefined || raw === null || raw === '') return null;
    const bn = new BigNumber(raw);
    return bn.isFinite() ? bn.toFixed() : null;
  }, [result]);

  return {
    allowanceParsed,
    rawAllowance: result?.approveAmounted ?? null,
    isLoading,
  };
}
