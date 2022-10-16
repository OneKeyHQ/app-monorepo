import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useDebounce } from '../../../hooks';
import { useRuntime } from '../../../hooks/redux';
import {
  setError,
  setLoading,
  setQuoteLimited,
} from '../../../store/reducers/swap';
import { Token } from '../../../store/typings';
import { enabledNetworkIds } from '../config';
import { SwapQuoter } from '../quoter';
import { FetchQuoteParams, SwapError } from '../typings';
import {
  getTokenAmountString,
  greaterThanZeroOrUndefined,
  nativeTokenAddress,
} from '../utils';

import { useTokenBalance } from './useSwapTokenUtils';

class TokenAmount {
  amount: BigNumber;

  decimals: BigNumber;

  value: BigNumber;

  base = new BigNumber(10);

  constructor(public token: Token, public typedValue: string) {
    this.value = new BigNumber(typedValue);
    this.decimals = new BigNumber(token.decimals);
    this.amount = this.base
      .exponentiatedBy(this.decimals)
      .multipliedBy(this.value);
  }

  toNumber() {
    return this.amount;
  }

  toFormat() {
    return this.toNumber().toFixed(0);
  }
}

export function useTokenAmount(token?: Token, amount?: string) {
  return useMemo(() => {
    if (!token || !amount) return;
    const bn = new BigNumber(amount);
    const decimals = new BigNumber(token.decimals);
    const base = new BigNumber(10);
    const value = bn.dividedBy(base.exponentiatedBy(decimals));
    return new TokenAmount(token, value.toFixed());
  }, [token, amount]);
}

export function useSwapState() {
  return useAppSelector((s) => s.swap);
}

export function useSwapRecipient() {
  return useAppSelector((s) => s.swap.recipient);
}

export function useSwapQuoteRequestParams(): FetchQuoteParams | undefined {
  const swapSlippagePercent = useAppSelector(
    (s) => s.settings.swapSlippagePercent,
  );
  const {
    inputToken,
    outputToken,
    independentField,
    typedValue,
    inputTokenNetwork,
    outputTokenNetwork,
    sendingAccount,
  } = useSwapState();

  return useMemo(() => {
    if (
      !inputToken ||
      !outputToken ||
      !typedValue ||
      !inputTokenNetwork ||
      !outputTokenNetwork ||
      !sendingAccount ||
      new BigNumber(typedValue).lte(0)
    ) {
      return;
    }
    return {
      typedValue,
      independentField,
      networkOut: outputTokenNetwork,
      networkIn: inputTokenNetwork,
      tokenOut: outputToken,
      tokenIn: inputToken,
      slippagePercentage: swapSlippagePercent,
      activeAccount: sendingAccount,
    };
  }, [
    typedValue,
    independentField,
    inputToken,
    outputToken,
    inputTokenNetwork,
    outputTokenNetwork,
    swapSlippagePercent,
    sendingAccount,
  ]);
}

export const useSwapQuoteCallback = function (
  options: { showLoading: boolean } = { showLoading: false },
) {
  const { showLoading } = options;
  const requestParams = useSwapQuoteRequestParams();
  const params = useDebounce(requestParams, 500);
  const refs = useRef({ params, count: 0 });

  useEffect(() => {
    refs.current.params = params;
  }, [params]);

  const onSwapQuote = useCallback(async () => {
    if (!params) {
      backgroundApiProxy.serviceSwap.setQuote(undefined);
      return;
    }
    if (showLoading) {
      backgroundApiProxy.dispatch(setLoading(true));
    }
    backgroundApiProxy.dispatch(setError(undefined));
    try {
      refs.current.params = params;
      refs.current.count += 1;
      const recipient = await backgroundApiProxy.serviceSwap.setRecipient(
        params.networkOut,
      );
      const res = await SwapQuoter.client.fetchQuote({
        ...params,
        receivingAddress: recipient?.address,
      });
      if (refs.current.params === params) {
        backgroundApiProxy.dispatch(setLoading(false));
        if (res) {
          if (res.data) {
            const { data } = res;
            if (data.allowanceTarget) {
              const allowance =
                await backgroundApiProxy.engine.getTokenAllowance({
                  networkId: params.tokenIn.networkId,
                  accountId: params.activeAccount.id,
                  tokenIdOnNetwork: params.tokenIn.tokenIdOnNetwork,
                  spender: data.allowanceTarget,
                });
              if (allowance) {
                data.needApproved = new BigNumber(
                  getTokenAmountString(params.tokenIn, allowance),
                ).lt(data.sellAmount);
              }
            }
            backgroundApiProxy.serviceSwap.setQuote(res.data);
          }
          backgroundApiProxy.dispatch(setQuoteLimited(res.limited));
        } else {
          backgroundApiProxy.dispatch(setError(SwapError.NotSupport));
        }
      }
    } catch (e) {
      backgroundApiProxy.dispatch(
        setError(SwapError.QuoteFailed),
        setLoading(false),
      );
    } finally {
      refs.current.count -= 1;
      if (refs.current.count === 0) {
        backgroundApiProxy.dispatch(setLoading(false));
      }
    }
  }, [params, showLoading]);
  return onSwapQuote;
};

export function useDerivedSwapState() {
  const {
    independentField,
    typedValue,
    inputToken,
    outputToken,
    quote: swapQuote,
    error: swapError,
    sendingAccount,
  } = useSwapState();

  const inputBalance = useTokenBalance(inputToken, sendingAccount?.id);

  const inputBalanceBN = useMemo(() => {
    if (!inputBalance || !inputToken) return;
    return new TokenAmount(inputToken, inputBalance).toNumber();
  }, [inputToken, inputBalance]);

  const inputAmount = useTokenAmount(
    inputToken,
    greaterThanZeroOrUndefined(swapQuote?.sellAmount),
  );
  const outputAmount = useTokenAmount(
    outputToken,
    greaterThanZeroOrUndefined(swapQuote?.buyAmount),
  );

  const formattedAmounts = useMemo(() => {
    const dependentField = independentField === 'INPUT' ? 'OUTPUT' : 'INPUT';
    return {
      [independentField]: typedValue,
      [dependentField]:
        dependentField === 'INPUT'
          ? inputAmount?.value.toFixed(4) || ''
          : outputAmount?.value.toFixed(4) || '',
    } as { 'INPUT'?: string; 'OUTPUT'?: string };
  }, [independentField, inputAmount, outputAmount, typedValue]);

  const balanceError =
    inputAmount && inputBalanceBN && inputBalanceBN.lt(inputAmount.toNumber())
      ? SwapError.InsufficientBalance
      : undefined;
  const error = swapError || balanceError;

  return {
    error,
    inputAmount,
    outputAmount,
    inputBalance,
    formattedAmounts,
  };
}

export function useInputLimitsError(): Error | undefined {
  const intl = useIntl();
  const { inputToken, quoteLimited } = useSwapState();
  const { inputAmount } = useDerivedSwapState();
  const maxAmount = useTokenAmount(inputToken, quoteLimited?.max);
  const minAmount = useTokenAmount(inputToken, quoteLimited?.min);
  return useMemo(() => {
    let message: string | undefined;
    if (inputAmount && inputToken && (maxAmount || minAmount)) {
      if (minAmount) {
        const min = minAmount.typedValue;
        if (minAmount.amount.gt(inputAmount.amount)) {
          message = intl.formatMessage(
            { id: 'msg__str_minimum_amount' },
            { '0': `${min} ${inputToken.symbol}` },
          );
        }
      }
      if (maxAmount) {
        const max = maxAmount.typedValue;
        if (maxAmount.amount.lt(inputAmount.amount)) {
          message = intl.formatMessage(
            { id: 'msg__str_maximum_amount' },
            { '0': `${max} ${inputToken.symbol}` },
          );
        }
      }
    }
    return message ? new Error(message) : undefined;
  }, [inputAmount, inputToken, maxAmount, minAmount, intl]);
}

export function useRestrictedTokens(
  tokens: Token[],
  included?: string[],
  excluded?: string[],
) {
  return useMemo(() => {
    const includedSet = new Set(included ?? []);
    const excludedSet = new Set(excluded ?? []);
    let result = tokens;
    if (included && included.length) {
      result = tokens.filter(
        (token) =>
          includedSet.has(token.tokenIdOnNetwork) ||
          (!token.tokenIdOnNetwork && includedSet.has(nativeTokenAddress)),
      );
    }
    if (excluded && excluded.length) {
      result = result.filter(
        (token) =>
          !(
            excludedSet.has(token.tokenIdOnNetwork) ||
            (!token.tokenIdOnNetwork && excludedSet.has(nativeTokenAddress))
          ),
      );
    }
    return result;
  }, [tokens, included, excluded]);
}

export function useEnabledSwappableNetworks() {
  const { networks } = useRuntime();
  return useMemo(
    () =>
      networks.filter(
        (item) => item.enabled && enabledNetworkIds.includes(item.id),
      ),
    [networks],
  );
}

export function useSwappableNativeTokens() {
  const enabledNativeTokens = useAppSelector(
    (s) => s.tokens.enabledNativeTokens,
  );
  return useMemo(() => {
    if (!enabledNativeTokens) {
      return [];
    }
    return enabledNativeTokens.filter((item) =>
      enabledNetworkIds.includes(item.networkId),
    );
  }, [enabledNativeTokens]);
}
