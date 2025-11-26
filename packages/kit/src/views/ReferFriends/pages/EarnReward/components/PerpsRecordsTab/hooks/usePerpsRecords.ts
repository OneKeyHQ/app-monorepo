import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IFilterState } from '@onekeyhq/kit/src/views/ReferFriends/components/FilterButton';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPerpsRecordsResponse } from '@onekeyhq/shared/src/referralCode/type';

export function usePerpsRecords(filterState: IFilterState) {
  const intl = useIntl();
  const [recordsTotal, setRecordsTotal] = useState<
    IPerpsRecordsResponse | undefined
  >();
  const [recordsAvailable, setRecordsAvailable] = useState<
    IPerpsRecordsResponse | undefined
  >();
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);

  const fetchPerpsRecords = useCallback(
    async (options?: { silent?: boolean }) => {
      try {
        setIsLoading(true);
        const [availableRes, totalRes] = await Promise.allSettled([
          backgroundApiProxy.serviceReferralCode.getPerpsRecords(
            filterState.timeRange,
            filterState.inviteCode,
            'AVAILABLE',
          ),
          backgroundApiProxy.serviceReferralCode.getPerpsRecords(
            filterState.timeRange,
            filterState.inviteCode,
          ),
        ]);

        if (isMountedRef.current) {
          if (availableRes.status === 'fulfilled') {
            setRecordsAvailable(availableRes.value);
          }
          if (totalRes.status === 'fulfilled') {
            setRecordsTotal(totalRes.value);
          }
        }

        if (!options?.silent) {
          Toast.success({
            title: intl.formatMessage({ id: ETranslations.global_success }),
          });
        }
      } catch (error) {
        if (!options?.silent) {
          Toast.error({
            title:
              (error as Error)?.message ||
              intl.formatMessage({ id: ETranslations.global_failed }),
          });
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [filterState.inviteCode, filterState.timeRange, intl],
  );

  useEffect(() => {
    isMountedRef.current = true;
    void fetchPerpsRecords({ silent: true });
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchPerpsRecords]);

  const refresh = useCallback(() => fetchPerpsRecords(), [fetchPerpsRecords]);

  return {
    recordsAvailable,
    recordsTotal,
    isLoading,
    refresh,
  };
}
