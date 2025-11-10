import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

export function useInviteCodeList() {
  const {
    result: codeListData,
    isLoading,
    run,
  } = usePromiseResult(
    async () => {
      const data =
        await backgroundApiProxy.serviceReferralCode.getInviteCodeList();
      return data;
    },
    [],

    {
      initResult: undefined,
      watchLoading: true,
    },
  );

  const refetch = useCallback(() => {
    void run();
  }, [run]);

  return {
    codeListData,
    isLoading,
    refetch,
  };
}
