import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { buildMarketExecutionPayload } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketBuildExecutionUtils';
import { sendMarketDirectUnsignedTxs } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketDirectSendTx';
import type { IMarketGasInfoEntry } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketDirectSendTx';
import { completeBroadcastedSwapSuccess } from '@onekeyhq/kit/src/views/Swap/hooks/swapBroadcastSuccess';
import {
  checkSwapLatestBalanceSufficient,
  getSwapRequiredNativeBalanceAmount,
} from '@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IDustSweepSnapshot,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapQuoteSource,
  ESwapTabSwitchType,
  ESwapTradeSource,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { DustSweepUserCanceled } from './DustSweepUserCanceled';
import {
  DustSweepSkip,
  fetchDustSweepQuote,
  getDustSweepQuoteRisk,
} from './quote';

export { DustSweepUserCanceled } from './DustSweepUserCanceled';

type IExecutionOptions = {
  snapshot: IDustSweepSnapshot;
  token: IDustSweepToken;
  signal: AbortSignal;
  onSigning: () => void;
  onPrepared: () => void;
  onBroadcast: (txId: string) => void;
  generateSwapHistoryItem: Parameters<
    typeof completeBroadcastedSwapSuccess
  >[0]['generateSwapHistoryItem'];
};

export class DustSweepUnknownSubmission extends OneKeyLocalError {}

function getSubmissionError(error: unknown, signing: boolean) {
  // This error is raised by the password prompt before a signature exists.
  if (
    error &&
    typeof error === 'object' &&
    'className' in error &&
    error.className === EOneKeyErrorClassNames.PasswordPromptDialogCancel
  ) {
    return new DustSweepUserCanceled();
  }
  return signing ? new DustSweepUnknownSubmission() : error;
}

function assertActive(signal: AbortSignal) {
  if (signal.aborted) throw new OneKeyLocalError('Dust Sweep cancelled');
}

export function waitDustSweepPoll(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timeout: { current?: ReturnType<typeof setTimeout> } = {};
    const finish = () => {
      clearTimeout(timeout.current);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    timeout.current = setTimeout(finish, 3000);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}

async function checkBalance(
  token: ISwapToken,
  amount: string,
  options: IExecutionOptions,
  insufficientGas = false,
) {
  assertActive(options.signal);
  const balance = await checkSwapLatestBalanceSufficient({
    token,
    amount,
    accountId: options.snapshot.accountId,
    accountAddress: options.snapshot.address,
  });
  assertActive(options.signal);
  if (balance.balance === undefined) throw new DustSweepSkip('unknown');
  if (!balance.isSufficient)
    throw new DustSweepSkip(insufficientGas ? 'insufficientGas' : 'unknown');
}

async function checkInputAndOtherFeeBalances(
  quote: IFetchQuoteResult,
  options: IExecutionOptions,
) {
  const requirements: { token: ISwapToken; amount: string }[] = [
    { token: options.token, amount: options.token.amount },
  ];
  for (const fee of quote.fee?.otherFeeInfos ?? []) {
    const amount = new BigNumber(fee.amount ?? '');
    if (!amount.isFinite() || amount.isNegative())
      throw new DustSweepSkip('unknown');
    if (!amount.isZero()) {
      if (fee.token.networkId !== options.snapshot.networkId)
        throw new DustSweepSkip('unknown');
      const existing = requirements.find((entry) =>
        equalTokenNoCaseSensitive({ token1: entry.token, token2: fee.token }),
      );
      if (existing) existing.amount = amount.plus(existing.amount).toFixed();
      else requirements.push({ token: fee.token, amount: amount.toFixed() });
    }
  }
  for (const requirement of requirements) {
    await checkBalance(requirement.token, requirement.amount, options);
  }
}

async function checkNativeGasBalance(
  gasInfos: IMarketGasInfoEntry[],
  options: IExecutionOptions,
  quote?: IFetchQuoteResult,
) {
  assertActive(options.signal);
  const requirement = getSwapRequiredNativeBalanceAmount({
    gasInfos,
    networkId: options.snapshot.networkId,
    fromToken: options.token,
    fromAmount: options.token.amount,
    otherFeeInfos: quote?.fee?.otherFeeInfos,
  });
  if (requirement) {
    await checkBalance(requirement.token, requirement.amount, options, true);
  }
}

async function ensureAllowance(
  quote: IFetchQuoteResult,
  options: IExecutionOptions,
  allowSubmit = true,
) {
  const { snapshot, token, signal, onSigning, onPrepared } = options;
  const spender =
    quote.allowanceResult?.allowanceTarget ??
    quote.approvedInfo?.allowanceTarget;
  if (!spender) {
    if (quote.approvedInfo?.isApproved) return false;
    if (
      networkUtils.isEvmNetwork({ networkId: snapshot.networkId }) ||
      networkUtils.isTronNetworkByNetworkId(snapshot.networkId)
    )
      throw new DustSweepSkip('unknown');
    return false;
  }
  const params = {
    accountId: snapshot.accountId,
    networkId: snapshot.networkId,
    tokenAddress: token.contractAddress,
    spenderAddress: spender,
    walletAddress: snapshot.address,
    amount: token.amount,
  };
  const allowance =
    await backgroundApiProxy.serviceSwap.fetchApproveAllowanceForDisplay(
      params,
    );
  assertActive(signal);
  if (allowance.isApproved) return false;
  // A changed spender after build must go through a new review, never silently approve.
  if (!allowSubmit) throw new DustSweepSkip('unknown');
  for (const amount of allowance.shouldResetApprove
    ? ['0', token.amount]
    : [token.amount]) {
    assertActive(signal);
    let txId: string | undefined;
    let signing = false;
    try {
      await sendMarketDirectUnsignedTxs({
        accountId: snapshot.accountId,
        accountAddress: snapshot.address,
        networkId: snapshot.networkId,
        buildUnsignedParams: {
          accountId: snapshot.accountId,
          networkId: snapshot.networkId,
          approveInfo: {
            owner: snapshot.address,
            spender,
            amount,
            isMax: false,
            tokenInfo: {
              address: token.contractAddress,
              decimals: token.decimals,
              symbol: token.symbol,
              name: token.name ?? token.symbol,
              isNative: false,
            },
          },
        },
        validateFinalGasInfos: (gasInfos) =>
          checkNativeGasBalance(gasInfos, options),
        onBeforeSignAndSend: () => {
          assertActive(signal);
          signing = true;
          onSigning();
        },
        onBroadcast: (signed) => {
          txId = signed.txid;
        },
      });
    } catch (error) {
      if (!txId) {
        const submissionError = getSubmissionError(error, signing);
        if (submissionError instanceof DustSweepUserCanceled) onPrepared();
        throw submissionError;
      }
      // The approval is already broadcast; history errors must not repeat it.
    }
    if (!txId) throw new DustSweepUnknownSubmission();
    let confirmedPolls = 0;
    while (!signal.aborted) {
      let approvalFailed = false;
      let allowanceUnavailable = false;
      try {
        const state = await backgroundApiProxy.serviceSwap.fetchTxState({
          txId,
          networkId: snapshot.networkId,
        });
        approvalFailed = [
          ESwapTxHistoryStatus.FAILED,
          ESwapTxHistoryStatus.CANCELED,
          ESwapTxHistoryStatus.EXPIRED,
          ESwapTxHistoryStatus.REFUNDED,
        ].includes(state.state);
        if (!approvalFailed && state.state === ESwapTxHistoryStatus.SUCCESS) {
          confirmedPolls += 1;
          const latest =
            await backgroundApiProxy.serviceSwap.fetchApproveAllowanceForDisplay(
              {
                ...params,
                amount,
              },
            );
          const approved = new BigNumber(latest.approveAmounted ?? '');
          if (
            approved.isFinite() &&
            (amount === '0' ? approved.isZero() : approved.gte(amount))
          )
            break;
          // Allow the allowance index to catch up with a confirmed transaction.
          // Stop this item instead of ever repeating an already broadcast approval.
          allowanceUnavailable = confirmedPolls >= 10;
        }
      } catch {
        /* A polling failure is not permission to submit again. */
      }
      if (approvalFailed) throw new DustSweepSkip('txFailed');
      if (allowanceUnavailable) throw new DustSweepSkip('unknown');
      await waitDustSweepPoll(signal);
    }
    assertActive(signal);
    onPrepared();
  }
  return true;
}

export async function executeDustSweepItem(
  options: IExecutionOptions,
): Promise<
  | { status: 'success'; receivedAmount?: string; receiptUnavailable: boolean }
  | { status: 'failed'; message?: string }
> {
  const {
    snapshot,
    token,
    signal,
    onSigning,
    onBroadcast,
    generateSwapHistoryItem,
  } = options;
  let quote: IFetchQuoteResult | undefined;
  // Every newly approved route is re-quoted and checked again. Bound spender
  // changes so a provider cannot keep requesting new approvals indefinitely.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const latestQuote = await fetchDustSweepQuote(token, snapshot, signal);
    const risk = getDustSweepQuoteRisk(latestQuote, token, snapshot);
    if (risk) throw new DustSweepSkip(risk, latestQuote.quoteShowTip?.detail);
    await checkInputAndOtherFeeBalances(latestQuote, options);
    if (!(await ensureAllowance(latestQuote, options, attempt < 2))) {
      quote = latestQuote;
      break;
    }
  }
  if (!quote) throw new DustSweepSkip('unknown');
  assertActive(signal);
  const buildRes = await backgroundApiProxy.serviceSwap.fetchBuildTx({
    fromToken: token,
    toToken: snapshot.nativeToken,
    fromTokenAmount: token.amount,
    toTokenAmount: quote.toAmount ?? '0',
    provider: quote.info.provider,
    userAddress: snapshot.address,
    receivingAddress: snapshot.address,
    slippagePercentage: snapshot.slippage,
    accountId: snapshot.accountId,
    quoteResultCtx: quote.quoteResultCtx,
    protocol: EProtocolOfExchange.SWAP,
    kind: ESwapQuoteKind.SELL,
    tradeSource: ESwapTradeSource.SWAP_BRIDGE,
    source: ESwapQuoteSource.SWEEP,
  });
  assertActive(signal);
  if (!buildRes) throw new DustSweepSkip('noQuote');
  const risk = getDustSweepQuoteRisk(buildRes.result, token, snapshot);
  if (risk) throw new DustSweepSkip(risk, buildRes.result.quoteShowTip?.detail);
  await checkInputAndOtherFeeBalances(buildRes.result, options);
  await ensureAllowance(
    buildRes.result.allowanceResult || buildRes.result.approvedInfo
      ? buildRes.result
      : quote,
    options,
    false,
  );
  const execution = await buildMarketExecutionPayload({
    accountId: snapshot.accountId,
    buildRes,
    currentFromToken: token,
    currentToToken: snapshot.nativeToken,
    fromAmount: token.amount,
    receivingAccountId: snapshot.accountId,
    receivingAddress: snapshot.address,
    userAddress: snapshot.address,
    slippage: snapshot.slippage,
    swapType: ESwapTabSwitchType.SWAP,
    onBuildOkxSwapEncodedTx: (params) =>
      backgroundApiProxy.serviceSwap.buildOkxSwapEncodedTx(params),
    onBuildLMSwapEncodedTx: (params) =>
      backgroundApiProxy.serviceSwap.buildLMSwapEncodedTx(params),
    onBuildInternalDappTx: (params) =>
      backgroundApiProxy.serviceStaking.buildInternalDappTx(params),
  });
  assertActive(signal);
  if (execution.skipSendTransAction || !execution.encodedTx)
    throw new DustSweepSkip('unknown');
  let txId: string | undefined;
  let signing = false;
  try {
    await sendMarketDirectUnsignedTxs({
      accountId: snapshot.accountId,
      accountAddress: snapshot.address,
      networkId: snapshot.networkId,
      buildUnsignedParams: {
        accountId: snapshot.accountId,
        networkId: snapshot.networkId,
        encodedTx: execution.encodedTx,
        transfersInfo: execution.transferInfo
          ? [execution.transferInfo]
          : undefined,
        swapInfo: execution.swapInfo,
      },
      validateFinalGasInfos: async (gasInfos) => {
        await checkNativeGasBalance(gasInfos, options, buildRes.result);
        await checkInputAndOtherFeeBalances(buildRes.result, options);
      },
      onBeforeSignAndSend: () => {
        assertActive(signal);
        signing = true;
        onSigning();
      },
      onBroadcast: (signed) => {
        txId = signed.txid;
        onBroadcast(signed.txid);
      },
    });
  } catch (error) {
    if (!txId) {
      const submissionError = getSubmissionError(error, signing);
      if (submissionError instanceof DustSweepUserCanceled)
        options.onPrepared();
      throw submissionError;
    }
  }
  if (!txId) throw new DustSweepUnknownSubmission();
  await completeBroadcastedSwapSuccess({
    txId,
    swapInfo: execution.swapInfo,
    generateSwapHistoryItem,
  });
  // Pending and transport errors remain pending; no timeout ever authorizes a resend.
  while (!signal.aborted) {
    try {
      const result = await backgroundApiProxy.serviceSwap.fetchTxState({
        txId,
        orderId: execution.orderId,
        provider: quote.info.provider,
        networkId: snapshot.networkId,
        protocol: EProtocolOfExchange.SWAP,
        toTokenAddress: snapshot.nativeToken.contractAddress,
        receivedAddress: snapshot.address,
        ctx: buildRes.ctx,
      });
      if (result.state === ESwapTxHistoryStatus.SUCCESS) {
        const received = new BigNumber(result.dealReceiveAmount ?? '');
        const receiptUnavailable =
          !received.isFinite() || received.isNegative();
        return {
          status: 'success',
          receivedAmount: receiptUnavailable ? undefined : received.toFixed(),
          receiptUnavailable,
        };
      }
      if (
        [
          ESwapTxHistoryStatus.FAILED,
          ESwapTxHistoryStatus.REFUNDED,
          ESwapTxHistoryStatus.CANCELED,
          ESwapTxHistoryStatus.EXPIRED,
        ].includes(result.state)
      )
        return { status: 'failed', message: result.stateDetail };
    } catch {
      /* Retain the broadcast identity while status is unavailable. */
    }
    await waitDustSweepPoll(signal);
  }
  throw new OneKeyLocalError('Dust Sweep cancelled');
}
