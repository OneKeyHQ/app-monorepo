import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IInviteCodeListResponse } from '@onekeyhq/shared/src/referralCode/type';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export function useInviteCodeList() {
  const {
    result: codeListData,
    isLoading,
    run,
  } = usePromiseResult(
    async () => {
      const data =
        await backgroundApiProxy.serviceReferralCode.getInviteCodeList();

      if (!data) {
        return data;
      }

      const sortedItems = [...(data.items ?? [])].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime() || 0;
        const bTime = new Date(b.createdAt).getTime() || 0;
        return aTime - bTime;
      });

      const sortedData: IInviteCodeListResponse = {
        ...data,
        items: sortedItems,
      };

      return sortedData;
    },
    [],
    {
      initResult: undefined,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 1 }), // Auto refresh every 1 minute
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
