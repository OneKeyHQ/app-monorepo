import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { buildMarketExecutionPayload } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketBuildExecutionUtils';
import { checkSwapLatestBalanceSufficient } from '@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { sortSwapQuotes } from '@onekeyhq/shared/src/utils/swapQuoteSortUtils';
import { swapSlippageAutoValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  EProtocolOfExchange,
  ESwapCrossChainStatus,
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

import {
  getEarnSwapSlippage,
  isEarnBridge,
  isUsableEarnSwapQuote,
} from './earnRouter.utils';

// Paying with another token on a provider that takes only its own: a real
// swap through the app's swap service, then the provider's own deposit form

export type IEarnSwapReason =
  // No provider quotes the pair for this amount
  | 'noRoute'
  // Quoted, but not as one on-chain swap this path can wait on
  | 'unsupported'
  // The swap reverted, expired or was refunded
  | 'failed'
  | 'cancelled';

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
let quoteSequence = 0;

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
  quoteSequence += 1;
  const quoteRequestId = `earn-swap-${quoteSequence}`;
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
    if (quote.approvedInfo?.isApproved) {
      return [];
    }
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
};

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
  const isBridge = isEarnBridge({ fromToken, toToken });
  const receiver = isBridge && toAccount ? toAccount : account;
  if (isBridge && !toAccount) {
    throw new EarnSwapError('unsupported');
  }
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
  return { buildRes, execution, approvesInfo };
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
      resolve();
    }
    signal?.addEventListener('abort', finish, { once: true });
  });

const FAILED_STATES = new Set([
  ESwapTxHistoryStatus.FAILED,
  ESwapTxHistoryStatus.REFUNDED,
  ESwapTxHistoryStatus.CANCELED,
  ESwapTxHistoryStatus.EXPIRED,
]);

// A bridge that stopped on its way: its tokens come back, or never left
const FAILED_CROSS_CHAIN_STATES = new Set([
  ESwapCrossChainStatus.FROM_FAILED,
  ESwapCrossChainStatus.BRIDGE_FAILED,
  ESwapCrossChainStatus.TO_FAILED,
  ESwapCrossChainStatus.REFUNDING,
  ESwapCrossChainStatus.REFUNDED,
  ESwapCrossChainStatus.REFUND_FAILED,
  ESwapCrossChainStatus.EXPIRED,
  ESwapCrossChainStatus.PROVIDER_ERROR,
]);

// A same-network swap lands in seconds; one not in by then went wrong. A
// bridge can take a while longer: some routes wait for finality
const SWAP_WAIT_MS = 10 * 60 * 1000;
const BRIDGE_WAIT_MS = 45 * 60 * 1000;

/**
 * Waits on the chain for a sent swap: what it delivered once it lands (the
 * receipt's amount, when the service has it), or a failure. A read that
 * fails is asked again; the swap is out either way. Given `landedBalance`,
 * a deposit token balance that reaches it counts as landed too, for when the
 * service can't tell
 */
export async function waitForEarnSwap({
  txId,
  prepared,
  toToken,
  account,
  toAccount,
  landedBalance,
  signal,
}: {
  txId: string;
  prepared: IEarnSwapPrepared;
  toToken: ISwapToken;
  // The account that sent it, on the pay token's network
  account: IEarnSwapAccount;
  // Where a bridge's tokens land; unset, the sending account
  toAccount?: IEarnSwapAccount;
  landedBalance?: string;
  signal?: AbortSignal;
}): Promise<{ receivedAmount?: string }> {
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
      const isDelivered =
        !isBridge ||
        result.crossChainStatus === undefined ||
        result.crossChainStatus === ESwapCrossChainStatus.TO_SUCCESS;
      if (result.state === ESwapTxHistoryStatus.SUCCESS && isDelivered) {
        const received = new BigNumber(result.dealReceiveAmount ?? '');
        return {
          receivedAmount:
            received.isFinite() && received.gt(0)
              ? received.toFixed()
              : undefined,
        };
      }
      if (
        FAILED_STATES.has(result.state) ||
        (result.crossChainStatus !== undefined &&
          FAILED_CROSS_CHAIN_STATES.has(result.crossChainStatus))
      ) {
        throw new EarnSwapError('failed', result.stateDetail);
      }
    } catch (error) {
      if (error instanceof EarnSwapError) {
        throw error;
      }
    }
    if (landedBalance) {
      const balance = await checkSwapLatestBalanceSufficient({
        token: toToken,
        amount: landedBalance,
        accountId: receiver.accountId,
        accountAddress: receiver.address,
      }).catch(() => undefined);
      // An unread balance passes the check; it proves nothing here
      if (balance?.balance !== undefined && balance.isSufficient) {
        return {};
      }
    }
    if (Date.now() > deadline) {
      throw new EarnSwapError('failed');
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
