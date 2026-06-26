import BigNumber from 'bignumber.js';

import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

type IWaitForAllowanceAfterApproveParams = {
  requiredAmount: string;
  fetchAllowanceResponse: () => Promise<{ allowanceParsed?: string }>;
  maxAttempts?: number;
  intervalMs?: number;
  signal?: AbortSignal;
  onError?: (error: unknown) => void;
};

async function waitForAllowanceAfterApprove({
  requiredAmount,
  fetchAllowanceResponse,
  maxAttempts = 15,
  intervalMs = 2000,
  signal,
  onError,
}: IWaitForAllowanceAfterApproveParams) {
  const requiredAmountBN = new BigNumber(requiredAmount);
  if (!requiredAmountBN.isFinite() || requiredAmountBN.lte(0)) {
    return true;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      return false;
    }

    try {
      const allowanceInfo = await fetchAllowanceResponse();
      const allowanceBN = new BigNumber(allowanceInfo.allowanceParsed || '0');
      if (allowanceBN.isFinite() && allowanceBN.gte(requiredAmountBN)) {
        return true;
      }
    } catch (error) {
      onError?.(error);
    }

    if (attempt < maxAttempts - 1) {
      await timerUtils.wait(intervalMs);
    }
  }

  return false;
}

export { waitForAllowanceAfterApprove };
export type { IWaitForAllowanceAfterApproveParams };
