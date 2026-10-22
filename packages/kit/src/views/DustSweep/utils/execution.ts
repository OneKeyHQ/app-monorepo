import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { HardwareErrorCode as ThirdPartyHardwareErrorCode } from '@onekeyfe/hwk-adapter-core/errors';
import BigNumber from 'bignumber.js';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { buildMarketExecutionPayload } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketBuildExecutionUtils';
import {
  MarketDirectFeeOverflowError,
  estimateMarketApproveGasInfos,
  estimateMarketDirectGasInfos,
  prepareMarketDirectUnsignedTx,
  sendMarketDirectUnsignedTxs,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketDirectSendTx';
import type { IMarketGasInfoEntry } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketDirectSendTx';
import { completeBroadcastedSwapSuccess } from '@onekeyhq/kit/src/views/Swap/hooks/swapBroadcastSuccess';
import {
  checkSwapLatestBalanceSufficient,
  getSwapRequiredNativeBalanceAmount,
} from '@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils';
import type {
  IApproveInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { BATCH_SEND_TXS_FEE_UP_RATIO_FOR_APPROVE } from '@onekeyhq/shared/src/consts/walletConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { getBroadcastTxContext } from '@onekeyhq/shared/src/errors/utils/broadcastTxErrorUtils';
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
  EWrappedType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  IFetchSwapTxHistoryStatusResponse,
  ISwapToken,
  ISwapTxInfo,
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
  onSubmissionError?: (message: string) => void;
  pendingApprovalTxIds?: string[];
  shouldContinue?: () => boolean;
  generateSwapHistoryItem: Parameters<
    typeof completeBroadcastedSwapSuccess
  >[0]['generateSwapHistoryItem'];
};

export class DustSweepUnknownSubmission extends OneKeyLocalError {
  constructor(readonly submissionErrorMessage?: string) {
    super();
  }
}

function getSubmissionErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { className?: unknown; message?: unknown };
  // API messages are already translated for display. Internal signing and
  // transport diagnostics must not be exposed as user-facing copy.
  return candidate.className === EOneKeyErrorClassNames.OneKeyServerApiError &&
    typeof candidate.message === 'string'
    ? candidate.message.trim() || undefined
    : undefined;
}

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
  if (error instanceof DustSweepUnknownSubmission) return error;
  if (isUserCancellationError(error)) {
    return new DustSweepUserCanceled();
  }
  return signing
    ? new DustSweepUnknownSubmission(getSubmissionErrorMessage(error))
    : error;
}

function isSolanaSlippageRejection(error: unknown, networkId: string) {
  if (!networkUtils.isSolanaNetworkByNetworkId(networkId)) return false;
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { className?: unknown; code?: unknown };
  // Solana preflight rejects slippage violations with this API code. A
  // transport error or an EVM nonce rejection does not establish this outcome.
  return (
    candidate.className === EOneKeyErrorClassNames.OneKeyServerApiError &&
    candidate.code === 40_036
  );
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
  let requiredInputAmount = options.token.amount;
  for (const fee of quote.fee?.otherFeeInfos ?? []) {
    const amount = new BigNumber(fee.amount ?? '');
    if (!amount.isFinite() || amount.isNegative())
      throw new DustSweepSkip('unknown');
    if (!amount.isZero()) {
      if (
        fee.token.networkId !== options.snapshot.networkId ||
        !equalTokenNoCaseSensitive({
          token1: options.token,
          token2: fee.token,
        })
      )
        throw new DustSweepSkip('unknown');
      requiredInputAmount = amount.plus(requiredInputAmount).toFixed();
    }
  }
  await checkBalance(options.token, requiredInputAmount, options);
  return requiredInputAmount;
}

async function checkNativeGasBalance(
  gasInfos: IMarketGasInfoEntry[],
  options: IExecutionOptions,
  quote?: IFetchQuoteResult,
  unsignedTxs: IUnsignedTxPro[] = [],
) {
  assertActive(options.signal);
  const requirement = getSwapRequiredNativeBalanceAmount({
    gasInfos,
    networkId: options.snapshot.networkId,
    fromToken: options.token,
    fromAmount: options.token.amount,
    otherFeeInfos: quote?.fee?.otherFeeInfos,
    solanaRent: unsignedTxs
      .reduce((sum, tx) => sum.plus(tx.solanaRent ?? 0), new BigNumber(0))
      .toFixed(),
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
  if (quote.allowanceResult && !quote.allowanceResult.allowanceTarget)
    throw new DustSweepSkip('unknown');
  const spender =
    quote.allowanceResult?.allowanceTarget ??
    quote.approvedInfo?.allowanceTarget;
  if (!spender) {
    if (quote.approvedInfo?.isApproved) return [];
    // Like Swap, quotes without approval metadata continue to the actual
    // transaction estimate and checks before sending.
    if (
      (networkUtils.isEvmNetwork({ networkId: snapshot.networkId }) ||
        networkUtils.isTronNetworkByNetworkId(snapshot.networkId)) &&
      quote.approvedInfo
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

async function confirmRecoveredBroadcast({
  fetchState,
  signal,
  message,
}: {
  fetchState: () => Promise<IFetchSwapTxHistoryStatusResponse>;
  signal: AbortSignal;
  message?: string;
}) {
  if (signal.aborted) throw new DustSweepUnknownSubmission(message);
  const observation = new AbortController();
  const abort = () => observation.abort();
  signal.addEventListener('abort', abort, { once: true });
  // A local signature is not a broadcast acknowledgement. Bound this read-only
  // observation, including hung requests, then block rather than permit a resend.
  const timeout = setTimeout(abort, 60_000);
  try {
    while (!observation.signal.aborted) {
      try {
        const result = await waitForDustSweepRead(
          fetchState,
          observation.signal,
        );
        assertActive(observation.signal);
        const block = result.blockNumber;
        // A bare FAILED can also mean "not found" or invalid provider context.
        // Failed receipts need a block to establish that this exact hash exists.
        if (
          result.state === ESwapTxHistoryStatus.SUCCESS ||
          (result.state === ESwapTxHistoryStatus.FAILED &&
            typeof block === 'number' &&
            Number.isSafeInteger(block) &&
            block > 0)
        )
          return result;
      } catch {
        // Read errors do not establish whether the signed transaction was accepted.
      }
      await waitDustSweepPoll(observation.signal);
    }
    throw new DustSweepUnknownSubmission(message);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
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

function assertDustSweepEvmZeroValue(encodedTx: unknown) {
  if (!encodedTx || typeof encodedTx !== 'object' || Array.isArray(encodedTx))
    throw new DustSweepSkip('unknown');
  const value = 'value' in encodedTx ? encodedTx.value : undefined;
  // Sweep sells non-native tokens and never confirms additional native spend.
  if (
    value === undefined ||
    value === 0 ||
    (typeof value === 'string' && /^(?:0+|0x0+)$/i.test(value))
  )
    return;
  throw new DustSweepSkip('unknown');
}

type IPreparedDustSweepItem = {
  buildRes: IFetchBuildTxResponse;
  execution: Awaited<ReturnType<typeof buildMarketExecutionPayload>> & {
    wrappedInfo?: IWrappedInfo;
  };
  approvalInfos: IApproveInfo[];
};

async function prepareDustSweepItem(
  options: IExecutionOptions,
): Promise<IPreparedDustSweepItem> {
  const { snapshot, token, signal } = options;
  assertCanSubmit(options);
  const quote = await fetchDustSweepQuote(token, snapshot, signal);
  assertCanSubmit(options);
  if (quote.isWrapped) {
    const risk = getDustSweepQuoteRisk(quote, token, snapshot);
    if (risk) throw new DustSweepSkip(risk);
    await checkInputAndOtherFeeBalances(quote, options);
    assertCanSubmit(options);
    const buildRes: IFetchBuildTxResponse = {
      result: quote,
      orderId: quote.quoteId,
    };
    const swapInfo: ISwapTxInfo = {
      protocol: EProtocolOfExchange.SWAP,
      sender: {
        amount: token.amount,
        token,
        accountInfo: {
          accountId: snapshot.accountId,
          networkId: snapshot.networkId,
        },
      },
      receiver: {
        amount: token.amount,
        token: snapshot.nativeToken,
        accountInfo: {
          accountId: snapshot.accountId,
          networkId: snapshot.networkId,
        },
      },
      accountAddress: snapshot.address,
      receivingAddress: snapshot.address,
      swapBuildResData: buildRes,
    };
    return {
      buildRes,
      execution: {
        wrappedInfo: {
          from: snapshot.address,
          type: EWrappedType.WITHDRAW,
          contract: token.contractAddress,
          amount: token.amount,
        },
        swapInfo,
        skipSendTransAction: false,
        orderId: quote.quoteId,
      },
      approvalInfos: [],
    };
  }
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
  if (risk || buildRes.result.info.provider !== quote.info.provider)
    throw new DustSweepSkip(
      risk ?? 'unknown',
      buildRes.result.quoteShowTip?.detail,
    );
  const requiredInputAmount = await checkInputAndOtherFeeBalances(
    buildRes.result,
    options,
  );
  const isEvm = networkUtils.isEvmNetwork({ networkId: snapshot.networkId });
  // Validate before the shared builder can round fractional values to zero.
  if (isEvm && buildRes.tx !== undefined)
    assertDustSweepEvmZeroValue(buildRes.tx);
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
  if (isEvm) assertDustSweepEvmZeroValue(execution.encodedTx);
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

function increaseApprovalGasBudget(entry: IMarketGasInfoEntry) {
  const { gas, gasEIP1559 } = entry.gasInfo;
  const limit = new BigNumber(gas?.gasLimit ?? gasEIP1559?.gasLimit ?? '');
  if (!limit.isFinite() || limit.lte(0)) throw new DustSweepSkip('unknown');
  const gasLimit = limit
    .times(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_APPROVE)
    .toFixed();
  return {
    ...entry,
    gasInfo: {
      ...entry.gasInfo,
      gas: gas ? { ...gas, gasLimit, gasLimitForDisplay: gasLimit } : undefined,
      gasEIP1559: gasEIP1559
        ? { ...gasEIP1559, gasLimit, gasLimitForDisplay: gasLimit }
        : undefined,
    },
  };
}

async function estimateApprovalBudget(
  prepared: Awaited<ReturnType<typeof prepareDustSweepItem>>,
  options: IExecutionOptions,
) {
  const { snapshot } = options;
  const approveUnsignedTxArr: IUnsignedTxPro[] = [];
  // These transactions are only for estimating the whole remaining budget.
  // Actual sends rebuild each transaction with a fresh nonce and gas estimate.
  for (const approveInfo of prepared.approvalInfos) {
    assertCanSubmit(options);
    approveUnsignedTxArr.push(
      await prepareMarketDirectUnsignedTx({
        accountId: snapshot.accountId,
        networkId: snapshot.networkId,
        approveUnsignedTxArr,
        buildUnsignedParams: {
          accountId: snapshot.accountId,
          networkId: snapshot.networkId,
          approveInfo,
        },
      }),
    );
  }
  assertCanSubmit(options);
  const { execution } = prepared;
  const isTron = networkUtils.isTronNetworkByNetworkId(snapshot.networkId);
  const approvalGasInfos = isTron
    ? (
        await estimateMarketApproveGasInfos({
          accountId: snapshot.accountId,
          accountAddress: snapshot.address,
          networkId: snapshot.networkId,
          approveUnsignedTxArr,
        })
      ).gasInfos
    : [];
  assertCanSubmit(options);
  const estimateParams: Parameters<typeof estimateMarketDirectGasInfos>[0] = {
    accountId: snapshot.accountId,
    accountAddress: snapshot.address,
    networkId: snapshot.networkId,
    // The shared sequential fallback approximates EVM gas limits only. Tron
    // needs its own swap estimate; approval energy is not a swap budget.
    approveUnsignedTxArr: isTron ? undefined : approveUnsignedTxArr,
    buildUnsignedParams: {
      accountId: snapshot.accountId,
      networkId: snapshot.networkId,
      encodedTx: execution.encodedTx,
      wrappedInfo: execution.wrappedInfo,
      transfersInfo: execution.transferInfo
        ? [execution.transferInfo]
        : undefined,
      swapInfo: execution.swapInfo,
    },
  };
  let estimatedGasInfos: IMarketGasInfoEntry[];
  try {
    estimatedGasInfos = (await estimateMarketDirectGasInfos(estimateParams))
      .gasInfos;
  } catch (error) {
    assertCanSubmit(options);
    if (
      !networkUtils.isEvmNetwork({ networkId: snapshot.networkId }) ||
      prepared.approvalInfos.length !== 2 ||
      prepared.approvalInfos[0].amount !== '0'
    )
      throw error;
    // A reset-required grant cannot be simulated against the old allowance.
    // Match the send-confirm estimate-only envelope until reset confirms.
    const fallback = await estimateMarketDirectGasInfos({
      ...estimateParams,
      approveUnsignedTxArr: approveUnsignedTxArr.slice(0, 1),
    });
    assertCanSubmit(options);
    const [resetGas, swapGas] = fallback.gasInfos;
    if (!resetGas || !swapGas) throw error;
    estimatedGasInfos = [
      resetGas,
      {
        ...increaseApprovalGasBudget(resetGas),
        encodeTx: approveUnsignedTxArr[1].encodedTx,
      },
      prepared.buildRes.result.gasLimit === undefined ||
      prepared.buildRes.result.gasLimit === null
        ? increaseApprovalGasBudget(swapGas)
        : swapGas,
    ];
  }
  assertCanSubmit(options);
  const gasInfos = [...approvalGasInfos, ...estimatedGasInfos].map(
    (entry, index) => {
      if (!isTron || index === 0) return entry;
      // Independent Tron estimates each subtract the same available resources.
      // Reserve later steps at full burn cost instead of spending that credit twice.
      const originalFee = new BigNumber(
        entry.gasInfo.feeTron?.originalFee ?? '',
      );
      const common = entry.gasInfo.common;
      const feeDecimals = common?.feeDecimals;
      if (
        !originalFee.isFinite() ||
        originalFee.isNegative() ||
        !common ||
        feeDecimals === undefined ||
        !Number.isInteger(feeDecimals)
      )
        throw new DustSweepSkip('unknown');
      return {
        ...entry,
        gasInfo: {
          ...entry.gasInfo,
          gas: undefined,
          gasEIP1559: undefined,
          common: {
            ...common,
            baseFee: originalFee.shiftedBy(-feeDecimals).toFixed(),
          },
        },
      };
    },
  );
  if (gasInfos.length !== prepared.approvalInfos.length + 1)
    throw new DustSweepSkip('unknown');
  await checkNativeGasBalance(gasInfos, options, prepared.buildRes.result);
  return gasInfos;
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
  const retainSwapBroadcast = (id: string) => {
    txId = id;
    void backgroundApiProxy.serviceNotification
      .blockNotificationForTxId({ networkId: snapshot.networkId, tx: id })
      .catch(() => undefined);
    onBroadcast(id);
  };
  let confirmedRecovery: IFetchSwapTxHistoryStatusResponse | undefined;
  const fetchSwapState = (id: string) =>
    backgroundApiProxy.serviceSwap.fetchTxState({
      txId: id,
      orderId: prepared.execution.orderId,
      provider: prepared.buildRes.result.info.provider,
      networkId: snapshot.networkId,
      protocol: EProtocolOfExchange.SWAP,
      toTokenAddress: snapshot.nativeToken.contractAddress,
      receivedAddress: snapshot.address,
      ctx: prepared.buildRes.ctx,
    });
  const broadcastedApprovalTxIds = [...(pendingApprovalTxIds ?? [])];
  let signing = false;
  const onBeforeSignAndSend = () => {
    assertCanSubmit(options);
    if (!signing) {
      signing = true;
      onSigning();
    }
  };
  const sendApproval = async (
    approveInfo: IApproveInfo,
    remainingGasInfos: IMarketGasInfoEntry[],
  ) => {
    assertCanSubmit(options);
    let approvalTxId: string | undefined;
    const retainApproval = (id: string) => {
      signing = false;
      approvalTxId = id;
      broadcastedApprovalTxIds.push(id);
      onApprovalBroadcast?.([...broadcastedApprovalTxIds]);
      options.onPrepared();
    };
    try {
      await sendMarketDirectUnsignedTxs({
        rejectFeeInfoOverflow: true,
        preserveBroadcastTxIdOnError: true,
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
            [...gasInfos, ...remainingGasInfos],
            options,
            prepared.buildRes.result,
          );
          await checkInputAndOtherFeeBalances(
            prepared.buildRes.result,
            options,
          );
        },
        onBeforeSignAndSend,
        onBroadcast: (signed) => retainApproval(signed.txid),
      });
    } catch (error) {
      // An approval hash must never be interpreted as the swap hash. A failed
      // response can follow a successful broadcast; track that exact signature.
      const context = getBroadcastTxContext(error, snapshot.networkId);
      if (approvalTxId || !context) throw error;
      const message = getSubmissionErrorMessage(error);
      if (message) options.onSubmissionError?.(message);
      const result = await confirmRecoveredBroadcast({
        fetchState: () =>
          backgroundApiProxy.serviceSwap.fetchTxState({
            txId: context.txId,
            networkId: snapshot.networkId,
          }),
        signal,
        message,
      });
      retainApproval(context.txId);
      if (result.state !== ESwapTxHistoryStatus.SUCCESS)
        throw new DustSweepSkip('txFailed');
      assertCanSubmit(options);
      return;
    }
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
      const approvalBudget = await waitForDustSweepRead(
        () => estimateApprovalBudget(prepared, options),
        signal,
      );
      // Build each approval only after the previous one confirms so its nonce
      // includes transactions sent by the same account while we were waiting.
      for (const [index, approveInfo] of prepared.approvalInfos.entries()) {
        await sendApproval(approveInfo, approvalBudget.slice(index + 1));
      }
      // Approval changes chain state and may outlive the quote. Rebuild before
      // estimating the actual swap, with no approval gas-limit approximation.
      prepared = await waitForDustSweepRead(
        () => prepareDustSweepItem(options),
        signal,
      );
      if (prepared.approvalInfos.length) throw new DustSweepRetryableError();
    }
    const { execution, buildRes } = prepared;
    try {
      await sendMarketDirectUnsignedTxs({
        rejectFeeInfoOverflow: true,
        preserveBroadcastTxIdOnError: true,
        accountId: snapshot.accountId,
        accountAddress: snapshot.address,
        networkId: snapshot.networkId,
        buildUnsignedParams: {
          accountId: snapshot.accountId,
          networkId: snapshot.networkId,
          encodedTx: execution.encodedTx,
          wrappedInfo: execution.wrappedInfo,
          transfersInfo: execution.transferInfo
            ? [execution.transferInfo]
            : undefined,
          swapInfo: execution.swapInfo,
        },
        validateFinalGasInfos: async (gasInfos, unsignedTxs) => {
          if (execution.wrappedInfo) {
            if (unsignedTxs?.length !== 1) throw new DustSweepSkip('unknown');
            for (const unsignedTx of unsignedTxs)
              assertDustSweepEvmZeroValue(unsignedTx.encodedTx);
          }
          await checkNativeGasBalance(
            gasInfos,
            options,
            buildRes.result,
            unsignedTxs,
          );
          await checkInputAndOtherFeeBalances(buildRes.result, options);
        },
        onBeforeSignAndSend,
        onBroadcast: (signed) => retainSwapBroadcast(signed.txid),
      });
    } catch (error) {
      const context = getBroadcastTxContext(error, snapshot.networkId);
      if (txId || !context) throw error;
      const message = getSubmissionErrorMessage(error);
      if (message) options.onSubmissionError?.(message);
      confirmedRecovery = await confirmRecoveredBroadcast({
        fetchState: () => fetchSwapState(context.txId),
        signal,
        message,
      });
      retainSwapBroadcast(context.txId);
    }
  } catch (error) {
    if (!txId) {
      if (signing && isSolanaSlippageRejection(error, snapshot.networkId))
        return { status: 'failed', message: getSubmissionErrorMessage(error) };
      if (error instanceof MarketDirectFeeOverflowError)
        throw new DustSweepSkip('unknown');
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
  const { execution } = prepared;
  await completeBroadcastedSwapSuccess({
    txId,
    swapInfo: execution.swapInfo,
    generateSwapHistoryItem,
  });
  const broadcastTxId = txId;
  // Pending and transport errors remain pending; no timeout ever authorizes a resend.
  while (!signal.aborted) {
    try {
      const result =
        confirmedRecovery ??
        (await waitForDustSweepRead(
          () => fetchSwapState(broadcastTxId),
          signal,
        ));
      confirmedRecovery = undefined;
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
