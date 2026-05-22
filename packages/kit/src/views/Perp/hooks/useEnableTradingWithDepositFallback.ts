import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IPerpsActiveAccountStatusAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { showHyperliquidTermsDialog } from '../components/HyperliquidTerms';

import { useShowDepositWithdrawModal } from './useShowDepositWithdrawModal';

export type IEnableTradingWithDepositFallbackResult = {
  shouldContinue: boolean;
  status: IPerpsActiveAccountStatusAtom | undefined;
};

function maskLogValue(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }
  if (value.length <= 10) {
    return value;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function useEnableTradingWithDepositFallback() {
  const [perpsAccount] = usePerpsActiveAccountAtom();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();

  return useCallback(async (): Promise<IEnableTradingWithDepositFallbackResult> => {
    const accountId = perpsAccount.accountId ?? perpsAccount.indexedAccountId;
    const logContext = {
      accountId: maskLogValue(accountId),
      accountAddress: maskLogValue(perpsAccount.accountAddress),
    };

    defaultLogger.perp.enableTradingFlow.track({
      event: 'termsDialogRequested',
      ...logContext,
    });
    const didAcceptTerms = await showHyperliquidTermsDialog();
    if (!didAcceptTerms) {
      defaultLogger.perp.enableTradingFlow.track({
        event: 'termsNotAccepted',
        ...logContext,
      });
      return { shouldContinue: false, status: undefined };
    }

    try {
      defaultLogger.perp.enableTradingFlow.track({
        event: 'requestStarted',
        ...logContext,
      });
      const status =
        await backgroundApiProxy.serviceHyperliquid.enableTrading();
      defaultLogger.perp.enableTradingFlow.track({
        event: 'responseReceived',
        ...logContext,
        canTrade: status?.canTrade,
        activatedOk: status?.details?.activatedOk,
      });

      if (
        status?.details?.activatedOk === false &&
        perpsAccount.accountAddress &&
        accountId
      ) {
        defaultLogger.perp.enableTradingFlow.track({
          event: 'depositRequired',
          ...logContext,
        });
        await showDepositWithdrawModal('deposit');
        return { shouldContinue: false, status };
      }

      const shouldContinue = Boolean(status?.canTrade);
      defaultLogger.perp.enableTradingFlow.track({
        event: 'flowCompleted',
        ...logContext,
        shouldContinue,
      });
      return { shouldContinue, status };
    } catch (error) {
      defaultLogger.perp.enableTradingFlow.error({
        event: 'flowFailed',
        ...logContext,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return { shouldContinue: false, status: undefined };
    }
  }, [
    perpsAccount.accountAddress,
    perpsAccount.accountId,
    perpsAccount.indexedAccountId,
    showDepositWithdrawModal,
  ]);
}
