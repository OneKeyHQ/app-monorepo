import { useCallback } from 'react';

import { usePerpsActiveAccountStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { showEnableTradingDialog } from '../components/TradingPanel/modals/EnableTradingModal';

export interface IUseTradingGuardReturn {
  ensureTradingEnabled: () => void;
  isAgentReady: boolean;
  showEnableTradingModal: () => void;
}

export function useTradingGuard(): IUseTradingGuardReturn {
  const [accountStatus] = usePerpsActiveAccountStatusAtom();

  const isAgentReady = Boolean(
    accountStatus?.details?.agentOk && accountStatus?.canTrade,
  );

  const showEnableTradingModal = useCallback(() => {
    showEnableTradingDialog();
  }, []);

  const ensureTradingEnabled = useCallback(() => {
    if (!isAgentReady) {
      showEnableTradingDialog();
      throw new OneKeyLocalError('Trading not enabled');
    }
  }, [isAgentReady]);

  return {
    ensureTradingEnabled,
    isAgentReady,
    showEnableTradingModal,
  };
}
