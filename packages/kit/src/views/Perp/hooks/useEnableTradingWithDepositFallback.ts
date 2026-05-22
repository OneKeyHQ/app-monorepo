import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IPerpsActiveAccountStatusAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { showHyperliquidTermsDialog } from '../components/HyperliquidTerms';
import { getEnableTradingDialogConfirmDecision } from '../utils/enableTradingDialogConfirm';

import { useShowDepositWithdrawModal } from './useShowDepositWithdrawModal';

export type IEnableTradingWithDepositFallbackResult = {
  shouldContinue: boolean;
  status: IPerpsActiveAccountStatusAtom | undefined;
};

const ENABLE_TRADING_FLOW_LOG_PREFIX = '[OK-55089][PerpsEnableTradingFlow]';

type IEnableTradingFlowLogContext = {
  accountId: string | undefined;
  accountAddress: string | undefined;
};

type IEnableTradingAccountForLog = {
  accountId?: string | null;
  indexedAccountId?: string | null;
  accountAddress?: string | null;
};

export type IRequestEnableTradingWithDepositFallbackOptions = {
  beforeDeposit?: () => void;
  shouldIgnoreResult?: () => boolean;
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

function logOk55089EnableTradingFlow(payload: Record<string, unknown>) {
  if (platformEnv.isDev) {
    // eslint-disable-next-line no-console
    console.log(`${ENABLE_TRADING_FLOW_LOG_PREFIX} ${JSON.stringify(payload)}`);
  }
}

function getEnableTradingFlowLogContext(
  perpsAccount: IEnableTradingAccountForLog,
): IEnableTradingFlowLogContext {
  const accountId = perpsAccount.accountId ?? perpsAccount.indexedAccountId;
  return {
    accountId: maskLogValue(accountId),
    accountAddress: maskLogValue(perpsAccount.accountAddress),
  };
}

function trackEnableTradingFlow(
  event: Parameters<
    typeof defaultLogger.perp.enableTradingFlow.track
  >[0]['event'],
  logContext: IEnableTradingFlowLogContext,
  payload?: Record<string, unknown>,
) {
  defaultLogger.perp.enableTradingFlow.track({
    event,
    ...logContext,
    ...payload,
  });
  logOk55089EnableTradingFlow({
    event,
    ...logContext,
    ...payload,
  });
}

export function useConfirmHyperliquidTerms() {
  const [perpsAccount] = usePerpsActiveAccountAtom();

  return useCallback(async (): Promise<boolean> => {
    const logContext = getEnableTradingFlowLogContext(perpsAccount);

    trackEnableTradingFlow('termsDialogRequested', logContext);
    const didAcceptTerms = await showHyperliquidTermsDialog();
    if (!didAcceptTerms) {
      trackEnableTradingFlow('termsNotAccepted', logContext);
    }
    return didAcceptTerms;
  }, [perpsAccount]);
}

export function useRequestEnableTrading() {
  const [perpsAccount] = usePerpsActiveAccountAtom();

  return useCallback(async (): Promise<
    IPerpsActiveAccountStatusAtom | undefined
  > => {
    const logContext = getEnableTradingFlowLogContext(perpsAccount);

    try {
      trackEnableTradingFlow('requestStarted', logContext);
      const status =
        await backgroundApiProxy.serviceHyperliquid.enableTrading();
      trackEnableTradingFlow('responseReceived', logContext, {
        canTrade: status?.canTrade,
        activatedOk: status?.details?.activatedOk,
      });
      return status;
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
      return undefined;
    }
  }, [perpsAccount]);
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
      const logContext = getEnableTradingFlowLogContext(perpsAccount);

      if (options?.shouldIgnoreResult?.()) {
        trackEnableTradingFlow('resultIgnored', logContext, {
          canTrade: status?.canTrade,
          activatedOk: status?.details?.activatedOk,
        });
        return { shouldContinue: false, status };
      }

      const decision = getEnableTradingDialogConfirmDecision(status);
      if (decision === 'deposit' && perpsAccount.accountAddress && accountId) {
        trackEnableTradingFlow('depositRequired', logContext);
        options?.beforeDeposit?.();
        await showDepositWithdrawModal('deposit');
        return { shouldContinue: false, status };
      }

      const shouldContinue = decision === 'continue';
      trackEnableTradingFlow('flowCompleted', logContext, {
        shouldContinue,
      });
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

  return useCallback(async (): Promise<IEnableTradingWithDepositFallbackResult> => {
    const didAcceptTerms = await confirmHyperliquidTerms();
    if (!didAcceptTerms) {
      return { shouldContinue: false, status: undefined };
    }
    return requestEnableTradingWithDepositFallback();
  }, [confirmHyperliquidTerms, requestEnableTradingWithDepositFallback]);
}
