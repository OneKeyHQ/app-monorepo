import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { buildMarketExecutionPayload } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketBuildExecutionUtils';
import { checkSwapLatestBalanceSufficient } from '@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { sortSwapQuotes } from '@onekeyhq/shared/src/utils/swapQuoteSortUtils';
import type { IEarnSwapRecovery } from '@onekeyhq/shared/types/earn/funding';
import { swapSlippageAutoValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapTabSwitchType,
  ESwapTradeSource,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  ISwapQuoteEventData,
  ISwapQuoteEventPayload,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  isTaskAccountAddress,
  isTaskAccountCurrent,
  normalizeTaskAccountAddress,
} from '../../tasks/taskAccount';

import {
  getEarnFunding,
  refreshEarnFunding,
  releaseEarnFunding,
  settleEarnFunding,
} from './earnFundingRegistry';
import {
  getEarnSwapSlippage,
  isEarnBridge,
  isUsableEarnSwapQuote,
} from './earnRouter.utils';
import { getEarnSwapSettlement } from './earnSwapSettlement';

import type { reserveEarnFunding } from './earnFundingRegistry';

// Paying with another token on a provider that takes only its own: a real
// swap through the app's swap service, then the provider's own deposit form

export type IEarnSwapReason =
  // No provider quotes the pair for this amount
  | 'noRoute'
  // Quoted, but not as one on-chain swap this path can wait on
  | 'unsupported'
  // The swap reverted, expired or was refunded
  | 'failed'
  | 'cancelled'
  | 'unknown';

export class EarnSwapError extends OneKeyLocalError {
  reason: IEarnSwapReason;

  constructor(reason: IEarnSwapReason, message?: string) {
    super(message ?? reason);
    this.reason = reason;
  }
}

export type IEarnSwapAccount = {
  accountId: string;
  networkId: string;
  address: string;
};

const QUOTE_TIMEOUT_MS = 15_000;
const PREPARATION_VALIDITY_MS = 60_000;

/**
 * Asks the swap service for the pair and keeps the best quote it can carry
 * out, as the Swap page ranks them (recommended). `onBest` hears each better
 * one as the providers answer
 */
export function fetchEarnSwapQuote({
  fromToken,
  toToken,
  amount,
  account,
  toAccount,
  signal,
  onBest,
}: {
  fromToken: ISwapToken;
  toToken: ISwapToken;
  amount: string;
  // The account paying, on the pay token's network
  account?: IEarnSwapAccount;
  // Where the tokens land when that is another network (a bridge); unset,
  // the paying account
  toAccount?: IEarnSwapAccount;
  signal?: AbortSignal;
  onBest?: (quote: IFetchQuoteResult) => void;
}): Promise<IFetchQuoteResult> {
  const isBridge = isEarnBridge({ fromToken, toToken });
  const receiver = isBridge ? toAccount : account;
  const quoteRequestId = `earn-swap-${generateUUID()}`;
  return new Promise((resolve, reject) => {
    const quotes = new Map<string, IFetchQuoteResult>();
    let isDone = false;
    let best: IFetchQuoteResult | undefined;
    const finishRef: { current: (error?: Error) => void } = {
      current: () => undefined,
    };
    const abort = () => finishRef.current(new EarnSwapError('cancelled'));
    const listener = (event: ISwapQuoteEventPayload) => {
      if (event.quoteRequestId !== quoteRequestId) {
        return;
      }
      if (event.type === 'error') {
        finishRef.current();
        return;
      }
      if (event.type === 'done' || event.type === 'close') {
        // The last quotes can trail the done event by a tick
        void Promise.resolve().then(() => finishRef.current());
        return;
      }
      if (event.type !== 'message') {
        return;
      }
      try {
        const payload = JSON.parse(
          String((event.event as { data?: string }).data),
        ) as ISwapQuoteEventData;
        if ('totalQuoteCount' in payload && payload.totalQuoteCount === 0) {
          finishRef.current();
          return;
        }
        if ('data' in payload && Array.isArray(payload.data)) {
          payload.data.forEach((quote) => {
            if (
              quote.info?.provider &&
              isUsableEarnSwapQuote({ quote, fromToken, toToken, amount })
            ) {
              quotes.set(quote.info.provider, quote);
            }
          });
          const [top] = sortSwapQuotes([...quotes.values()], {
            fromTokenAmount: amount,
          });
          if (top && top !== best) {
            best = top;
            onBest?.(top);
          }
        }
      } catch {
        // A message that doesn't parse adds no quote
      }
    };
    const timeout = setTimeout(() => finishRef.current(), QUOTE_TIMEOUT_MS);
    finishRef.current = (error?: Error) => {
      if (isDone) {
        return;
      }
      isDone = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      appEventBus.off(EAppEventBusNames.SwapQuoteEvent, listener);
      void backgroundApiProxy.serviceSwap
        .cancelFetchQuoteEvents(quoteRequestId)
        .catch(() => undefined);
      if (error) {
        reject(error);
      } else if (best) {
        resolve(best);
      } else {
        reject(new EarnSwapError('noRoute'));
      }
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    appEventBus.on(EAppEventBusNames.SwapQuoteEvent, listener);
    void backgroundApiProxy.serviceSwap
      .fetchQuotesEvents({
        fromToken,
        toToken,
        fromTokenAmount: amount,
        userAddress: account?.address,
        receivingAddress: receiver?.address,
        accountId: account?.accountId,
        slippagePercentage: swapSlippageAutoValue,
        autoSlippage: true,
        kind: ESwapQuoteKind.SELL,
        protocol: isBridge
          ? ESwapTabSwitchType.BRIDGE
          : ESwapTabSwitchType.SWAP,
        quoteRequestId,
        cancelOnGlobalStop: false,
      })
      .catch((error: unknown) =>
        finishRef.current(
          error instanceof Error ? error : new EarnSwapError('noRoute'),
        ),
      );
  });
}

// An ERC20 pay token needs the swap's spender approved for the amount, in
// the same confirm as the swap. Exactly the amount, as Dust Sweep approves;
// a token that must go back to zero first gets both
async function prepareEarnSwapApprovals({
  quote,
  fromToken,
  amount,
  account,
}: {
  quote: IFetchQuoteResult;
  fromToken: ISwapToken;
  amount: string;
  account: IEarnSwapAccount;
}): Promise<IApproveInfo[]> {
  if (fromToken.isNative) {
    return [];
  }
  const spender =
    quote.allowanceResult?.allowanceTarget ??
    quote.approvedInfo?.allowanceTarget;
  if (!spender) {
    throw new EarnSwapError('unsupported');
  }
  const allowance =
    await backgroundApiProxy.serviceSwap.fetchApproveAllowanceForDisplay({
      accountId: account.accountId,
      networkId: account.networkId,
      tokenAddress: fromToken.contractAddress,
      spenderAddress: spender,
      walletAddress: account.address,
      amount,
    });
  if (allowance.isApproved) {
    return [];
  }
  const amounts = allowance.shouldResetApprove ? ['0', amount] : [amount];
  return amounts.map((value) => ({
    owner: account.address,
    spender,
    amount: value,
    isMax: false,
    tokenInfo: {
      address: fromToken.contractAddress,
      decimals: fromToken.decimals,
      symbol: fromToken.symbol,
      name: fromToken.name ?? fromToken.symbol,
      isNative: false,
    },
  }));
}

export type IEarnSwapPrepared = {
  buildRes: IFetchBuildTxResponse;
  execution: Awaited<ReturnType<typeof buildMarketExecutionPayload>>;
  approvesInfo: IApproveInfo[];
  payer: IEarnSwapAccount;
  receiver: IEarnSwapAccount;
  validUntil: number;
};

async function assertEarnSwapAccounts(
  payer: IEarnSwapAccount,
  receiver: IEarnSwapAccount,
) {
  const matches = (account: IEarnSwapAccount) =>
    isTaskAccountCurrent({
      accountId: account.accountId,
      networkId: account.networkId,
      accountAddress: account.address,
    });
  const [payerMatches, receiverMatches] = await Promise.all([
    matches(payer),
    receiver === payer ? true : matches(receiver),
  ]);
  if (!payerMatches || !receiverMatches) {
    throw new EarnSwapError('cancelled');
  }
}

async function assertEarnSwapSendAllowed(
  prepared: IEarnSwapPrepared,
  signal?: AbortSignal,
) {
  await assertEarnSwapAccounts(prepared.payer, prepared.receiver);
  if (signal?.aborted) throw new EarnSwapError('cancelled');
  if (Date.now() >= prepared.validUntil) throw new EarnSwapError('noRoute');
}

export function confirmEarnSwap({
  prepared,
  reservation,
  fundingKey,
  isCurrent,
  signal,
  navigateToConfirm,
  onAccepted,
  swapRecovery,
}: {
  prepared: IEarnSwapPrepared;
  reservation: NonNullable<ReturnType<typeof reserveEarnFunding>>;
  fundingKey: string;
  isCurrent: () => boolean;
  signal: AbortSignal;
  navigateToConfirm: ReturnType<
    typeof useSignatureConfirm
  >['navigationToTxConfirm'];
  onAccepted: (txId: string, sent?: ISendTxOnSuccessData) => Promise<void>;
  swapRecovery?: IEarnSwapRecovery;
}) {
  return new Promise<ISendTxOnSuccessData | undefined>((resolve, reject) => {
    let closed = false;
    let mayHaveBroadcast = false;
    let uncertain = false;
    let claim: Promise<void> | undefined;
    let cancellation: Promise<void> | undefined;
    let accepted: { txId: string; saved: Promise<void> } | undefined;
    let swapTxId: string | undefined;
    const canConfirm = () => !closed && !signal.aborted && isCurrent();
    const assertOpen = () => {
      if (!canConfirm() || mayHaveBroadcast)
        throw new EarnSwapError('cancelled');
    };
    const startClaim = () => {
      claim ??= reservation.markUnknown(swapRecovery, swapTxId);
      return claim;
    };
    const release = () => {
      if (accepted) return accepted.saved;
      closed = true;
      cancellation ??= (async () => {
        try {
          await claim;
        } finally {
          await reservation.release();
        }
      })();
      return cancellation;
    };
    const retainUncertain = () => {
      if (closed) return Promise.resolve();
      mayHaveBroadcast = true;
      uncertain = true;
      return startClaim();
    };
    const sameSwapTxId = (first: string, second: string) =>
      networkUtils.isEvmNetwork({ networkId: prepared.payer.networkId })
        ? first.toLowerCase() === second.toLowerCase()
        : first === second;
    const accept = (txId: string, sent?: ISendTxOnSuccessData) => {
      if (closed) return Promise.reject(new EarnSwapError('cancelled'));
      if (accepted && sameSwapTxId(accepted.txId, txId)) return accepted.saved;
      const previous = accepted;
      mayHaveBroadcast = true;
      const saved = (async () => {
        await startClaim();
        if (previous) {
          // Let the registry reject conflicting hashes for this same claim.
          await previous.saved.catch(() => undefined);
          await reservation.markSubmitted(txId);
          throw new EarnSwapError('unknown');
        }
        await reservation.markSubmitted(txId);
        const pending = getEarnFunding(fundingKey);
        const sameTx =
          pending?.status === 'submitted' && sameSwapTxId(pending.txId, txId);
        if (!sameTx) throw new EarnSwapError('unknown');
        await onAccepted(txId, uncertain ? undefined : sent);
      })();
      accepted = { txId, saved };
      return saved;
    };
    const finish = (sent?: ISendTxOnSuccessData) => {
      signal.removeEventListener('abort', abort);
      resolve(sent);
    };
    const fail = (error: unknown) => {
      signal.removeEventListener('abort', abort);
      reject(error);
    };
    const cancel = () => {
      if (mayHaveBroadcast) {
        uncertain = true;
        finish();
      } else {
        void release().then(() => finish(), fail);
      }
    };
    function abort() {
      cancel();
    }
    const failSafely = (error: unknown) => {
      if (uncertain) fail(error);
      else void release().then(() => fail(error), fail);
    };
    if (!canConfirm()) {
      cancel();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    void navigateToConfirm({
      isInternalSwap: true,
      preserveBatchTxIds: true,
      encodedTx: prepared.execution.encodedTx,
      approvesInfo: prepared.approvesInfo.length
        ? prepared.approvesInfo
        : undefined,
      swapInfo: prepared.execution.swapInfo,
      isNavigationCurrent: canConfirm,
      onBeforeSend: async (txs) => {
        if (mayHaveBroadcast) {
          uncertain = true;
          throw new EarnSwapError('unknown');
        }
        assertOpen();
        await assertEarnSwapSendAllowed(prepared, signal);
        assertOpen();
        const swapTx = txs?.at(-1);
        const uuids = txs?.map((tx) => tx.uuid);
        swapTxId =
          swapTx?.swapInfo &&
          !swapTx.approveInfo &&
          swapTx.uuid &&
          uuids?.every(Boolean) &&
          new Set(uuids).size === uuids.length
            ? swapTx.uuid
            : undefined;
        if (swapRecovery && !swapTxId) throw new EarnSwapError('unknown');
        await startClaim();
        assertOpen();
        await assertEarnSwapSendAllowed(prepared, signal);
        assertOpen();
        mayHaveBroadcast = true;
      },
      onSuccess: (data) => {
        const swaps = data.filter(
          (item) =>
            !item.approveInfo &&
            item.signedTx.txid &&
            (item.signedTx.swapInfo || prepared.approvesInfo.length === 0),
        );
        if (swaps.length === 1) {
          const [sent] = swaps;
          void accept(sent.signedTx.txid, sent).then(
            () => finish(uncertain ? undefined : sent),
            fail,
          );
        } else {
          void retainUncertain().then(() => finish(), fail);
        }
      },
      onLateBroadcastAccepted: async (fact) => {
        if (
          fact.accountId !== prepared.payer.accountId ||
          fact.networkId !== prepared.payer.networkId ||
          !fact.txid.trim()
        )
          return;
        if (
          (swapTxId && fact.uuid === swapTxId) ||
          (!swapRecovery && !swapTxId && prepared.approvesInfo.length === 0)
        )
          await accept(fact.txid);
        else await retainUncertain();
      },
      onFail: failSafely,
      onConfirmationFail: (error) => {
        void retainUncertain().then(() => fail(error), fail);
      },
      onSafePreSendFail: failSafely,
      onCancel: () => {
        if (!accepted) cancel();
      },
    })
      .then(() => {
        if (!canConfirm()) cancel();
      })
      .catch(failSafely);
  });
}

// The swap's transaction from a fresh quote, ready for the wallet's confirm
export async function prepareEarnSwap({
  quote,
  fromToken,
  toToken,
  amount,
  account,
  toAccount,
}: {
  quote: IFetchQuoteResult;
  fromToken: ISwapToken;
  toToken: ISwapToken;
  amount: string;
  account: IEarnSwapAccount;
  // Where a bridge's tokens land; unset, the paying account
  toAccount?: IEarnSwapAccount;
}): Promise<IEarnSwapPrepared> {
  const validUntil = Date.now() + PREPARATION_VALIDITY_MS;
  const isBridge = isEarnBridge({ fromToken, toToken });
  const receiver = isBridge && toAccount ? toAccount : account;
  if (
    account.networkId !== fromToken.networkId ||
    receiver.networkId !== toToken.networkId ||
    !isUsableEarnSwapQuote({ quote, fromToken, toToken, amount })
  ) {
    throw new EarnSwapError('unsupported');
  }
  await assertEarnSwapAccounts(account, receiver);
  const slippage = getEarnSwapSlippage(quote);
  const buildRes = await backgroundApiProxy.serviceSwap.fetchBuildTx({
    fromToken,
    toToken,
    fromTokenAmount: amount,
    toTokenAmount: quote.toAmount ?? '0',
    provider: quote.info.provider,
    userAddress: account.address,
    receivingAddress: receiver.address,
    slippagePercentage: slippage,
    accountId: account.accountId,
    quoteResultCtx: quote.quoteResultCtx,
    protocol: EProtocolOfExchange.SWAP,
    kind: ESwapQuoteKind.SELL,
    tradeSource: ESwapTradeSource.SWAP_BRIDGE,
  });
  if (!buildRes) {
    throw new EarnSwapError('noRoute');
  }
  if (
    buildRes.result.info.provider !== quote.info.provider ||
    !isUsableEarnSwapQuote({
      quote: buildRes.result,
      fromToken,
      toToken,
      amount,
    })
  ) {
    throw new EarnSwapError('noRoute');
  }
  // Orders paid by a transfer to a desk settle elsewhere, later
  if (
    buildRes.swftOrder ||
    buildRes.changellyOrder ||
    buildRes.thorSwapCallData
  ) {
    throw new EarnSwapError('unsupported');
  }
  const execution = await buildMarketExecutionPayload({
    accountId: account.accountId,
    buildRes,
    currentFromToken: fromToken,
    currentToToken: toToken,
    fromAmount: amount,
    receivingAccountId: receiver.accountId,
    receivingAddress: receiver.address,
    userAddress: account.address,
    slippage,
    swapType: isBridge ? ESwapTabSwitchType.BRIDGE : ESwapTabSwitchType.SWAP,
    onBuildOkxSwapEncodedTx: (params) =>
      backgroundApiProxy.serviceSwap.buildOkxSwapEncodedTx(params),
    onBuildLMSwapEncodedTx: (params) =>
      backgroundApiProxy.serviceSwap.buildLMSwapEncodedTx(params),
    onBuildInternalDappTx: (params) =>
      backgroundApiProxy.serviceStaking.buildInternalDappTx(params),
  });
  if (
    execution.skipSendTransAction ||
    !execution.encodedTx ||
    execution.transferInfo
  ) {
    throw new EarnSwapError('unsupported');
  }
  const approvesInfo = await prepareEarnSwapApprovals({
    quote:
      buildRes.result.allowanceResult || buildRes.result.approvedInfo
        ? buildRes.result
        : quote,
    fromToken,
    amount,
    account,
  });
  return {
    buildRes,
    execution,
    approvesInfo,
    payer: account,
    receiver,
    validUntil,
  };
}

const POLL_MS = 3000;

const waitPoll = (signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', finish);
      resolve();
    }, POLL_MS);
    function finish() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    }
    if (signal?.aborted) finish();
    else signal?.addEventListener('abort', finish, { once: true });
  });

// Bridges can take longer when the route waits for source or destination finality.
const SWAP_WAIT_MS = 10 * 60 * 1000;
const BRIDGE_WAIT_MS = 45 * 60 * 1000;

/** Resumes only a funding order bound to this flow and recorded by Swap. */
export async function reconcileEarnSwapFunding({
  scope,
  fromToken,
  toToken,
  account,
  toAccount,
}: {
  scope: string;
  fromToken: ISwapToken;
  toToken: ISwapToken;
  account: IEarnSwapAccount;
  toAccount?: IEarnSwapAccount;
}) {
  let pending = await refreshEarnFunding(scope);
  if (
    (pending?.status === 'unknown' || pending?.status === 'submitted') &&
    !(pending.status === 'unknown' && pending.txIdConflict) &&
    !(pending.status === 'submitted' && pending.sourceTxFailed) &&
    pending.swapTxUuid &&
    pending.swapRecovery
  ) {
    await assertEarnSwapAccounts(account, toAccount ?? account);
    await backgroundApiProxy.serviceStaking.recoverEarnSwapFunding(scope);
    pending = await refreshEarnFunding(scope);
  }
  if (pending?.status !== 'submitted') return pending;
  const receiver = toAccount ?? account;
  if (
    account.networkId !== fromToken.networkId ||
    receiver.networkId !== toToken.networkId
  ) {
    throw new EarnSwapError('unsupported');
  }
  await assertEarnSwapAccounts(account, receiver);
  let history = await backgroundApiProxy.serviceSwap.getSwapHistoryByTxId({
    txId: pending.txId,
  });
  const matchesToken = (expected: ISwapToken, saved: ISwapToken) =>
    expected.networkId === saved.networkId &&
    Boolean(expected.isNative) === Boolean(saved.isNative) &&
    normalizeTaskAccountAddress(
      expected.networkId,
      expected.contractAddress,
    ) === normalizeTaskAccountAddress(saved.networkId, saved.contractAddress);
  if ((!history || pending.sourceTxFailed) && pending.swapRecovery) {
    const current = await refreshEarnFunding(scope);
    if (
      current?.status !== 'submitted' ||
      current.txId !== pending.txId ||
      !current.swapRecovery
    )
      return current;
    const recovery = current.swapRecovery;
    if (
      recovery.sender.accountId !== account.accountId ||
      recovery.sender.networkId !== account.networkId ||
      recovery.receiver.accountId !== receiver.accountId ||
      recovery.receiver.networkId !== receiver.networkId ||
      !matchesToken(fromToken, recovery.sender.token) ||
      !matchesToken(toToken, recovery.receiver.token) ||
      !isTaskAccountAddress(
        { networkId: account.networkId, accountAddress: account.address },
        recovery.sender.address,
      ) ||
      !isTaskAccountAddress(
        { networkId: receiver.networkId, accountAddress: receiver.address },
        recovery.receiver.address,
      ) ||
      !current.intentAmount ||
      !new BigNumber(current.intentAmount).eq(recovery.sender.amount)
    )
      return current;
    await assertEarnSwapAccounts(account, receiver);
    const restored =
      await backgroundApiProxy.serviceSwap.restoreEarnSwapHistory({
        scope,
        txId: current.txId,
      });
    if (!restored) return current;
    history = await backgroundApiProxy.serviceSwap.getSwapHistoryByTxId({
      txId: current.txId,
    });
  }
  if (
    !history ||
    history.accountInfo.sender.accountId !== account.accountId ||
    history.accountInfo.receiver.accountId !== receiver.accountId ||
    !matchesToken(fromToken, history.baseInfo.fromToken) ||
    !matchesToken(toToken, history.baseInfo.toToken) ||
    !isTaskAccountAddress(
      { networkId: account.networkId, accountAddress: account.address },
      history.txInfo.sender,
    ) ||
    !isTaskAccountAddress(
      { networkId: receiver.networkId, accountAddress: receiver.address },
      history.txInfo.receiver,
    )
  ) {
    return getEarnFunding(scope);
  }
  if (pending.sourceTxFailed) {
    if (
      history.sourceTxFailed &&
      [
        ESwapTxHistoryStatus.FAILED,
        ESwapTxHistoryStatus.CANCELED,
        ESwapTxHistoryStatus.EXPIRED,
        ESwapTxHistoryStatus.REFUNDED,
      ].includes(history.status)
    ) {
      await releaseEarnFunding(scope, pending.txId);
    }
    return getEarnFunding(scope);
  }
  const result = await backgroundApiProxy.serviceSwap.fetchTxState({
    txId: pending.txId,
    orderId: history.swapInfo.orderId,
    provider: history.swapInfo.provider.provider,
    networkId: account.networkId,
    protocol: EProtocolOfExchange.SWAP,
    toTokenAddress: toToken.contractAddress,
    receivedAddress: receiver.address,
    ctx: history.ctx,
  });
  const settlement = getEarnSwapSettlement(
    result,
    account.networkId !== receiver.networkId,
  );
  if (settlement === 'delivered') {
    if (result.dealReceiveAmount) {
      await settleEarnFunding(scope, pending.txId, result.dealReceiveAmount);
    }
  } else if (settlement === 'failed') {
    await releaseEarnFunding(scope, pending.txId);
  }
  return getEarnFunding(scope);
}

/**
 * Waits on the chain for a sent swap: what it delivered once it lands (the
 * receipt's amount, when the service has it), or a failure. A balance
 * increase alone cannot identify which order delivered it.
 */
export async function waitForEarnSwap({
  txId,
  prepared,
  toToken,
  account,
  toAccount,
  signal,
}: {
  txId: string;
  prepared: IEarnSwapPrepared;
  toToken: ISwapToken;
  // The account that sent it, on the pay token's network
  account: IEarnSwapAccount;
  // Where a bridge's tokens land; unset, the sending account
  toAccount?: IEarnSwapAccount;
  signal?: AbortSignal;
}): Promise<{ receivedAmount?: string }> {
  if (!txId.trim()) throw new EarnSwapError('unknown');
  const isBridge = Boolean(
    toAccount && toAccount.networkId !== account.networkId,
  );
  const receiver = isBridge && toAccount ? toAccount : account;
  const deadline = Date.now() + (isBridge ? BRIDGE_WAIT_MS : SWAP_WAIT_MS);
  for (;;) {
    if (signal?.aborted) {
      throw new EarnSwapError('cancelled');
    }
    try {
      const result = await backgroundApiProxy.serviceSwap.fetchTxState({
        txId,
        orderId: prepared.execution.orderId,
        provider: prepared.buildRes.result.info.provider,
        networkId: account.networkId,
        protocol: EProtocolOfExchange.SWAP,
        toTokenAddress: toToken.contractAddress,
        receivedAddress: receiver.address,
        ctx: prepared.buildRes.ctx,
      });
      // A bridge is done once its tokens are out on the other network, not
      // when its first transaction lands
      const settlement = getEarnSwapSettlement(result, isBridge);
      if (settlement === 'delivered') {
        const received = new BigNumber(result.dealReceiveAmount ?? '');
        return {
          receivedAmount:
            received.isFinite() && received.gt(0)
              ? received.toFixed()
              : undefined,
        };
      }
      if (settlement === 'failed') {
        throw new EarnSwapError('failed', result.stateDetail);
      }
    } catch (error) {
      if (error instanceof EarnSwapError) {
        throw error;
      }
    }
    if (Date.now() > deadline) {
      throw new EarnSwapError('unknown');
    }
    await waitPoll(signal);
  }
}

// The token's balance on chain now, when it can be read
export async function readEarnSwapBalance({
  token,
  account,
}: {
  token: ISwapToken;
  account: IEarnSwapAccount;
}): Promise<string | undefined> {
  const result = await checkSwapLatestBalanceSufficient({
    token,
    amount: '0',
    accountId: account.accountId,
    accountAddress: account.address,
  }).catch(() => undefined);
  return result?.balance;
}

const BALANCE_TRIES = 10;

/**
 * The deposit token's balance on chain once it covers `atLeast`: the wallet's
 * own balance can trail the receipt by a few seconds. After a while the last
 * balance read is what there is
 */
export async function waitForEarnSwapBalance({
  token,
  atLeast,
  account,
  signal,
}: {
  token: ISwapToken;
  atLeast: string;
  account: IEarnSwapAccount;
  signal?: AbortSignal;
}): Promise<string | undefined> {
  let balance: string | undefined;
  for (let i = 0; i < BALANCE_TRIES; i += 1) {
    if (signal?.aborted) {
      break;
    }
    const result = await checkSwapLatestBalanceSufficient({
      token,
      amount: atLeast,
      accountId: account.accountId,
      accountAddress: account.address,
    }).catch(() => undefined);
    if (result?.balance !== undefined) {
      balance = result.balance;
      if (result.isSufficient) {
        return balance;
      }
    }
    await waitPoll(signal);
  }
  return balance;
}
