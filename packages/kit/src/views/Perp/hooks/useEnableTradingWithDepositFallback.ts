import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IPerpsActiveAccountStatusAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { showHyperliquidTermsDialog } from '../components/HyperliquidTerms';

import { useShowDepositWithdrawModal } from './useShowDepositWithdrawModal';

export type IEnableTradingWithDepositFallbackResult = {
  shouldContinue: boolean;
  status: IPerpsActiveAccountStatusAtom | undefined;
};

const ENABLE_TRADING_FLOW_LOG_PREFIX = '[OK-55089][PerpsEnableTradingFlow]';

function maskLogValue(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }
  if (value.length <= 10) {
    return value;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function logOk55089EnableTradingFlow(payload: Record<string, unknown>) {
  if (platformEnv.isDev) {
    // eslint-disable-next-line no-console
    console.log(`${ENABLE_TRADING_FLOW_LOG_PREFIX} ${JSON.stringify(payload)}`);
  }
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
    logOk55089EnableTradingFlow({
      event: 'termsDialogRequested',
      ...logContext,
    });
    const didAcceptTerms = await showHyperliquidTermsDialog();
    if (!didAcceptTerms) {
      defaultLogger.perp.enableTradingFlow.track({
        event: 'termsNotAccepted',
        ...logContext,
      });
      logOk55089EnableTradingFlow({
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
      logOk55089EnableTradingFlow({
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
      logOk55089EnableTradingFlow({
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
        logOk55089EnableTradingFlow({
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
      logOk55089EnableTradingFlow({
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
      logOk55089EnableTradingFlow({
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
