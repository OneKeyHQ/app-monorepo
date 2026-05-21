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

export function useEnableTradingWithDepositFallback() {
  const [perpsAccount] = usePerpsActiveAccountAtom();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();

  return useCallback(async (): Promise<IEnableTradingWithDepositFallbackResult> => {
    const accountId = perpsAccount.accountId ?? perpsAccount.indexedAccountId;
    const didAcceptTerms = await showHyperliquidTermsDialog();
    if (!didAcceptTerms) {
      return { shouldContinue: false, status: undefined };
    }

    try {
      const status =
        await backgroundApiProxy.serviceHyperliquid.enableTrading();

      if (
        status?.details?.activatedOk === false &&
        perpsAccount.accountAddress &&
        accountId
      ) {
        await showDepositWithdrawModal('deposit');
        return { shouldContinue: false, status };
      }

      return { shouldContinue: Boolean(status?.canTrade), status };
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
