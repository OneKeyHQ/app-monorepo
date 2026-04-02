import { useEffect, useState } from 'react';

import { YStack } from '@onekeyhq/components';
import type { IFilterState } from '@onekeyhq/kit/src/views/ReferFriends/components/FilterButton';

import { EmptyData } from '../EmptyData';
import { ERecordsTabValue, RecordsTabSwitcher } from '../RecordsTabSwitcher';
import { UndistributedRewardCard } from '../UndistributedRewardCard';

import { LoadingOverlay } from './components/LoadingOverlay';
import { RewardAccountList } from './components/RewardAccountList';
import { useEarnRewards } from './hooks/useEarnRewards';

export type { IVaultAmount } from './components/RewardAccountList';
export {
  RewardAccountList,
  EARN_VAULT_KEY_SEPARATOR,
  buildVaultKey,
} from './components/RewardAccountList';

interface IEarnRewardsTabProps {
  filterState: IFilterState;
}

export function EarnRewardsTab({ filterState }: IEarnRewardsTabProps) {
  const { lists, amountPending, vaultAmount, isLoading } =
    useEarnRewards(filterState);
  const [activeTab, setActiveTab] = useState<ERecordsTabValue>(
    ERecordsTabValue.available,
  );

  const hasAvailableData = (lists[0]?.length ?? 0) > 0;
  const hasTotalData = (lists[1]?.length ?? 0) > 0;
  const showTabSwitcher = hasAvailableData || hasTotalData;

  useEffect(() => {
    if (hasAvailableData) {
      setActiveTab(ERecordsTabValue.available);
    } else if (hasTotalData) {
      setActiveTab(ERecordsTabValue.total);
    }
  }, [hasAvailableData, hasTotalData]);

  const currentList =
    activeTab === ERecordsTabValue.available ? lists[0] || [] : lists[1] || [];
  const hasData = currentList.length > 0;

  return (
    <YStack gap="$5" py="$4" px="$5">
      <UndistributedRewardCard value={amountPending ?? 0} />

      <YStack gap="$4">
        {showTabSwitcher ? (
          <RecordsTabSwitcher value={activeTab} onChange={setActiveTab} />
        ) : null}

        {hasData ? (
          <RewardAccountList
            listData={currentList}
            vaultAmount={vaultAmount}
            showDeposited
          />
        ) : (
          <EmptyData />
        )}
      </YStack>

      <LoadingOverlay visible={isLoading} />
    </YStack>
  );
}
