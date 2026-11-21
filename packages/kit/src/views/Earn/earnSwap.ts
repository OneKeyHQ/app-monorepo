import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IWrappedInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { swapSlippageAutoValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchQuoteInfo,
  IFetchQuoteResult,
  IFetchSwapQuoteParams,
  ISwapQuoteEventPayload,
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapTabSwitchType,
  EWrappedType,
} from '@onekeyhq/shared/types/swap/types';
import type { IToken } from '@onekeyhq/shared/types/token';

export type IEarnSwapQuoteConfig = Omit<
  IFetchSwapQuoteParams,
  'quoteRequestId' | 'cancelOnGlobalStop' | 'protocol' | 'kind'
> & {
  accountId: string;
  userAddress: string;
  receivingAddress: string;
  fromTokenAmount: string;
  protocol: ESwapTabSwitchType.SWAP | ESwapTabSwitchType.BRIDGE;
  kind?: ESwapQuoteKind.SELL;
  allowedProviders: readonly string[];
};

type IEarnSwapTokenInfo = Pick<
  ISwapTokenBase,
  'networkId' | 'contractAddress' | 'isNative'
> &
  Partial<Omit<ISwapTokenBase, 'networkId' | 'contractAddress' | 'isNative'>>;

export type IEarnSwapQuote = Omit<
  IFetchQuoteResult,
  'info' | 'fromTokenInfo' | 'toTokenInfo'
> & {
  info: Pick<IFetchQuoteInfo, 'provider'> & Partial<IFetchQuoteInfo>;
  fromTokenInfo: IEarnSwapTokenInfo;
  toTokenInfo: IEarnSwapTokenInfo;
};

function isQuote(value: unknown): value is IEarnSwapQuote {
  if (!value || typeof value !== 'object') return false;
  if (!('info' in value) || !value.info || typeof value.info !== 'object')
    return false;
  if (!('provider' in value.info) || typeof value.info.provider !== 'string')
    return false;
  if (!('fromAmount' in value) || typeof value.fromAmount !== 'string')
    return false;
  if (
    'toAmount' in value &&
    value.toAmount !== undefined &&
    typeof value.toAmount !== 'string'
  )
    return false;
  if ('fee' in value && value.fee !== undefined) {
    const fee = value.fee;
    if (
      !fee ||
      typeof fee !== 'object' ||
      !('percentageFee' in fee) ||
      typeof fee.percentageFee !== 'number'
    )
      return false;
    if (
      'protocolFees' in fee &&
      fee.protocolFees !== undefined &&
      typeof fee.protocolFees !== 'number'
    )
      return false;
    if (
      'otherFeeInfos' in fee &&
      fee.otherFeeInfos !== undefined &&
      (!Array.isArray(fee.otherFeeInfos) ||
        !fee.otherFeeInfos.every((item: unknown) =>
          Boolean(
            item &&
            typeof item === 'object' &&
            'amount' in item &&
            typeof item.amount === 'string',
          ),
        ))
    )
      return false;
  }
  const isToken = (token: unknown) => {
    if (!token || typeof token !== 'object') return false;
    return (
      'networkId' in token &&
      typeof token.networkId === 'string' &&
      'contractAddress' in token &&
      typeof token.contractAddress === 'string'
    );
  };
  return (
    'fromTokenInfo' in value &&
    isToken(value.fromTokenInfo) &&
    'toTokenInfo' in value &&
    isToken(value.toTokenInfo)
  );
}

function sameToken(actual: IEarnSwapTokenInfo, expected: ISwapTokenBase) {
  return (
    actual.networkId === expected.networkId &&
    ((actual.isNative === true && expected.isNative === true) ||
      (((actual.isNative !== true && expected.isNative !== true) ||
        (actual.isNative === undefined && expected.isNative === true)) &&
        equalTokenNoCaseSensitive({ token1: actual, token2: expected })))
  );
}

export function fetchEarnSwapQuote({
  config,
  signal,
  acceptQuote,
}: {
  config: IEarnSwapQuoteConfig;
  signal: AbortSignal;
  acceptQuote?: (quote: IEarnSwapQuote) => boolean;
}): Promise<IEarnSwapQuote> {
  const { allowedProviders, ...request } = config;
  const quoteRequestId = `earn-${generateUUID()}`;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishRef: {
      current: (error?: unknown, quote?: IEarnSwapQuote) => void;
    } = { current: () => undefined };
    const abort = () =>
      finishRef.current(new OneKeyLocalError('Earn swap quote cancelled'));
    const listener = (event: ISwapQuoteEventPayload) => {
      if (event.quoteRequestId !== quoteRequestId) return;
      if (event.type === 'error') {
        finishRef.current(
          new OneKeyLocalError('Earn swap quote request failed'),
        );
        return;
      }
      if (event.type === 'done' || event.type === 'close') {
        // On native, an error can immediately follow the done event.
        void Promise.resolve().then(() => finishRef.current());
        return;
      }
      if (event.type !== 'message') return;
      const data = (event.event as { data?: unknown }).data;
      if (typeof data !== 'string') return;
      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch {
        // Ignore an invalid provider event; another provider may still return a quote.
        return;
      }
      if (!payload || typeof payload !== 'object') return;
      if ('data' in payload && Array.isArray(payload.data)) {
        for (const candidate of payload.data as unknown[]) {
          if (
            isQuote(candidate) &&
            allowedProviders.includes(candidate.info.provider) &&
            !candidate.errorMessage &&
            sameToken(candidate.fromTokenInfo, request.fromToken) &&
            sameToken(candidate.toTokenInfo, request.toToken) &&
            new BigNumber(candidate.fromAmount ?? '').eq(
              request.fromTokenAmount,
            ) &&
            (candidate.protocol === undefined ||
              candidate.protocol === EProtocolOfExchange.SWAP) &&
            (candidate.kind === undefined ||
              candidate.kind === ESwapQuoteKind.SELL) &&
            (acceptQuote?.(candidate) ?? true)
          ) {
            finishRef.current(undefined, candidate);
            return;
          }
        }
      }
      if ('totalQuoteCount' in payload && payload.totalQuoteCount === 0)
        finishRef.current();
    };
    const timeout = setTimeout(() => finishRef.current(), 25_000);
    const finish = (error?: unknown, quote?: IEarnSwapQuote) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      appEventBus.off(EAppEventBusNames.SwapQuoteEvent, listener);
      void backgroundApiProxy.serviceSwap
        .cancelFetchQuoteEvents(quoteRequestId)
        .catch(() => undefined);
      if (quote) resolve(quote);
      else reject(error ?? new OneKeyLocalError('No matching Earn swap quote'));
    };
    finishRef.current = finish;
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    appEventBus.on(EAppEventBusNames.SwapQuoteEvent, listener);
    void backgroundApiProxy.serviceSwap
      .fetchQuotesEvents({
        ...request,
        quoteRequestId,
        cancelOnGlobalStop: false,
      })
      .catch((error: unknown) => finish(error))
      .finally(() => {
        if (settled) {
          void backgroundApiProxy.serviceSwap
            .cancelFetchQuoteEvents(quoteRequestId)
            .catch(() => undefined);
        }
      });
  });
}

function toSwapToken(networkId: string, token: IToken): ISwapToken {
  return {
    networkId,
    contractAddress: token.address,
    isNative: token.isNative,
    symbol: token.symbol,
    decimals: token.decimals,
    name: token.name,
    logoURI: token.logoURI,
  };
}

export async function prepareEarnWrap({
  accountId,
  networkId,
  accountAddress,
  inputToken,
  wrappedToken,
  amount,
  signal,
}: {
  accountId: string;
  networkId: string;
  accountAddress: string;
  inputToken: IToken;
  wrappedToken: IToken;
  amount: string;
  signal: AbortSignal;
}): Promise<IWrappedInfo> {
  const fromToken = toSwapToken(networkId, inputToken);
  const toToken = toSwapToken(networkId, wrappedToken);
  const value = new BigNumber(amount);
  if (
    !accountAddress.trim() ||
    !inputToken.isNative ||
    wrappedToken.isNative ||
    (inputToken.networkId && inputToken.networkId !== networkId) ||
    (wrappedToken.networkId && wrappedToken.networkId !== networkId) ||
    inputToken.decimals !== wrappedToken.decimals ||
    !value.isFinite() ||
    !value.gt(0) ||
    !value.shiftedBy(inputToken.decimals).isInteger() ||
    !checkWrappedTokenPair({ fromToken, toToken })
  )
    throw new OneKeyLocalError('Invalid Earn wrap request');
  const quote = await fetchEarnSwapQuote({
    config: {
      accountId,
      userAddress: accountAddress,
      receivingAddress: accountAddress,
      fromToken,
      toToken,
      fromTokenAmount: amount,
      slippagePercentage: swapSlippageAutoValue,
      protocol: ESwapTabSwitchType.SWAP,
      kind: ESwapQuoteKind.SELL,
      allowedProviders: ['wrapped'],
    },
    signal,
    acceptQuote: (candidate) =>
      candidate.isWrapped === true &&
      new BigNumber(candidate.toAmount ?? '').eq(value) &&
      !candidate.allowanceResult &&
      !candidate.approvedInfo &&
      !candidate.swapShouldSignedData &&
      !candidate.shouldWrappedToken &&
      !candidate.quoteShowTip?.showCheckbox &&
      (candidate.fee === undefined ||
        new BigNumber(candidate.fee.percentageFee).isZero()) &&
      (candidate.fee?.protocolFees === undefined ||
        new BigNumber(candidate.fee.protocolFees).isZero()) &&
      (candidate.fee?.otherFeeInfos ?? []).every((fee) =>
        new BigNumber(fee.amount ?? '').isZero(),
      ),
  });
  return {
    from: accountAddress,
    amount: quote.fromAmount ?? amount,
    contract: wrappedToken.address,
    type: EWrappedType.DEPOSIT,
  };
}
