import { useEffect, useMemo, useState } from 'react';

import { YStack } from '@onekeyhq/components';
import type { IFilterState } from '@onekeyhq/kit/src/views/ReferFriends/components/FilterButton';

import { EmptyData } from '../EmptyData';
import { ERecordsTabValue, RecordsTabSwitcher } from '../RecordsTabSwitcher';
import { UndistributedRewardCard } from '../UndistributedRewardCard';

import {
  type IRecordsAccordionSection,
  RecordsAccordionList,
} from './components/RecordsAccordionList';
import { usePerpsRecords } from './hooks/usePerpsRecords';

export function PerpsRecordsTab({
  filterState,
}: {
  filterState: IFilterState;
}) {
  const { recordsAvailable, recordsTotal } = usePerpsRecords(filterState);
  const [activeTab, setActiveTab] = useState<ERecordsTabValue>(
    ERecordsTabValue.available,
  );

  const hasAvailableData = (recordsAvailable?.items?.length ?? 0) > 0;
  const hasTotalData = (recordsTotal?.items?.length ?? 0) > 0;
  const showTabSwitcher = hasAvailableData || hasTotalData;

  useEffect(() => {
    if (hasAvailableData) {
      setActiveTab(ERecordsTabValue.available);
    } else if (hasTotalData) {
      setActiveTab(ERecordsTabValue.total);
    }
  }, [hasAvailableData, hasTotalData]);

  const currentRecords =
    activeTab === ERecordsTabValue.available ? recordsAvailable : recordsTotal;

  const undistributedValue = recordsAvailable?.fiatValue ?? 0;

  const { listData, hasData } = useMemo(() => {
    const mapped: IRecordsAccordionSection[] =
      currentRecords?.items?.map((record, recordIndex) => ({
        key: `${record.accountAddress}-${recordIndex}`,
        accountAddress: record.accountAddress,
        fiatValue: record.fiatValue || '0',
        items: record.items.map((detail, detailIndex) => ({
          key: `${record.accountAddress}-${detail.token.address}-${detailIndex}`,
          token: detail.token,
          amount: detail.amount,
          fiatValue: detail.amountFiatValue,
          tradingVolume: detail.tradingVolume,
          tradingVolumeFiatValue: detail.tradingVolumeFiatValue,
        })),
      })) ?? [];
    return { listData: mapped, hasData: mapped.length > 0 };
  }, [currentRecords]);

  return (
    <YStack gap="$5" py="$4" px="$5">
      <UndistributedRewardCard value={undistributedValue} />

      <YStack gap="$4">
        {showTabSwitcher ? (
          <RecordsTabSwitcher value={activeTab} onChange={setActiveTab} />
        ) : null}

        {hasData ? <RecordsAccordionList sections={listData} /> : <EmptyData />}
      </YStack>
    </YStack>
  );
}
