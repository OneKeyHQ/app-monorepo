import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useAccountTokensBalance,
  useActiveWalletAccount,
  useAppSelector,
  useDebounce,
} from '../../../hooks';
import { setError, setLoading, setQuote } from '../../../store/reducers/swap';
import { Token } from '../../../store/typings';
import { enabledChainIds } from '../config';
import { SwapQuoter } from '../quoter';
import { ApprovalState, FetchQuoteParams, SwapError } from '../typings';
import {
  getChainIdFromNetwork,
  greaterThanZeroOrUndefined,
  nativeTokenAddress,
} from '../utils';

import { useHasPendingApproval } from './useTransactions';

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

export function useSwapEnabled() {
  const { network } = useActiveWalletAccount();
  const chainId = getChainIdFromNetwork(network ?? undefined);
  return network?.impl === 'evm' && enabledChainIds.includes(chainId);
}

export function useSwapState() {
  return useAppSelector((s) => s.swap);
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
      backgroundApiProxy.serviceToken.fetchTokenBalance({
        activeAccountId: accountId,
        activeNetworkId: networkId,
        tokenIds: [token.tokenIdOnNetwork],
      });
    }
  }, [token, balances, networkId, accountId]);
  const balance = balances[token?.tokenIdOnNetwork || 'main'];
  return useMemo(() => {
    if (!token || !balance || !networkId || !accountId) {
      return;
    }
    return new TokenAmount(token, balance).toNumber();
  }, [token, networkId, accountId, balance]);
}

export function useReceivingAddress() {
  const { account } = useActiveWalletAccount();
  const {
    inputTokenNetwork,
    outputTokenNetwork,
    receivingAddress,
    receivingName,
  } = useSwapState();
  return useMemo(() => {
    let address: string | undefined;
    let name: string | undefined;
    if (outputTokenNetwork?.id !== inputTokenNetwork?.id) {
      if (receivingAddress) {
        address = receivingAddress;
        name = receivingName;
      } else {
        address = account?.address;
        name = account?.name;
      }
    }
    return { address, name };
  }, [
    receivingAddress,
    receivingName,
    account,
    inputTokenNetwork,
    outputTokenNetwork,
  ]);
}

export function useSwapQuoteRequestParams(): FetchQuoteParams | undefined {
  const swapSlippagePercent = useAppSelector(
    (s) => s.settings.swapSlippagePercent,
  );
  const { account, network } = useActiveWalletAccount();
  const { address } = useReceivingAddress();
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
      !network ||
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
      activeAccount: account,
      activeNetwok: network,
      receivingAddress: address,
    };
  }, [
    inputToken,
    outputToken,
    inputTokenNetwork,
    outputTokenNetwork,
    typedValue,
    swapSlippagePercent,
    independentField,
    account,
    network,
    address,
  ]);
}

export const useSwapQuoteCallback = function (
  options: { showLoading: boolean } = { showLoading: false },
) {
  const { showLoading } = options;
  const requestParams = useSwapQuoteRequestParams();
  const { accountId, networkId } = useActiveWalletAccount();
  const params = useDebounce(requestParams, 500);
  const refs = useRef({ accountId, networkId, params, count: 0 });

  useEffect(() => {
    refs.current.accountId = accountId;
    refs.current.networkId = networkId;
    refs.current.params = params;
  }, [accountId, networkId, params]);

  const onSwapQuote = useCallback(async () => {
    if (!params) {
      backgroundApiProxy.dispatch(setQuote(undefined));
      return;
    }
    if (showLoading) {
      backgroundApiProxy.dispatch(setLoading(true));
    }
    backgroundApiProxy.dispatch(setError(undefined));
    try {
      refs.current.accountId = accountId;
      refs.current.networkId = networkId;
      refs.current.params = params;
      refs.current.count += 1;
      const data = await SwapQuoter.client.fetchQuote(params);
      if (
        refs.current.accountId === accountId &&
        refs.current.networkId === networkId &&
        refs.current.params === params
      ) {
        backgroundApiProxy.dispatch(setLoading(false));
        if (data) {
          backgroundApiProxy.dispatch(setQuote(data));
        } else {
          backgroundApiProxy.dispatch(setError(SwapError.NotSupport));
        }
      }
    } catch (e) {
      backgroundApiProxy.dispatch(setError(SwapError.QuoteFailed));
      backgroundApiProxy.dispatch(setLoading(false));
    } finally {
      refs.current.count -= 1;
      if (refs.current.count === 0) {
        backgroundApiProxy.dispatch(setLoading(false));
      }
    }
  }, [params, showLoading, accountId, networkId]);
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

export function useApproveState(
  token?: Token,
  spender?: string,
  target?: string,
) {
  const { networkId, accountId } = useActiveWalletAccount();
  const allowance = useTokenAllowance(token, spender);
  const pendingApproval = useHasPendingApproval(
    accountId,
    networkId,
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
  const approveState = useApproveState(
    inputToken,
    swapQuote?.allowanceTarget,
    swapQuote?.sellAmount,
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
    approveState,
  };
}

export function useInputLimitsError(): Error | undefined {
  const intl = useIntl();
  const { inputToken, quote } = useSwapState();
  const { inputAmount } = useDerivedSwapState();
  return useMemo(() => {
    let message: string | undefined;
    if (inputAmount && quote && inputToken) {
      const { max, min } = quote?.limited ?? {};
      if (min) {
        const tokenAmount = new TokenAmount(inputToken, min);
        if (tokenAmount.amount.gt(inputAmount.amount)) {
          message = intl.formatMessage(
            { id: 'msg__str_minimum_amount' },
            { '0': `${min} ${inputToken.symbol}` },
          );
        }
      }
      if (max) {
        const tokenAmount = new TokenAmount(inputToken, max);
        if (tokenAmount.amount.lt(inputAmount.amount)) {
          message = intl.formatMessage(
            { id: 'msg__str_maximum_amount' },
            { '0': `${max} ${inputToken.symbol}` },
          );
        }
      }
    }
    return message ? new Error(message) : undefined;
  }, [inputAmount, inputToken, quote, intl]);
}

export function useSwftcTokens(
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
