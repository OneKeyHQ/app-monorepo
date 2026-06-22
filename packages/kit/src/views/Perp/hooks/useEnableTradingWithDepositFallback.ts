import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IPerpsActiveAccountStatusAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';

import { showHyperliquidTermsDialog } from '../components/HyperliquidTerms';
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
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();

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

  return useCallback(
    async (
      options?: IRequestEnableTradingWithDepositFallbackOptions,
    ): Promise<IEnableTradingWithDepositFallbackResult> => {
      if (options?.shouldIgnoreResult?.()) {
        return { shouldContinue: false, status: undefined };
      }
      const status = await requestEnableTrading();
      return handleEnableTradingPostStatus(status, options);
    },
    [handleEnableTradingPostStatus, requestEnableTrading],
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
