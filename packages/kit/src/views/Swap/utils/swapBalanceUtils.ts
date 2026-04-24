import BigNumber from 'bignumber.js';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

type ISwapLatestBalanceCheckParams = {
  token: ISwapToken;
  amount: string;
  accountId?: string;
  accountAddress?: string;
};

export type ISwapLatestBalanceCheckResult =
  | {
      isSufficient: true;
    }
  | {
      isSufficient: false;
      balance: string;
      requiredAmount: string;
      tokenSymbol: string;
    };

export async function checkSwapLatestBalanceSufficient({
  token,
  amount,
  accountId,
  accountAddress,
}: ISwapLatestBalanceCheckParams): Promise<ISwapLatestBalanceCheckResult> {
  const amountBN = new BigNumber(amount || 0);
  if (
    !token?.networkId ||
    !accountAddress ||
    amountBN.isNaN() ||
    !amountBN.isFinite() ||
    amountBN.lte(0)
  ) {
    return { isSufficient: true };
  }

  try {
    const tokenBalanceInfo =
      await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
        networkId: token.networkId,
        contractAddress: token.contractAddress ?? '',
        accountAddress,
        accountId,
        currency: 'usd',
      });
    if (!tokenBalanceInfo?.length) {
      return { isSufficient: true };
    }

    const balanceBN = new BigNumber(tokenBalanceInfo[0].balanceParsed ?? 0);
    if (balanceBN.isNaN() || !balanceBN.isFinite()) {
      return { isSufficient: true };
    }

    if (amountBN.gt(balanceBN)) {
      return {
        isSufficient: false,
        balance: balanceBN.toFixed(),
        requiredAmount: amountBN.toFixed(),
        tokenSymbol: token.symbol,
      };
    }
  } catch (error) {
    console.error('checkSwapLatestBalanceSufficient error', error);
  }

  return { isSufficient: true };
}
