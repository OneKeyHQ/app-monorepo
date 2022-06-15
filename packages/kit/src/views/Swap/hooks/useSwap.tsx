import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useAccountTokensBalance,
  useActiveWalletAccount,
  useAppSelector,
  useDebounce,
} from '../../../hooks';
import {
  refresh,
  reset,
  setActiveNetwork,
  setError,
  setInputToken,
  setLoading,
  setOutputToken,
  setQuote,
  setTypedValue,
  switchTokens,
} from '../../../store/reducers/swap';
import { Token } from '../../../store/typings';
import { SwapQuoter } from '../quoter';
import { ApprovalState, QuoteParams, SwapError } from '../typings';
import { greaterThanZeroOrUndefined } from '../utils';

import { useHasPendingApproval } from './useTransactions';

const swapClient = new SwapQuoter();

enum Chains {
  MAINNET = '1',
  ROPSTEN = '3',
  KOVAN = '42',
  BSC = '56',
  POLYGON = '137',
  FANTOM = '250',
  AVALANCHE = '43114',
}

const NETWORKS: Record<string, string> = {
  [Chains.MAINNET]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=ethereum',
  [Chains.ROPSTEN]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=ropsten',
  [Chains.KOVAN]: 'https://kovan.api.0x.org/swap/v1/quote',
  [Chains.BSC]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=bsc',

  [Chains.POLYGON]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=polygon',
  [Chains.FANTOM]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=fantom',
  [Chains.AVALANCHE]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=avalanche',
};
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
  if (!token || !amount) return;
  const bn = new BigNumber(amount);
  const decimals = new BigNumber(token.decimals);
  const base = new BigNumber(10);
  const value = bn.dividedBy(base.exponentiatedBy(decimals));
  return new TokenAmount(token, value.toString());
}

export function isStableCurrency(currency?: Token) {
  const stable = ['USDT', 'DAI', 'BUSD', 'USDC'];
  return currency && currency.symbol && stable.includes(currency.symbol);
}

export function useSwapEnabled() {
  const { network } = useActiveWalletAccount();
  const chainId = network?.extraInfo?.chainId;
  const index = String(+chainId);
  return !!NETWORKS[index];
}

export function useSwapState() {
  return useAppSelector((s) => s.swap);
}

export function useSwapActionHandlers() {
  const onRefresh = useCallback(() => {
    backgroundApiProxy.dispatch(refresh());
  }, []);
  const onSwitchTokens = useCallback(() => {
    backgroundApiProxy.dispatch(switchTokens());
    backgroundApiProxy.dispatch(setQuote(undefined));
  }, []);
  const onUserInput = useCallback(
    (independentField: 'INPUT' | 'OUTPUT', typedValue: string) => {
      backgroundApiProxy.dispatch(
        setTypedValue({ independentField, typedValue }),
      );
    },
    [],
  );
  const onSelectToken = useCallback(
    (token: Token, typedField: 'INPUT' | 'OUTPUT', network?: Network) => {
      if (typedField === 'INPUT') {
        backgroundApiProxy.dispatch(setInputToken({ token, network }));
      } else {
        backgroundApiProxy.dispatch(setOutputToken({ token, network }));
      }
    },
    [],
  );
  const onReset = useCallback(() => {
    backgroundApiProxy.dispatch(reset());
  }, []);
  const onSelectNetwork = useCallback((network: Network) => {
    backgroundApiProxy.dispatch(setActiveNetwork(network));
  }, []);
  return {
    onUserInput,
    onSelectToken,
    onSwitchTokens,
    onRefresh,
    onReset,
    onSelectNetwork,
  };
}

export function useTokenBalance(
  token?: Token,
  networkId?: string,
  accountId?: string,
): BigNumber | undefined {
  const balances = useAccountTokensBalance(networkId ?? '', accountId ?? '');
  useEffect(() => {
    if (
      token &&
      networkId &&
      accountId &&
      balances[token.tokenIdOnNetwork || 'main'] === undefined
    ) {
      backgroundApiProxy.serviceToken.fetchTokenBalance(networkId, accountId, [
        token.tokenIdOnNetwork,
      ]);
    }
  }, [token, balances, networkId, accountId]);
  const balance = balances[token?.tokenIdOnNetwork || 'main'];
  if (!token || !balance || !networkId || !accountId) {
    return;
  }
  return new TokenAmount(token, balance).toNumber();
}

export function useSwapQuoteRequestParams(): QuoteParams | undefined {
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
  } = useSwapState();

  return useMemo(() => {
    if (
      !inputToken ||
      !outputToken ||
      !typedValue ||
      !inputTokenNetwork ||
      !outputTokenNetwork ||
      new BigNumber(typedValue).lte(0)
    ) {
      return;
    }
    return {
      networkOut: outputTokenNetwork,
      networkIn: inputTokenNetwork,
      tokenOut: outputToken,
      tokenIn: inputToken,
      slippagePercentage: swapSlippagePercent,
      typedValue,
      independentField,
    };
  }, [
    inputToken,
    outputToken,
    inputTokenNetwork,
    outputTokenNetwork,
    typedValue,
    swapSlippagePercent,
    independentField,
  ]);
}

export const useSwapQuoteCallback = function (
  options: { silent: boolean } = { silent: true },
) {
  const { silent } = options;
  const requestParams = useSwapQuoteRequestParams();
  const params = useDebounce(requestParams, 500);
  const onSwapQuote = useCallback(async () => {
    if (!params) {
      backgroundApiProxy.dispatch(setQuote(undefined));
      return;
    }
    if (!silent) {
      backgroundApiProxy.dispatch(setLoading(true));
    }
    backgroundApiProxy.dispatch(setError(undefined));
    try {
      const data = await swapClient.getQuote(params);
      if (data) {
        backgroundApiProxy.dispatch(setQuote(data));
      } else {
        backgroundApiProxy.dispatch(setError(SwapError.NotSupport));
      }
    } catch (e) {
      console.warn('swap error', e);
      backgroundApiProxy.dispatch(setError(SwapError.QuoteFailed));
    } finally {
      if (!silent) {
        backgroundApiProxy.dispatch(setLoading(false));
      }
    }
  }, [params, silent]);
  return onSwapQuote;
};

export function useTokenAllowance(token?: Token, spender?: string) {
  const { accountId, networkId } = useActiveWalletAccount();
  const [allowance, setAllowance] = useState<BigNumber>();
  const onQuery = useCallback(async () => {
    if (accountId && networkId && token && token.tokenIdOnNetwork && spender) {
      const allowanceData = await backgroundApiProxy.engine.getTokenAllowance({
        spender,
        networkId,
        accountId,
        tokenIdOnNetwork: token?.tokenIdOnNetwork,
      });
      if (allowanceData !== undefined) {
        const number = new TokenAmount(token, allowanceData).toNumber();
        setAllowance(number);
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
  return allowance;
}

export function useApproveState(
  token?: Token,
  spender?: string,
  target?: string,
) {
  const allowance = useTokenAllowance(token, spender);
  const pendingApproval = useHasPendingApproval(
    token?.tokenIdOnNetwork,
    spender,
  );
  return useMemo(() => {
    if (!allowance || !target) {
      return ApprovalState.UNKNOWN;
    }
    if (allowance.gte(target)) {
      return ApprovalState.APPROVED;
    }
    if (pendingApproval) {
      return ApprovalState.PENDING;
    }
    return ApprovalState.NOT_APPROVED;
  }, [allowance, target, pendingApproval]);
}

export function useSwap() {
  const {
    independentField,
    typedValue,
    inputToken,
    inputTokenNetwork,
    outputToken,
    outputTokenNetwork,
    loading: isSwapLoading,
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
  const approveState = useApproveState(
    inputToken,
    swapQuote?.allowanceTarget,
    swapQuote?.sellAmount,
  );
  const balanceError =
    inputAmount && inputBalance && inputBalance.lt(inputAmount.toNumber())
      ? SwapError.InsufficientBalance
      : undefined;
  const error = swapError || balanceError;
  const dependentField = independentField === 'INPUT' ? 'OUTPUT' : 'INPUT';
  const formattedAmounts = {
    [independentField]: typedValue,
    [dependentField]:
      dependentField === 'INPUT'
        ? inputAmount?.value.toFixed(4) || ''
        : outputAmount?.value.toFixed(4) || '',
  } as { 'INPUT'?: string; 'OUTPUT'?: string };

  return {
    error,
    isSwapLoading,
    inputAmount,
    outputAmount,
    inputBalance,
    outputBalance,
    swapQuote,
    formattedAmounts,
    approveState,
  };
}

export function useDepositLimit() {
  const intl = useIntl();
  const { inputToken } = useSwapState();
  const { inputAmount, swapQuote } = useSwap();
  return useMemo(() => {
    let message = '';
    if (inputAmount && swapQuote && inputToken) {
      const { depositMax, depositMin } = swapQuote;
      if (depositMin) {
        const min = new TokenAmount(inputToken, depositMin);
        if (min.amount.gt(inputAmount.amount)) {
          message = intl.formatMessage(
            { id: 'msg__str_minimum_amount' },
            { '0': `${depositMin} ${inputToken.symbol}` },
          );
        }
      }
      if (depositMax) {
        const max = new TokenAmount(inputToken, depositMax);
        if (max.amount.lt(inputAmount.amount)) {
          message = intl.formatMessage(
            { id: 'msg__str_maximum_amount' },
            { '0': `${depositMax} ${inputToken.symbol}` },
          );
        }
      }
    }
    return { limited: !!message, message };
  }, [inputAmount, inputToken, swapQuote, intl]);
}
