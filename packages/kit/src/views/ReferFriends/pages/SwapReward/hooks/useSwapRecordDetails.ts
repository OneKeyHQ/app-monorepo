import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  ISwapRecordsParams,
  ISwapRecordsResponse,
} from '@onekeyhq/shared/src/referralCode/type';

import { getSwapQuerySignature } from '../utils';

import type { ISwapRecordQuery } from '../types';

interface IUseSwapRecordDetailsParams {
  enabled: boolean;
  inviteeId: string;
  query: ISwapRecordQuery;
  status: ISwapRecordsParams['status'];
}

interface ISwapRecordDetailsState {
  requestKey: string;
  isLoading: boolean;
  hasError: boolean;
  records?: ISwapRecordsResponse;
}

export function useSwapRecordDetails({
  enabled,
  inviteeId,
  query,
  status,
}: IUseSwapRecordDetailsParams) {
  const [state, setState] = useState<ISwapRecordDetailsState>();
  const requestIdRef = useRef(0);

  const requestKey = useMemo(
    () =>
      getSwapQuerySignature({
        inviteeId,
        ...query,
        status,
      }),
    [inviteeId, query, status],
  );

  const fetchRecords = useCallback(async () => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setState({
      requestKey,
      isLoading: true,
      hasError: false,
    });

    try {
      const response =
        await backgroundApiProxy.serviceReferralCode.getSwapRecords({
          ...query,
          disableAutoToast: true,
          inviteeId,
          status,
        });

      if (requestIdRef.current !== requestId) {
        return;
      }
      setState({
        requestKey,
        isLoading: false,
        hasError: false,
        records: response,
      });
    } catch {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setState({
        requestKey,
        isLoading: false,
        hasError: true,
      });
    }
  }, [inviteeId, query, requestKey, status]);

  useEffect(() => {
    if (enabled && state?.requestKey !== requestKey) {
      void fetchRecords();
    }
  }, [enabled, fetchRecords, requestKey, state?.requestKey]);

  const retry = useCallback(() => {
    void fetchRecords();
  }, [fetchRecords]);

  const hasCurrentState = state?.requestKey === requestKey;

  return {
    hasError: hasCurrentState ? state.hasError : false,
    isLoading: enabled && (!hasCurrentState || state.isLoading),
    records: hasCurrentState ? state.records : undefined,
    retry,
  };
}
