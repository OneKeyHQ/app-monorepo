import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IInvitePaidHistory } from '@onekeyhq/shared/src/referralCode/type';

import { InviteWithdrawAddressRowWithSummary } from '../components/InviteWithdrawAddressRow';

export type IPayoutHistoryData = {
  items: IInvitePaidHistory['items'] | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  listHeader: ReactElement | null;
  // False shows the page skeleton instead of mounting the list.
  isListReady: boolean;
  // Spread onto the list; typed loosely because the web ListView is a
  // FlatList whose props differ from FlashList's.
  listScrollProps: Record<string, unknown>;
};

const listHeader = <InviteWithdrawAddressRowWithSummary />;
const listScrollProps: Record<string, unknown> = {};

// Web, desktop and extension render a FlatList, which is unaffected by the
// native first-open issue (see the .native file), so the list mounts at once
// and the address row loads on its own.
export function usePayoutHistoryData(): IPayoutHistoryData {
  const originalData = useRef<IInvitePaidHistory['items']>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<IInvitePaidHistory['items']>();

  const onRefresh = useCallback(() => {
    setIsLoading(true);
    void Promise.allSettled([
      backgroundApiProxy.serviceReferralCode.getInvitePaidList(),
    ]).then(([list]) => {
      if (list.status === 'fulfilled') {
        setItems(list.value.items);
        originalData.current.push(...list.value.items);
      }

      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  return {
    items,
    isLoading,
    onRefresh,
    listHeader,
    isListReady: true,
    listScrollProps,
  };
}
