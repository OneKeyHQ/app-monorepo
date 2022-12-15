import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useDebounce } from '../../../hooks';
import {
  setError,
  setLoading,
  setQuoteLimited,
} from '../../../store/reducers/swap';
import { Token } from '../../../store/typings';
import { SwapQuoter } from '../quoter';
import { FetchQuoteParams, SwapError } from '../typings';
import {
  formatAmount,
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

export function useSwapQuoteRequestParams(): FetchQuoteParams | undefined {
  const swapSlippagePercent = useAppSelector(
    (s) => s.settings.swapSlippagePercent,
  );
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const independentField = useAppSelector((s) => s.swap.independentField);
  const typedValue = useAppSelector((s) => s.swap.typedValue);
  const inputTokenNetwork = useAppSelector((s) => s.swap.inputTokenNetwork);
  const outputTokenNetwork = useAppSelector((s) => s.swap.outputTokenNetwork);
  const sendingAccount = useAppSelector((s) => s.swap.sendingAccount);
  const receivingAddress = useAppSelector((s) => s.swap.recipient?.address);

  return useMemo(() => {
    if (
      !inputToken ||
      !outputToken ||
      !typedValue ||
      !inputTokenNetwork ||
      !outputTokenNetwork ||
      !sendingAccount ||
      !receivingAddress ||
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
      receivingAddress,
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
    receivingAddress,
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

  const swapQuote = useCallback(async () => {
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
      const res = await SwapQuoter.client.fetchQuote(params);
      if (refs.current.params === params) {
        backgroundApiProxy.dispatch(setLoading(false));
        if (res) {
          backgroundApiProxy.serviceSwap.setQuote(res.data);
          backgroundApiProxy.serviceSwap.setQuoteLimited(res.limited);
        } else {
          backgroundApiProxy.dispatch(
            setError(SwapError.NotSupport),
            setQuoteLimited(undefined),
          );
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
  return swapQuote;
};

export function useDerivedSwapState() {
  const independentField = useAppSelector((s) => s.swap.independentField);
  const typedValue = useAppSelector((s) => s.swap.typedValue);
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const swapQuote = useAppSelector((s) => s.swap.quote);
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
          ? formatAmount(inputAmount?.value)
          : formatAmount(outputAmount?.value),
    } as { 'INPUT'?: string; 'OUTPUT'?: string };
  }, [independentField, inputAmount, outputAmount, typedValue]);

  return {
    inputAmount,
    outputAmount,
    formattedAmounts,
  };
}

export const useSwapError = () => {
  const error = useAppSelector((s) => s.swap.error);
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const sendingAccount = useAppSelector((s) => s.swap.sendingAccount);
  const { inputAmount } = useDerivedSwapState();
  const inputBalance = useTokenBalance(
    inputAmount ? inputToken : undefined,
    sendingAccount?.id,
  );
  const inputBalanceBN = useMemo(() => {
    if (!inputBalance || !inputToken) return;
    return new TokenAmount(inputToken, inputBalance).toNumber();
  }, [inputToken, inputBalance]);

  const balanceError =
    inputAmount && inputBalanceBN && inputBalanceBN.lt(inputAmount.toNumber())
      ? SwapError.InsufficientBalance
      : undefined;
  return error || balanceError;
};

export function useInputLimitsError():
  | { message: string; value: string }
  | undefined {
  const intl = useIntl();
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const quoteLimited = useAppSelector((s) => s.swap.quoteLimited);
  const { inputAmount } = useDerivedSwapState();
  const maxAmount = useTokenAmount(inputToken, quoteLimited?.max);
  const minAmount = useTokenAmount(inputToken, quoteLimited?.min);
  return useMemo(() => {
    let message: string | undefined;
    let value: string | undefined;
    if (inputAmount && inputToken && (maxAmount || minAmount)) {
      if (minAmount) {
        const min = minAmount.typedValue;
        if (minAmount.amount.gt(inputAmount.amount)) {
          message = intl.formatMessage(
            { id: 'msg__str_minimum_amount' },
            { '0': `${min} ${inputToken.symbol}` },
          );
          value = min;
        }
      }
      if (maxAmount) {
        const max = maxAmount.typedValue;
        if (maxAmount.amount.lt(inputAmount.amount)) {
          message = intl.formatMessage(
            { id: 'msg__str_maximum_amount' },
            { '0': `${max} ${inputToken.symbol}` },
          );
          value = max;
        }
      }
    }
    if (!message || !value) {
      return;
    }
    return { message, value };
  }, [inputAmount, inputToken, maxAmount, minAmount, intl]);
}
