import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { useAppSelector, useDebounce } from '../../../hooks';
import { SwapError } from '../typings';
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
import type { FetchQuoteParams } from '../typings';

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
