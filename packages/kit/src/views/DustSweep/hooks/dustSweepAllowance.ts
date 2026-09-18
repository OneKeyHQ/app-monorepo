import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

const ALLOWANCE_POLL_INTERVAL_MS = 3000;
const ALLOWANCE_POLL_ATTEMPTS = 20;

async function waitForAllowance(params: {
  accountId: string;
  networkId: string;
  tokenAddress: string;
  spenderAddress: string;
  walletAddress: string;
  amount: string;
}) {
  for (let attempt = 0; attempt < ALLOWANCE_POLL_ATTEMPTS; attempt += 1) {
    const allowance =
      await backgroundApiProxy.serviceSwap.fetchApproveAllowanceForDisplay({
        accountId: params.accountId,
        networkId: params.networkId,
        tokenAddress: params.tokenAddress,
        spenderAddress: params.spenderAddress,
        walletAddress: params.walletAddress,
        amount: params.amount,
      });
    const approvedAmount = new BigNumber(allowance.approveAmounted ?? '0');
    const satisfied =
      params.amount === '0'
        ? approvedAmount.isZero()
        : approvedAmount.gte(params.amount);
    if (!approvedAmount.isNaN() && satisfied) return;
    await new Promise((resolve) =>
      setTimeout(resolve, ALLOWANCE_POLL_INTERVAL_MS),
    );
  }
  throw new OneKeyLocalError('Dust Sweep approval is still pending');
}

export async function ensureDustSweepAllowance({
  accountId,
  userAddress,
  token,
  amount,
  quote,
  approveAddress,
}: {
  accountId: string;
  userAddress: string;
  token: ISwapToken;
  amount: string;
  quote: IFetchQuoteResult;
  approveAddress?: string;
}) {
  if (token.isNative || !token.contractAddress) return;

  const spenderAddress =
    quote.allowanceResult?.allowanceTarget ?? approveAddress;
  if (!spenderAddress) return;

  const allowance =
    await backgroundApiProxy.serviceSwap.fetchApproveAllowanceForDisplay({
      accountId,
      networkId: token.networkId,
      tokenAddress: token.contractAddress,
      spenderAddress,
      walletAddress: userAddress,
      amount,
    });
  if (allowance.isApproved) return;

  const tokenInfo = {
    ...quote.fromTokenInfo,
    isNative: false,
    address: token.contractAddress,
    name: quote.fromTokenInfo.name ?? quote.fromTokenInfo.symbol,
  };
  const approveAmounts = allowance.shouldResetApprove
    ? ['0', amount]
    : [amount];

  for (const approveAmount of approveAmounts) {
    const approveInfo = {
      owner: userAddress,
      spender: spenderAddress,
      amount: approveAmount,
      isMax: approveAmount !== '0',
      tokenInfo,
      swapApproveRes: undefined,
    };
    const unsignedTx =
      await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
        networkId: token.networkId,
        accountId,
        approveInfo,
        isInternalSwap: true,
      });
    await backgroundApiProxy.serviceSend.signAndSendTransaction({
      networkId: token.networkId,
      accountId,
      unsignedTx,
      signOnly: false,
    });
    await waitForAllowance({
      accountId,
      networkId: token.networkId,
      tokenAddress: token.contractAddress,
      spenderAddress,
      walletAddress: userAddress,
      amount: approveAmount,
    });
  }
}
