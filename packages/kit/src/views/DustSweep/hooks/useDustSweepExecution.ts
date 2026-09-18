import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { buildMarketExecutionPayload } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketBuildExecutionUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EInternalDappEnum } from '@onekeyhq/shared/types/staking';
import type {
  IExchangeBuildTxBatchParams,
  IExchangeBuildTxBatchResult,
  IFetchQuoteResult,
  ISwapQuoteEventPayload,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapQuoteSource,
  ESwapTabSwitchType,
  ESwapTradeSource,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { ensureDustSweepAllowance } from './dustSweepAllowance';

import type { IDustSweepCandidate, IDustSweepItem } from '../stateMachine';

const QUOTE_TIMEOUT_MS = 20_000;
const SETTLEMENT_POLL_INTERVAL_MS = 3000;
const SETTLEMENT_POLL_ATTEMPTS = 20;

type IDustSweepBatchSwapService = {
  fetchApproveAllowanceBatch: (params: {
    accountId?: string;
    fromNetworkId: string;
    protocol: EProtocolOfExchange;
    fromTokenList: { contractAddress: string; amount: string }[];
  }) => Promise<
    | {
        results: { contractAddress: string; approveAddress?: string }[];
      }
    | undefined
  >;
  fetchBuildTxBatch: (
    params: IExchangeBuildTxBatchParams & { accountId?: string },
  ) => Promise<IExchangeBuildTxBatchResult | undefined>;
};

function toSwapToken(token: IDustSweepCandidate): ISwapToken {
  return {
    networkId: token.networkId ?? '',
    contractAddress: token.address,
    isNative: token.isNative,
    symbol: token.symbol,
    decimals: token.decimals,
    name: token.name,
    logoURI: token.logoURI,
    balanceParsed: token.balanceParsed,
    fiatValue: token.fiatValue,
  };
}

function waitForQuote(params: {
  fromToken: ISwapToken;
  toToken: ISwapToken;
  fromTokenAmount: string;
  userAddress: string;
  receivingAddress: string;
  accountId: string;
  slippagePercentage: number;
}) {
  const quoteRequestId = `dust-sweep-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  return new Promise<IFetchQuoteResult>((resolve, reject) => {
    let settled = false;
    const timeoutRef: { current?: ReturnType<typeof setTimeout> } = {};
    const finishRef: {
      current?: (error?: Error, quote?: IFetchQuoteResult) => void;
    } = {};
    const listener = (event: ISwapQuoteEventPayload) => {
      if (event.quoteRequestId !== quoteRequestId) return;
      if (event.type === 'error') {
        finishRef.current?.(
          new OneKeyLocalError(
            (event.event as { message?: string }).message ?? 'Quote failed',
          ),
        );
        return;
      }
      if (event.type !== 'message') return;
      try {
        const data = JSON.parse(
          String((event.event as { data?: string }).data),
        ) as {
          data?: IFetchQuoteResult[];
          errorMessage?: string;
        };
        if (data.errorMessage) {
          finishRef.current?.(new Error(data.errorMessage));
          return;
        }
        const quote = data.data?.find((item) => Boolean(item.info?.provider));
        if (quote) finishRef.current?.(undefined, quote);
      } catch (error) {
        finishRef.current?.(
          error instanceof Error ? error : new OneKeyLocalError(String(error)),
        );
      }
    };
    finishRef.current = (error?: Error, quote?: IFetchQuoteResult) => {
      if (settled) return;
      settled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      appEventBus.off(EAppEventBusNames.SwapQuoteEvent, listener);
      void backgroundApiProxy.serviceSwap.cancelFetchQuoteEvents(
        quoteRequestId,
      );
      if (error) reject(error);
      else if (quote) resolve(quote);
      else reject(new OneKeyLocalError('Dust Sweep returned no quote'));
    };
    timeoutRef.current = setTimeout(() => {
      if (settled) return;
      finishRef.current?.(new OneKeyLocalError('Dust Sweep quote timed out'));
    }, QUOTE_TIMEOUT_MS);
    appEventBus.on(EAppEventBusNames.SwapQuoteEvent, listener);
    void backgroundApiProxy.serviceSwap.fetchQuotesEvents({
      source: ESwapQuoteSource.SWEEP,
      fromToken: params.fromToken,
      toToken: params.toToken,
      fromTokenAmount: params.fromTokenAmount,
      userAddress: params.userAddress,
      receivingAddress: params.receivingAddress,
      accountId: params.accountId,
      slippagePercentage: params.slippagePercentage,
      kind: ESwapQuoteKind.SELL,
      protocol: ESwapTabSwitchType.SWAP,
      quoteRequestId,
    });
  });
}

async function waitForSettlement(params: {
  txId: string;
  orderId?: string;
  provider: string;
  networkId: string;
  toTokenAddress: string;
  receivingAddress: string;
  ctx?: unknown;
}) {
  for (let attempt = 0; attempt < SETTLEMENT_POLL_ATTEMPTS; attempt += 1) {
    const state = await backgroundApiProxy.serviceSwap.fetchTxState({
      txId: params.txId,
      orderId: params.orderId,
      provider: params.provider,
      networkId: params.networkId,
      protocol: EProtocolOfExchange.SWAP,
      toTokenAddress: params.toTokenAddress,
      receivedAddress: params.receivingAddress,
      ctx: params.ctx,
    });
    if (state.state === ESwapTxHistoryStatus.SUCCESS)
      return state.dealReceiveAmount ?? '0';
    if (
      [
        ESwapTxHistoryStatus.FAILED,
        ESwapTxHistoryStatus.REFUNDED,
        ESwapTxHistoryStatus.EXPIRED,
        ESwapTxHistoryStatus.CANCELED,
      ].includes(state.state)
    ) {
      throw new OneKeyLocalError(
        state.stateDetail ?? `Swap settled as ${state.state}`,
      );
    }
    await new Promise((resolve) =>
      setTimeout(resolve, SETTLEMENT_POLL_INTERVAL_MS),
    );
  }
  throw new OneKeyLocalError('Dust Sweep settlement is still pending');
}

export function useDustSweepExecution() {
  return useCallback(
    async ({
      item,
      targetToken,
      accountId,
      userAddress,
      slippagePercentage,
    }: {
      item: IDustSweepItem;
      targetToken: IDustSweepCandidate;
      accountId: string;
      userAddress: string;
      slippagePercentage: number;
    }) => {
      const fromToken = toSwapToken(item.token);
      const toToken = toSwapToken(targetToken);
      const quote = await waitForQuote({
        fromToken,
        toToken,
        fromTokenAmount: item.token.balance ?? item.token.balanceParsed ?? '0',
        userAddress,
        receivingAddress: userAddress,
        accountId,
        slippagePercentage,
      });
      const batchSwapService =
        backgroundApiProxy.serviceSwap as unknown as IDustSweepBatchSwapService;
      const allowanceBatch = fromToken.isNative
        ? undefined
        : await batchSwapService.fetchApproveAllowanceBatch({
            accountId,
            fromNetworkId: fromToken.networkId,
            protocol: EProtocolOfExchange.SWAP,
            fromTokenList: [
              {
                contractAddress: fromToken.contractAddress,
                amount: quote.fromAmount ?? item.token.balance ?? '0',
              },
            ],
          });
      const approveAddress = allowanceBatch?.results.find(
        (result) => result.contractAddress === fromToken.contractAddress,
      )?.approveAddress;
      await ensureDustSweepAllowance({
        accountId,
        userAddress,
        token: fromToken,
        amount: quote.fromAmount ?? item.token.balance ?? '0',
        quote,
        approveAddress,
      });
      const buildBatch = await batchSwapService.fetchBuildTxBatch({
        accountId,
        fromNetworkId: fromToken.networkId,
        toNetworkId: toToken.networkId,
        fromTokenList: [
          {
            contractAddress: fromToken.contractAddress,
            amount: quote.fromAmount ?? item.token.balance ?? '0',
          },
        ],
        toTokenAddress: toToken.contractAddress,
        provider: quote.info.provider,
        toTokenAmount: quote.toAmount ?? '0',
        userAddress,
        receivingAddress: userAddress,
        slippagePercentage,
        quoteResultCtx: quote.quoteResultCtx,
        kind: quote.kind ?? ESwapQuoteKind.SELL,
        tradeSource: ESwapTradeSource.SWAP_BRIDGE,
        source: ESwapQuoteSource.SWEEP,
      });
      const buildResult = buildBatch?.results[0];
      const buildRes = buildResult?.success ? buildResult.data : undefined;
      if (!buildRes) throw new OneKeyLocalError('Dust Sweep build failed');
      const execution = await buildMarketExecutionPayload({
        accountId,
        buildRes,
        currentFromToken: fromToken,
        currentToToken: toToken,
        fromAmount: quote.fromAmount ?? item.token.balance ?? '0',
        receivingAddress: userAddress,
        userAddress,
        slippage: slippagePercentage,
        swapType: ESwapTabSwitchType.SWAP,
        onBuildOkxSwapEncodedTx: (params) =>
          backgroundApiProxy.serviceSwap.buildOkxSwapEncodedTx(params),
        onBuildLMSwapEncodedTx: (params) =>
          backgroundApiProxy.serviceSwap.buildLMSwapEncodedTx(params),
        onBuildInternalDappTx: (params) =>
          backgroundApiProxy.serviceStaking.buildInternalDappTx({
            ...params,
            internalDappType: EInternalDappEnum.Swap,
          }),
      });
      if (execution.skipSendTransAction || !execution.encodedTx) {
        throw new OneKeyLocalError(
          'This swap requires a signed order and cannot run in Dust Sweep',
        );
      }
      const unsignedTx = await backgroundApiProxy.serviceSend.buildUnsignedTx({
        accountId,
        networkId: fromToken.networkId,
        encodedTx: execution.encodedTx,
        swapInfo: execution.swapInfo,
      });
      const signedTx =
        await backgroundApiProxy.serviceSend.signAndSendTransaction({
          networkId: fromToken.networkId,
          accountId,
          unsignedTx,
          signOnly: false,
        });
      const receivedAmount = await waitForSettlement({
        txId: signedTx.txid,
        orderId: execution.orderId,
        provider: quote.info.provider,
        networkId: fromToken.networkId,
        toTokenAddress: toToken.contractAddress,
        receivingAddress: userAddress,
        ctx: buildRes.ctx,
      });
      return {
        receivedAmount: new BigNumber(receivedAmount).toFixed(),
        txId: signedTx.txid,
      };
    },
    [],
  );
}
