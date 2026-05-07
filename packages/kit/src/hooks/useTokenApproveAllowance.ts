import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { usePromiseResult } from './usePromiseResult';

// Reads the current on-chain allowance(owner, spender) for a token via the
// /swap/v1/allowance backend endpoint. Used by the approve confirm page and
// the approve editor so increaseAllowance/increaseApproval transactions can
// display the post-tx total instead of just the delta.
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
        const r = await backgroundApiProxy.serviceSwap.fetchApproveAllowance({
          networkId,
          tokenAddress,
          spenderAddress: spender,
          walletAddress,
          accountId,
          amount: '0',
        });
        return r ?? null;
      } catch (e) {
        // Swallowed at the UI layer (the editor/confirm page falls back to a
        // delta-only label) but recorded so the failure is observable in
        // local logs and via the regular error pipeline.
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

  // Server returns the value already decimal-parsed (e.g. "112" for 112 LINK)
  // under the field name `approveAmounted` (backend spelling).
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
