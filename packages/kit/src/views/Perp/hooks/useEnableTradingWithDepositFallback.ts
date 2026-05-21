import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IPerpsActiveAccountStatusAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

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

export function useEnableTradingWithDepositFallback() {
  const [perpsAccount] = usePerpsActiveAccountAtom();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();

  return useCallback(async (): Promise<IEnableTradingWithDepositFallbackResult> => {
    const accountId = perpsAccount.accountId ?? perpsAccount.indexedAccountId;
    const logContext = {
      accountId: maskLogValue(accountId),
      accountAddress: maskLogValue(perpsAccount.accountAddress),
    };

    console.log(`${ENABLE_TRADING_FLOW_LOG_PREFIX} terms dialog requested`, {
      ...logContext,
    });
    const didAcceptTerms = await showHyperliquidTermsDialog();
    if (!didAcceptTerms) {
      console.log(`${ENABLE_TRADING_FLOW_LOG_PREFIX} terms not accepted`, {
        ...logContext,
      });
      return { shouldContinue: false, status: undefined };
    }

    try {
      console.log(
        `${ENABLE_TRADING_FLOW_LOG_PREFIX} enableTrading request started`,
        {
          ...logContext,
        },
      );
      const status =
        await backgroundApiProxy.serviceHyperliquid.enableTrading();
      console.log(
        `${ENABLE_TRADING_FLOW_LOG_PREFIX} enableTrading response received`,
        {
          ...logContext,
          canTrade: status?.canTrade,
          activatedOk: status?.details?.activatedOk,
        },
      );

      if (
        status?.details?.activatedOk === false &&
        perpsAccount.accountAddress &&
        accountId
      ) {
        console.log(
          `${ENABLE_TRADING_FLOW_LOG_PREFIX} account activation requires deposit`,
          {
            ...logContext,
          },
        );
        await showDepositWithdrawModal('deposit');
        return { shouldContinue: false, status };
      }

      const shouldContinue = Boolean(status?.canTrade);
      console.log(`${ENABLE_TRADING_FLOW_LOG_PREFIX} flow completed`, {
        ...logContext,
        shouldContinue,
      });
      return { shouldContinue, status };
    } catch (error) {
      console.error(
        '[useEnableTradingWithDepositFallback] Enable trading failed:',
        error,
      );
      return { shouldContinue: false, status: undefined };
    }
  }, [
    perpsAccount.accountAddress,
    perpsAccount.accountId,
    perpsAccount.indexedAccountId,
    showDepositWithdrawModal,
  ]);
}
