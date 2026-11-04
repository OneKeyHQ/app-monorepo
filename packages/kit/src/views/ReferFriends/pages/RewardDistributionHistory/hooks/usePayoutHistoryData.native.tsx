import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IInvitePaidHistory,
  IInviteSummary,
} from '@onekeyhq/shared/src/referralCode/type';

import { InviteWithdrawAddressRow } from '../components/InviteWithdrawAddressRow';

import type { IPayoutHistoryData } from './usePayoutHistoryData';

// FlashList v2 enables maintainVisibleContentPosition by default. Pull to
// refresh replaces every section, and mVCP would re-anchor the offset against
// the automatic modal inset.
const listScrollProps: Record<string, unknown> = {
  maintainVisibleContentPosition: {
    disabled: true,
  },
};

// The list and the address settle in one commit and the list mounts once with
// its final header and rows. Mounting it empty and growing it under the
// automatic modal inset pushed the address row under the header and froze the
// list on the first open (OK-64624).
export function usePayoutHistoryData(): IPayoutHistoryData {
  const originalData = useRef<IInvitePaidHistory['items']>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<IInvitePaidHistory['items']>();
  const [summaryInfo, setSummaryInfo] = useState<IInviteSummary>();

  // Fetched again after the address is edited; a failure keeps it as is.
  const fetchSummaryInfo = useCallback(async () => {
    try {
      setSummaryInfo(
        await backgroundApiProxy.serviceReferralCode.getSummaryInfo(),
      );
    } catch {
      // ignore
    }
  }, []);

  const onRefresh = useCallback(() => {
    setIsLoading(true);
    void Promise.allSettled([
      backgroundApiProxy.serviceReferralCode.getInvitePaidList(),
      backgroundApiProxy.serviceReferralCode.getSummaryInfo(),
    ]).then(([list, summary]) => {
      if (list.status === 'fulfilled') {
        setItems(list.value.items);
        originalData.current.push(...list.value.items);
      } else {
        // Leave the skeleton for the empty state if the first load fails.
        setItems((prev) => prev ?? []);
      }
      // A failed summary only drops the address row.
      if (summary.status === 'fulfilled') {
        setSummaryInfo(summary.value);
      }

      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  const listHeader = useMemo(
    () =>
      summaryInfo ? (
        <InviteWithdrawAddressRow
          summaryInfo={summaryInfo}
          fetchSummaryInfo={fetchSummaryInfo}
        />
      ) : null,
    [fetchSummaryInfo, summaryInfo],
  );

  return {
    items,
    isLoading,
    onRefresh,
    listHeader,
    isListReady: items !== undefined,
    listScrollProps,
  };
}
