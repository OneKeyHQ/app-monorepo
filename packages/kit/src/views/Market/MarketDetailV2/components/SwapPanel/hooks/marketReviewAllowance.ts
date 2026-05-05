import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';

export type IMarketReviewAllowanceState = {
  allowanceTarget?: string;
  shouldApprove: boolean;
  shouldResetApprove: boolean;
};

type IResolveMarketReviewAllowanceStateParams = {
  amount: string;
  currentState: IMarketReviewAllowanceState;
  isWrapped?: boolean;
  spenderAddress?: string;
  token: ISwapTokenBase;
  walletAddress?: string;
};

export async function resolveMarketReviewAllowanceState({
  amount,
  currentState: _currentState,
  isWrapped,
  spenderAddress,
  token,
  walletAddress,
}: IResolveMarketReviewAllowanceStateParams): Promise<IMarketReviewAllowanceState> {
  const amountBN = new BigNumber(amount || 0);

  if (
    !spenderAddress ||
    !walletAddress ||
    amountBN.isNaN() ||
    amountBN.lte(0) ||
    token.isNative ||
    !token.contractAddress ||
    isWrapped
  ) {
    return {
      allowanceTarget: spenderAddress,
      shouldApprove: false,
      shouldResetApprove: false,
    };
  }

  try {
    const approveRes =
      await backgroundApiProxy.serviceSwap.fetchApproveAllowance({
        networkId: token.networkId,
        tokenAddress: token.contractAddress,
        spenderAddress,
        walletAddress,
        amount,
      });

    return {
      allowanceTarget: approveRes.allowanceTarget || spenderAddress,
      shouldApprove: !approveRes.isApproved,
      shouldResetApprove: !!approveRes.shouldResetApprove,
    };
  } catch {
    throw new OneKeyLocalError('Market allowance refresh failed.');
  }
}
