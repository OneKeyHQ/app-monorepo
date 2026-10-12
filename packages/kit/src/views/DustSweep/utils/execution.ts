import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { HardwareErrorCode as ThirdPartyHardwareErrorCode } from '@onekeyfe/hwk-adapter-core/errors';
import BigNumber from 'bignumber.js';

import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
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

import { DustSweepPaused } from './DustSweepPaused';
import { DustSweepRetryableError } from './DustSweepRetryableError';
import { DustSweepUserCanceled } from './DustSweepUserCanceled';
import {
  DustSweepSkip,
  fetchDustSweepQuote,
  getDustSweepQuoteRisk,
} from './quote';

export { DustSweepUserCanceled } from './DustSweepUserCanceled';
export { DustSweepRetryableError } from './DustSweepRetryableError';
export { DustSweepPaused } from './DustSweepPaused';

type IExecutionOptions = {
  snapshot: IDustSweepSnapshot;
  token: IDustSweepToken;
  signal: AbortSignal;
  onSigning: () => void;
  onPrepared: () => void;
  onApprovalBroadcast?: (txIds: string[]) => void;
  onBroadcast: (txId: string) => void;
  pendingApprovalTxIds?: string[];
  shouldContinue?: () => boolean;
  generateSwapHistoryItem: Parameters<
    typeof completeBroadcastedSwapSuccess
  >[0]['generateSwapHistoryItem'];
};

export class DustSweepUnknownSubmission extends OneKeyLocalError {}

function isUserCancellationError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    className?: unknown;
    name?: unknown;
    code?: unknown;
  };
  const className = candidate.className ?? candidate.name;
  if (
    className === EOneKeyErrorClassNames.PasswordPromptDialogCancel ||
    className === EOneKeyErrorClassNames.SecureQRCodeDialogCancel ||
    className === EOneKeyErrorClassNames.OneKeyErrorScanQrCodeCancel ||
    className === EOneKeyErrorClassNames.HardwareUserCancelFromOutside
  )
    return true;
  return [
    HardwareErrorCode.PinCancelled,
    HardwareErrorCode.ActionCancelled,
    HardwareErrorCode.CallQueueActionCancelled,
    ThirdPartyHardwareErrorCode.PinCancelled,
    ThirdPartyHardwareErrorCode.UserRejected,
    ThirdPartyHardwareErrorCode.UserAborted,
  ].some((code) => code === candidate.code);
}

function getSubmissionError(error: unknown, signing: boolean) {
  if (isUserCancellationError(error)) {
    return new DustSweepUserCanceled();
  }
  return signing ? new DustSweepUnknownSubmission() : error;
}

function assertActive(signal: AbortSignal) {
  if (signal.aborted) throw new OneKeyLocalError('Dust Sweep cancelled');
}

function assertCanSubmit(options: IExecutionOptions) {
  assertActive(options.signal);
  if (options.shouldContinue && !options.shouldContinue())
    throw new DustSweepPaused();
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
      else if (!fee.token.isNative) throw new DustSweepSkip('unknown');
      else requirements.push({ token: fee.token, amount: amount.toFixed() });
    }
  }
  for (const requirement of requirements) {
    await checkBalance(requirement.token, requirement.amount, options);
  }
  return (
    requirements.find((entry) =>
      equalTokenNoCaseSensitive({
        token1: entry.token,
        token2: options.token,
      }),
    )?.amount ?? options.token.amount
  );
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

async function prepareAllowanceInfos(
  quote: IFetchQuoteResult,
  options: IExecutionOptions,
  requiredInputAmount = options.token.amount,
): Promise<IApproveInfo[]> {
  const { snapshot, token, signal } = options;
  const spender =
    quote.allowanceResult?.allowanceTarget ??
    quote.approvedInfo?.allowanceTarget;
  if (!spender) {
    if (quote.approvedInfo?.isApproved) return [];
    if (
      networkUtils.isEvmNetwork({ networkId: snapshot.networkId }) ||
      networkUtils.isTronNetworkByNetworkId(snapshot.networkId)
    )
      throw new DustSweepSkip('unknown');
    return [];
  }
  const params = {
    accountId: snapshot.accountId,
    networkId: snapshot.networkId,
    tokenAddress: token.contractAddress,
    spenderAddress: spender,
    walletAddress: snapshot.address,
    amount: requiredInputAmount,
  };
  const allowance =
    await backgroundApiProxy.serviceSwap.fetchApproveAllowanceForDisplay(
      params,
    );
  assertActive(signal);
  if (allowance.isApproved) return [];
  const amounts = allowance.shouldResetApprove
    ? ['0', requiredInputAmount]
    : [requiredInputAmount];
  return amounts.map((amount) => ({
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
  }));
}

// Only detach preparation and status reads. Signing and history writes must finish
// before the session owner releases a worker that may already have broadcast.
async function waitForDustSweepRead<T>(
  request: () => Promise<T>,
  signal: AbortSignal,
) {
  assertActive(signal);
  let onAbort: () => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new OneKeyLocalError('Dust Sweep cancelled'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([request(), aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

async function waitForBroadcastedApprovals({
  approvalTxIds,
  snapshot,
  signal,
}: {
  approvalTxIds: string[];
  snapshot: IDustSweepSnapshot;
  signal: AbortSignal;
}) {
  for (const txId of approvalTxIds) {
    while (!signal.aborted) {
      try {
        const result = await waitForDustSweepRead(
          () =>
            backgroundApiProxy.serviceSwap.fetchTxState({
              txId,
              networkId: snapshot.networkId,
            }),
          signal,
        );
        if (result.state === ESwapTxHistoryStatus.SUCCESS) break;
        if (
          [
            ESwapTxHistoryStatus.FAILED,
            ESwapTxHistoryStatus.CANCELED,
            ESwapTxHistoryStatus.EXPIRED,
            ESwapTxHistoryStatus.REFUNDED,
          ].includes(result.state)
        )
          throw new DustSweepSkip('txFailed');
      } catch (error) {
        if (error instanceof DustSweepSkip) throw error;
        // Keep polling after a temporary status/transport failure. The tx was
        // already broadcast, so a failed read must never authorize a resend.
      }
      await waitDustSweepPoll(signal);
    }
    assertActive(signal);
  }
}

async function prepareDustSweepItem(options: IExecutionOptions) {
  const { snapshot, token, signal } = options;
  assertCanSubmit(options);
  const quote = await fetchDustSweepQuote(token, snapshot, signal);
  assertCanSubmit(options);
  const quoteRisk = getDustSweepQuoteRisk(quote, token, snapshot);
  if (quoteRisk) throw new DustSweepSkip(quoteRisk, quote.quoteShowTip?.detail);
  await checkInputAndOtherFeeBalances(quote, options);
  assertCanSubmit(options);
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
  assertCanSubmit(options);
  if (!buildRes) throw new DustSweepSkip('noQuote');
  const risk = getDustSweepQuoteRisk(buildRes.result, token, snapshot);
  if (risk) throw new DustSweepSkip(risk, buildRes.result.quoteShowTip?.detail);
  const requiredInputAmount = await checkInputAndOtherFeeBalances(
    buildRes.result,
    options,
  );
  const execution = await buildMarketExecutionPayload({
    accountId: snapshot.accountId,
    buildRes,
    deriveAddressEncoding: snapshot.deriveAddressEncoding,
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
  const allowanceQuote =
    buildRes.result.allowanceResult || buildRes.result.approvedInfo
      ? buildRes.result
      : quote;
  const approvalInfos = await prepareAllowanceInfos(
    allowanceQuote,
    options,
    requiredInputAmount,
  );
  return { buildRes, execution, approvalInfos };
}

export async function executeDustSweepItem(
  options: IExecutionOptions,
): Promise<
  | { status: 'success'; receivedAmount?: string; receiptUnavailable: boolean }
  | { status: 'failed'; message?: string }
> {
  const {
    snapshot,
    signal,
    onSigning,
    onApprovalBroadcast,
    onBroadcast,
    pendingApprovalTxIds,
    generateSwapHistoryItem,
  } = options;
  assertCanSubmit(options);
  if (pendingApprovalTxIds?.length)
    await waitForBroadcastedApprovals({
      approvalTxIds: pendingApprovalTxIds,
      snapshot,
      signal,
    });
  assertCanSubmit(options);
  let prepared = await waitForDustSweepRead(
    () => prepareDustSweepItem(options),
    signal,
  );
  let txId: string | undefined;
  const broadcastedApprovalTxIds = [...(pendingApprovalTxIds ?? [])];
  let signing = false;
  const onBeforeSignAndSend = () => {
    assertCanSubmit(options);
    if (!signing) {
      signing = true;
      onSigning();
    }
  };
  const sendApproval = async (approveInfo: IApproveInfo) => {
    assertCanSubmit(options);
    let approvalTxId: string | undefined;
    await sendMarketDirectUnsignedTxs({
      accountId: snapshot.accountId,
      accountAddress: snapshot.address,
      networkId: snapshot.networkId,
      buildUnsignedParams: {
        accountId: snapshot.accountId,
        networkId: snapshot.networkId,
        approveInfo,
      },
      validateFinalGasInfos: async (gasInfos) => {
        await checkNativeGasBalance(
          gasInfos,
          options,
          prepared.buildRes.result,
        );
        await checkInputAndOtherFeeBalances(prepared.buildRes.result, options);
      },
      onBeforeSignAndSend,
      onBroadcast: (signed) => {
        signing = false;
        approvalTxId = signed.txid;
        broadcastedApprovalTxIds.push(signed.txid);
        onApprovalBroadcast?.([...broadcastedApprovalTxIds]);
        options.onPrepared();
      },
    });
    if (!approvalTxId) throw new DustSweepUnknownSubmission();
    await waitForBroadcastedApprovals({
      approvalTxIds: [approvalTxId],
      snapshot,
      signal,
    });
    assertCanSubmit(options);
  };
  try {
    if (prepared.approvalInfos.length) {
      // Build each approval only after the previous one confirms so its nonce
      // includes transactions sent by the same account while we were waiting.
      for (const approveInfo of prepared.approvalInfos) {
        await sendApproval(approveInfo);
      }
      // Approval changes chain state and may outlive the quote. Rebuild before
      // estimating the actual swap, with no approval gas-limit approximation.
      prepared = await waitForDustSweepRead(
        () => prepareDustSweepItem(options),
        signal,
      );
      if (prepared.approvalInfos.length)
        throw new DustSweepRetryableError();
    }
    const { execution, buildRes } = prepared;
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
      onBeforeSignAndSend,
      onBroadcast: (signed) => {
        txId = signed.txid;
        onBroadcast(signed.txid);
      },
    });
  } catch (error) {
    if (!txId) {
      if (error instanceof DustSweepPaused && !signing) throw error;
      const submissionError = getSubmissionError(error, signing);
      if (submissionError instanceof DustSweepUserCanceled)
        options.onPrepared();
      if (
        !signing &&
        broadcastedApprovalTxIds.length &&
        !(submissionError instanceof DustSweepUserCanceled) &&
        !(submissionError instanceof DustSweepSkip)
      )
        throw new DustSweepRetryableError(
          error instanceof Error ? error.message : undefined,
        );
      throw submissionError;
    }
  }
  if (!txId) throw new DustSweepUnknownSubmission();
  const { execution, buildRes } = prepared;
  await completeBroadcastedSwapSuccess({
    txId,
    swapInfo: execution.swapInfo,
    generateSwapHistoryItem,
  });
  const fetchState = () =>
    backgroundApiProxy.serviceSwap.fetchTxState({
      txId,
      orderId: execution.orderId,
      provider: buildRes.result.info.provider,
      networkId: snapshot.networkId,
      protocol: EProtocolOfExchange.SWAP,
      toTokenAddress: snapshot.nativeToken.contractAddress,
      receivedAddress: snapshot.address,
      ctx: buildRes.ctx,
    });
  // Pending and transport errors remain pending; no timeout ever authorizes a resend.
  while (!signal.aborted) {
    try {
      const result = await waitForDustSweepRead(fetchState, signal);
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
