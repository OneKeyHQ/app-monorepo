import { useCallback, useEffect, useMemo } from 'react';

import type { Account } from '@onekeyhq/engine/src/types/account';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector, usePrevious } from '../../../../hooks';
import { useRpcMeasureStatus } from '../../../ManageNetworks/hooks';
import { doQuote } from '../../doQuote';
import { useSwapQuoteRequestParams } from '../../hooks/useSwap';
import { SwapError } from '../../typings';
import { stringifyTokens } from '../../utils';

const AccountsObserver = () => {
  useEffect(() => {
    const fn = (account: Account) => {
      backgroundApiProxy.serviceSwap.handleAccountRemoved(account);
    };
    appUIEventBus.on(AppUIEventBusNames.RemoveAccount, fn);
    return function () {
      appUIEventBus.off(AppUIEventBusNames.RemoveAccount, fn);
    };
  }, []);
  const accounts = useAppSelector((s) => s.runtime.accounts);
  useEffect(() => {
    backgroundApiProxy.serviceSwap.refreshSendingAccount();
  }, [accounts]);
  return null;
};

const UserSelectedQuoterObserver = () => {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const tokensHash = useMemo(
    () => stringifyTokens(inputToken, outputToken),
    [inputToken, outputToken],
  );
  const prevTokensHash = usePrevious(tokensHash);
  useEffect(() => {
    if (tokensHash !== prevTokensHash) {
      backgroundApiProxy.serviceSwap.clearUserSelectedQuoter();
    }
  }, [tokensHash, prevTokensHash]);
  return null;
};

const NetworkStatusObserver = () => {
  const { status, loading } = useRpcMeasureStatus();
  const responseTime = status?.responseTime;
  const prevResponseTime = usePrevious(responseTime);
  useEffect(() => {
    if (prevResponseTime === undefined && status?.responseTime && !loading) {
      backgroundApiProxy.serviceSwap.getSwapError().then((error) => {
        if (error === SwapError.QuoteFailed) {
          appUIEventBus.emit(AppUIEventBusNames.SwapRefresh);
        }
      });
    }
  }, [status?.responseTime, prevResponseTime, responseTime, loading]);
  return null;
};

const PriceObserver = () => {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);

  useEffect(() => {
    if (inputToken) {
      backgroundApiProxy.servicePrice.getSimpleTokenPrice({
        networkId: inputToken.networkId,
        tokenId: inputToken.tokenIdOnNetwork,
      });
    }
  }, [inputToken]);

  useEffect(() => {
    if (outputToken) {
      backgroundApiProxy.servicePrice.getSimpleTokenPrice({
        networkId: outputToken.networkId,
        tokenId: outputToken.tokenIdOnNetwork,
      });
    }
  }, [outputToken]);

  return null;
};

const SwapQuoteResetObserver = () => {
  // When the following parameters change, the state needs to be cleared immediately.
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const typedValue = useAppSelector((s) => s.swap.typedValue);
  const independentField = useAppSelector((s) => s.swap.independentField);
  useEffect(() => {
    backgroundApiProxy.serviceSwap.setQuote(undefined);
  }, [inputToken, outputToken, typedValue, independentField]);
  return null;
};

const SwapParamsObserver = () => {
  const params = useSwapQuoteRequestParams();

  const onRefresh = useCallback(
    () => doQuote({ params, loading: true }),
    [params],
  );

  useEffect(() => {
    appUIEventBus.on(AppUIEventBusNames.SwapRefresh, onRefresh);
    return () => {
      appUIEventBus.off(AppUIEventBusNames.SwapRefresh, onRefresh);
    };
  }, [onRefresh]);

  useEffect(() => {
    doQuote({ params, loading: true });
  }, [params]);
  return null;
};

export const SwapObserver = () => (
  <>
    <AccountsObserver />
    <UserSelectedQuoterObserver />
    <NetworkStatusObserver />
    <PriceObserver />
    <SwapQuoteResetObserver />
    <SwapParamsObserver />
  </>
);
