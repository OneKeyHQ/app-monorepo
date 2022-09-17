import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useDebounce,
} from '../../../hooks';
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
import { greaterThanZeroOrUndefined, nativeTokenAddress } from '../utils';

import { useCachedBalances } from './useSwapTokenUtils';

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
    return new TokenAmount(token, value.toString());
  }, [token, amount]);
}

export function useSwapState() {
  return useAppSelector((s) => s.swap);
}

export function useTokenBalance(
  token?: Token,
  networkId?: string,
  accountId?: string,
): BigNumber | undefined {
  const balances = useCachedBalances(networkId, accountId);
  useEffect(() => {
    async function main() {
      if (
        token &&
        networkId &&
        accountId &&
        balances[token.tokenIdOnNetwork || 'main'] === undefined
      ) {
        debugLogger.swap.info(
          'useTokenBalance',
          token.tokenIdOnNetwork,
          balances[token.tokenIdOnNetwork || 'main'],
        );
        const result = await backgroundApiProxy.serviceToken.fetchTokenBalance({
          activeAccountId: accountId,
          activeNetworkId: networkId,
          tokenIds: [token.tokenIdOnNetwork],
        });
        debugLogger.swap.info('useTokenBalance result', result);
      }
    }
    main();
  }, [token, balances, networkId, accountId]);
  const balance = balances[token?.tokenIdOnNetwork || 'main'];
  return useMemo(() => {
    if (!token || !balance || !networkId || !accountId) {
      return;
    }
    return new TokenAmount(token, balance).toNumber();
  }, [token, networkId, accountId, balance]);
}

export function useSwapRecipient() {
  return useAppSelector((s) => s.swap.recipient);
}

export function useSwapQuoteRequestParams(): FetchQuoteParams | undefined {
  const swapSlippagePercent = useAppSelector(
    (s) => s.settings.swapSlippagePercent,
  );
  const { account } = useActiveWalletAccount();
  const {
    inputToken,
    outputToken,
    independentField,
    typedValue,
    inputTokenNetwork,
    outputTokenNetwork,
  } = useSwapState();

  return useMemo(() => {
    if (
      !inputToken ||
      !outputToken ||
      !typedValue ||
      !inputTokenNetwork ||
      !outputTokenNetwork ||
      !account ||
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
      activeAccount: account,
    };
  }, [
    typedValue,
    independentField,
    inputToken,
    outputToken,
    inputTokenNetwork,
    outputTokenNetwork,
    swapSlippagePercent,
    account,
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
      debugLogger.swap.info(
        'quote params',
        params.tokenIn.networkId,
        params.tokenIn.tokenIdOnNetwork || 'native',
        params.tokenOut.networkId,
        params.tokenOut.tokenIdOnNetwork || 'native',
        params.typedValue,
      );
      const recipient = await backgroundApiProxy.serviceSwap.setRecipient(
        params.networkOut,
      );
      const res = await SwapQuoter.client.fetchQuote({
        ...params,
        receivingAddress: recipient?.address,
      });
      debugLogger.swap.info('quote success');
      if (refs.current.params === params) {
        backgroundApiProxy.dispatch(setLoading(false));
        if (res) {
          if (res.data) {
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

export function useTokenAllowance(token?: Token, spender?: string) {
  const { accountId, networkId } = useActiveWalletAccount();
  const [allowance, setAllowance] = useState<string>();
  const onQuery = useCallback(async () => {
    if (accountId && networkId && token && token.tokenIdOnNetwork && spender) {
      const allowanceData = await backgroundApiProxy.engine.getTokenAllowance({
        spender,
        networkId,
        accountId,
        tokenIdOnNetwork: token?.tokenIdOnNetwork,
      });
      if (allowanceData !== undefined) {
        setAllowance(allowanceData);
      } else {
        setAllowance(undefined);
      }
    }
  }, [accountId, networkId, token, spender]);
  useEffect(() => {
    onQuery();
    const timer = setInterval(onQuery, 1000 * 10);
    return () => {
      setAllowance(undefined);
      clearInterval(timer);
    };
  }, [onQuery]);
  return useMemo(
    () =>
      token && allowance
        ? new TokenAmount(token, allowance).toNumber()
        : undefined,
    [token, allowance],
  );
}

export function useDerivedSwapState() {
  const {
    independentField,
    typedValue,
    inputToken,
    outputToken,
    inputTokenNetwork,
    outputTokenNetwork,
    quote: swapQuote,
    error: swapError,
  } = useSwapState();
  const { accountId } = useActiveWalletAccount();
  const inputBalance = useTokenBalance(
    inputToken,
    inputTokenNetwork?.id,
    accountId,
  );
  const outputBalance = useTokenBalance(
    outputToken,
    outputTokenNetwork?.id,
    accountId,
  );
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
    inputAmount && inputBalance && inputBalance.lt(inputAmount.toNumber())
      ? SwapError.InsufficientBalance
      : undefined;
  const error = swapError || balanceError;

  return {
    error,
    inputAmount,
    outputAmount,
    inputBalance,
    outputBalance,
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
      enabledNetworkIds.includes(item.id),
    );
  }, [enabledNativeTokens]);
}
