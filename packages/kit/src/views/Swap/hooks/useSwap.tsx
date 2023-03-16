import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useDebounce } from '../../../hooks';
import {
  setError,
  setLoading,
  setQuote,
  setQuoteLimited,
  setResponses,
} from '../../../store/reducers/swap';
import { SwapQuoter } from '../quoter';
import { dangerRefs } from '../refs';
import { QuoterType, SwapError } from '../typings';
import {
  formatAmount,
  getNetworkIdImpl,
  getTokenAmountString,
  getTokenAmountValue,
  greaterThanZeroOrUndefined,
} from '../utils';

import { useTokenBalance } from './useSwapTokenUtils';
import { useSwapSlippage } from './useSwapUtils';

import type { Token } from '../../../store/typings';
import type { FetchQuoteParams, FetchQuoteResponse } from '../typings';

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
    const value = getTokenAmountValue(token, amount);
    return new TokenAmount(token, value.toFixed());
  }, [token, amount]);
}

export function useSwapState() {
  return useAppSelector((s) => s.swap);
}

export function useSwapRecipient() {
  const recipient = useAppSelector((s) => s.swap.recipient);
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const sendingAccount = useAppSelector((s) => s.swap.sendingAccount);
  const allowAnotherRecipientAddress = useAppSelector(
    (s) => s.swapTransactions.allowAnotherRecipientAddress,
  );
  if (inputToken && outputToken) {
    const implA = getNetworkIdImpl(inputToken.networkId);
    const implB = getNetworkIdImpl(outputToken.networkId);
    if (implA === implB && !allowAnotherRecipientAddress) {
      if (sendingAccount) {
        return {
          accountId: sendingAccount.id,
          address: sendingAccount.address,
          name: sendingAccount.name,
          networkId: inputToken.networkId,
          networkImpl: inputToken.impl,
        };
      }
    }
  }
  return recipient;
}

export function useSwapQuoteRequestParams(): FetchQuoteParams | undefined {
  const { value: swapSlippagePercent } = useSwapSlippage();
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const independentField = useAppSelector((s) => s.swap.independentField);
  const typedValue = useAppSelector((s) => s.swap.typedValue);
  const inputTokenNetwork = useAppSelector((s) => s.swap.inputTokenNetwork);
  const outputTokenNetwork = useAppSelector((s) => s.swap.outputTokenNetwork);
  const sendingAccount = useAppSelector((s) => s.swap.sendingAccount);
  const recipient = useSwapRecipient();
  const receivingAddress = recipient?.address;

  const params = useMemo(() => {
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
  return useDebounce(params, 500);
}

export const useSwapQuoteCallback = function (
  options: { showLoading: boolean } = { showLoading: false },
) {
  const { showLoading } = options;
  const params = useSwapQuoteRequestParams();
  const refs = useRef({ params, count: 0 });

  useEffect(() => {
    refs.current.params = params;
  }, [params]);

  const swapQuote = useCallback(async () => {
    if (!params) {
      backgroundApiProxy.dispatch(
        setQuote(undefined),
        setResponses(undefined),
        setLoading(false),
      );
      return;
    }
    const wrapperTx =
      await backgroundApiProxy.serviceSwap.buildWrapperTransaction(params);
    if (wrapperTx && wrapperTx.encodedTx) {
      backgroundApiProxy.dispatch(
        setQuoteLimited(undefined),
        setQuote({
          type: QuoterType.onekey,
          instantRate: '1',
          wrapperTxInfo: wrapperTx,
          sellAmount: getTokenAmountString(params.tokenIn, params.typedValue),
          sellTokenAddress: params.tokenIn.tokenIdOnNetwork,
          buyAmount: getTokenAmountString(params.tokenOut, params.typedValue),
          buyTokenAddress: params.tokenOut.tokenIdOnNetwork,
        }),
      );
      return;
    }

    const isRefresh = await backgroundApiProxy.serviceSwap.refreshParams(
      params,
    );

    if (showLoading) {
      backgroundApiProxy.dispatch(setLoading(true));
    }

    backgroundApiProxy.dispatch(setError(undefined));

    const findBestResponse = async (
      responses: FetchQuoteResponse[],
    ): Promise<FetchQuoteResponse | undefined> => {
      const items = responses.filter(
        (item) => !item.limited && item.data !== undefined,
      ) as Required<Pick<FetchQuoteResponse, 'data'>>[];
      if (items.length > 0) {
        const quoter =
          await backgroundApiProxy.serviceSwap.getCurrentUserSelectedQuoter();
        if (quoter) {
          const searched = items.find((item) => item.data.type === quoter);
          if (searched) {
            return searched;
          }
        }
        if (items.length === 1) {
          return items[0];
        }
        items.sort((a, b) => {
          const amountA = a.data.estimatedBuyAmount ?? a.data.buyAmount;
          const amountB = b.data.estimatedBuyAmount ?? b.data.buyAmount;
          return Number(amountB) - Number(amountA);
        });
        return items[0];
      }
      return responses[0];
    };

    const fetchASAPQuote = async () => {
      refs.current.params = params;
      refs.current.count += 1;

      let firstResponse: FetchQuoteResponse | undefined;

      const fetchAllQuotes = async () => {
        const responses = await SwapQuoter.client.fetchQuotes(params);
        if (
          !dangerRefs.submited &&
          refs.current.params === params &&
          responses
        ) {
          backgroundApiProxy.dispatch(setResponses(responses));
          const res = await findBestResponse(responses);
          if (res && res.data?.type !== firstResponse?.data?.type) {
            if (!firstResponse) {
              firstResponse = res;
            }
            backgroundApiProxy.dispatch(
              setQuote(res.data),
              setQuoteLimited(res.limited),
            );
          }
        }
      };

      fetchAllQuotes();
      try {
        const res = await SwapQuoter.client.fetchQuote(params);
        if (refs.current.params === params && !firstResponse) {
          if (res) {
            firstResponse = res;
            backgroundApiProxy.dispatch(
              setQuote(res.data),
              setQuoteLimited(res.limited),
            );
          } else {
            backgroundApiProxy.dispatch(
              setError(SwapError.NotSupport),
              setQuoteLimited(undefined),
            );
          }
        }
      } catch {
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
    };

    const refreshQuotes = async () => {
      refs.current.params = params;
      refs.current.count += 1;
      try {
        const responses = await SwapQuoter.client.fetchQuotes(params);
        if (!dangerRefs.submited && refs.current.params === params) {
          if (responses) {
            backgroundApiProxy.dispatch(setResponses(responses));
            const res = await findBestResponse(responses);
            if (res) {
              backgroundApiProxy.dispatch(
                setQuote(res.data),
                setQuoteLimited(res.limited),
              );
            } else {
              backgroundApiProxy.dispatch(
                setError(SwapError.NotSupport),
                setQuoteLimited(undefined),
              );
            }
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
    };

    if (!isRefresh) {
      backgroundApiProxy.dispatch(setResponses(undefined));
      await fetchASAPQuote();
    } else {
      await refreshQuotes();
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

export function useSwapInputAmount() {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const typedValue = useAppSelector((s) => s.swap.typedValue);
  return useMemo(() => {
    if (inputToken && typedValue) {
      return getTokenAmountString(inputToken, typedValue);
    }
  }, [inputToken, typedValue]);
}

export const useCheckInputBalance = () => {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const sendingAccount = useAppSelector((s) => s.swap.sendingAccount);
  // const { inputAmount } = useDerivedSwapState();
  const inputAmount = useSwapInputAmount();
  const inputBalance = useTokenBalance(
    inputAmount ? inputToken : undefined,
    sendingAccount?.id,
  );
  return useMemo(() => {
    if (inputToken && inputBalance && inputAmount) {
      const bn = new TokenAmount(inputToken, inputBalance).toNumber();
      return { insufficient: bn.lt(inputAmount), token: inputToken };
    }
  }, [inputToken, inputBalance, inputAmount]);
};

export const useSwapError = () => {
  const error = useAppSelector((s) => s.swap.error);
  const balanceInfo = useCheckInputBalance();
  return useMemo(() => {
    if (error) return error;
    return balanceInfo && balanceInfo.insufficient
      ? SwapError.InsufficientBalance
      : undefined;
  }, [error, balanceInfo]);
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
