import { useCallback, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IPerpsActiveAccountStatusAtom,
  perpsActiveAccountStatusAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';

import { showHyperliquidTermsDialog } from '../components/HyperliquidTerms';
import { getPerpsAccountKey } from '../utils/accountScopedData';
import { getEnableTradingDialogConfirmDecision } from '../utils/enableTradingDialogConfirm';

import { useShowDepositWithdrawModal } from './useShowDepositWithdrawModal';

export type IEnableTradingWithDepositFallbackResult = {
  shouldContinue: boolean;
  status: IPerpsActiveAccountStatusAtom | undefined;
};

export type IRequestEnableTradingWithDepositFallbackOptions = {
  beforeDeposit?: () => void;
  shouldIgnoreResult?: () => boolean;
};

type IAccountScopedInFlightRequest<TResult> = {
  accountKey: string | undefined;
  promise: Promise<TResult>;
  token: symbol;
};

function usePerpsAccountScopedInFlightRequest<TResult>() {
  const [perpsAccount] = usePerpsActiveAccountAtom();
  const accountKey = getPerpsAccountKey(perpsAccount);
  const latestAccountKeyRef = useRef(accountKey);
  latestAccountKeyRef.current = accountKey;
  const requestInFlightRef = useRef<
    IAccountScopedInFlightRequest<TResult> | undefined
  >(undefined);

  return useCallback(
    (
      request: (isRequestCurrent: () => boolean) => Promise<TResult>,
    ): Promise<TResult> => {
      if (requestInFlightRef.current?.accountKey !== accountKey) {
        requestInFlightRef.current = undefined;
      }
      if (requestInFlightRef.current) {
        return requestInFlightRef.current.promise;
      }

      const requestToken = Symbol('perpsAccountScopedRequest');
      const requestAccountKey = accountKey;
      const requestPromise = request(
        () => latestAccountKeyRef.current === requestAccountKey,
      ).finally(() => {
        if (requestInFlightRef.current?.token === requestToken) {
          requestInFlightRef.current = undefined;
        }
      });
      requestInFlightRef.current = {
        accountKey,
        promise: requestPromise,
        token: requestToken,
      };
      return requestPromise;
    },
    [accountKey],
  );
}

export function useConfirmHyperliquidTerms() {
  return useCallback(async (): Promise<boolean> => {
    return showHyperliquidTermsDialog();
  }, []);
}

export function useRequestEnableTrading() {
  return useCallback(async (): Promise<
    IPerpsActiveAccountStatusAtom | undefined
  > => {
    try {
      return await errorToastUtils.withErrorAutoToast(() =>
        backgroundApiProxy.serviceHyperliquid.enableTrading(),
      );
    } catch {
      return undefined;
    }
  }, []);
}

export function useHandleEnableTradingPostStatus() {
  const [perpsAccount] = usePerpsActiveAccountAtom();
  const { showDepositWithdrawModal } =
    useShowDepositWithdrawModal('enableTrading');

  return useCallback(
    async (
      status: IPerpsActiveAccountStatusAtom | undefined,
      options?: IRequestEnableTradingWithDepositFallbackOptions,
    ): Promise<IEnableTradingWithDepositFallbackResult> => {
      const accountId = perpsAccount.accountId ?? perpsAccount.indexedAccountId;

      if (options?.shouldIgnoreResult?.()) {
        return { shouldContinue: false, status };
      }

      const decision = getEnableTradingDialogConfirmDecision(status);
      if (decision === 'deposit' && perpsAccount.accountAddress && accountId) {
        options?.beforeDeposit?.();
        await showDepositWithdrawModal('deposit');
        return { shouldContinue: false, status };
      }

      const shouldContinue = decision === 'continue';
      return { shouldContinue, status };
    },
    [perpsAccount, showDepositWithdrawModal],
  );
}

export function useRequestEnableTradingWithDepositFallback() {
  const requestEnableTrading = useRequestEnableTrading();
  const handleEnableTradingPostStatus = useHandleEnableTradingPostStatus();
  const runAccountScopedRequest =
    usePerpsAccountScopedInFlightRequest<IEnableTradingWithDepositFallbackResult>();

  return useCallback(
    (
      options?: IRequestEnableTradingWithDepositFallbackOptions,
    ): Promise<IEnableTradingWithDepositFallbackResult> => {
      if (options?.shouldIgnoreResult?.()) {
        return Promise.resolve({ shouldContinue: false, status: undefined });
      }
      return runAccountScopedRequest(async (isRequestCurrent) => {
        const status = await requestEnableTrading();
        if (!isRequestCurrent() || options?.shouldIgnoreResult?.()) {
          return { shouldContinue: false, status };
        }
        return handleEnableTradingPostStatus(status, options);
      });
    },
    [
      handleEnableTradingPostStatus,
      requestEnableTrading,
      runAccountScopedRequest,
    ],
  );
}

export function useEnableTradingWithDepositFallback() {
  const confirmHyperliquidTerms = useConfirmHyperliquidTerms();
  const requestEnableTradingWithDepositFallback =
    useRequestEnableTradingWithDepositFallback();

  return useCallback(
    async (
      options?: IRequestEnableTradingWithDepositFallbackOptions,
    ): Promise<IEnableTradingWithDepositFallbackResult> => {
      const didAcceptTerms = await confirmHyperliquidTerms();
      if (!didAcceptTerms || options?.shouldIgnoreResult?.()) {
        return { shouldContinue: false, status: undefined };
      }
      return requestEnableTradingWithDepositFallback(options);
    },
    [confirmHyperliquidTerms, requestEnableTradingWithDepositFallback],
  );
}

export function useFirstDepositAction() {
  const handleEnableTradingPostStatus = useHandleEnableTradingPostStatus();
  const enableTradingWithDepositFallback =
    useEnableTradingWithDepositFallback();
  const runAccountScopedRequest =
    usePerpsAccountScopedInFlightRequest<IEnableTradingWithDepositFallbackResult>();

  return useCallback(
    (
      options?: IRequestEnableTradingWithDepositFallbackOptions,
    ): Promise<IEnableTradingWithDepositFallbackResult> => {
      if (options?.shouldIgnoreResult?.()) {
        return Promise.resolve({ shouldContinue: false, status: undefined });
      }

      return runAccountScopedRequest(async (isRequestCurrent) => {
        let status: IPerpsActiveAccountStatusAtom | undefined;
        try {
          await errorToastUtils.withErrorAutoToast(() =>
            backgroundApiProxy.serviceHyperliquid.checkPerpsAccountStatus(),
          );
          status = await perpsActiveAccountStatusAtom.get();
        } catch {
          return { shouldContinue: false, status: undefined };
        }

        if (!isRequestCurrent() || options?.shouldIgnoreResult?.()) {
          return { shouldContinue: false, status };
        }
        if (getEnableTradingDialogConfirmDecision(status) !== 'stop') {
          return handleEnableTradingPostStatus(status, options);
        }
        return enableTradingWithDepositFallback(options);
      });
    },
    [
      enableTradingWithDepositFallback,
      handleEnableTradingPostStatus,
      runAccountScopedRequest,
    ],
  );
}
