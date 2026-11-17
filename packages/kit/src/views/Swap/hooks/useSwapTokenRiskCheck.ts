import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { isSwapTokenRisky } from '../utils/swapTokenRiskUtils';

export function useSwapTokenRiskCheck() {
  const [settingsPersist] = useSettingsPersistAtom();
  return useCallback(
    async (token: ISwapToken) => {
      if (!isSwapTokenRisky(token) || !settingsPersist.tokenRiskReminder) {
        return false;
      }
      const isConfirmed =
        await backgroundApiProxy.serviceSetting.checkConfirmedRiskToken(
          `${token.networkId}_${token.contractAddress}`,
        );
      return !isConfirmed;
    },
    [settingsPersist.tokenRiskReminder],
  );
}
