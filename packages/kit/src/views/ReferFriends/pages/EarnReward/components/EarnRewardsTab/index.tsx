import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { ScrollView, Stack, YStack } from '@onekeyhq/components';
import type { IFilterState } from '@onekeyhq/kit/src/views/ReferFriends/components/FilterButton';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
  const intl = useIntl();
  const { lists, amountPending, vaultAmount, isLoading } =
    useEarnRewards(filterState);
  const [activeTab, setActiveTab] = useState<ERecordsTabValue>(
    ERecordsTabValue.available,
  );

  const hasAvailableData = (lists[0]?.length ?? 0) > 0;
  const hasTotalData = (lists[1]?.length ?? 0) > 0;

  useEffect(() => {
    if (
      activeTab === ERecordsTabValue.available &&
      !hasAvailableData &&
      hasTotalData
    ) {
      setActiveTab(ERecordsTabValue.total);
    } else if (
      activeTab === ERecordsTabValue.total &&
      !hasTotalData &&
      hasAvailableData
    ) {
      setActiveTab(ERecordsTabValue.available);
    }
  }, [activeTab, hasAvailableData, hasTotalData]);

  const currentList =
    activeTab === ERecordsTabValue.available ? lists[0] || [] : lists[1] || [];

  const undistributedCard = (
    <UndistributedRewardCard value={amountPending ?? 0} mx="$5" mb="$4" />
  );

  if ((lists[0]?.length || 0) + (lists[1]?.length || 0) === 0) {
    return (
      <Stack>
        {undistributedCard}
        <YStack px="$5">
          <EmptyData />
        </YStack>
        <LoadingOverlay visible={isLoading} />
      </Stack>
    );
  }

  return (
    <Stack>
      {undistributedCard}
      <RecordsTabSwitcher value={activeTab} onChange={setActiveTab} />
      <ScrollView style={{ paddingBottom: 40 }}>
        <RewardAccountList
          listData={currentList}
          vaultAmount={vaultAmount}
          showDeposited
          headerTitle={
            activeTab === ERecordsTabValue.available
              ? intl.formatMessage({
                  id: ETranslations.referral_reward_undistributed,
                })
              : intl.formatMessage({
                  id: ETranslations.referral_referred_total,
                })
          }
        />
      </ScrollView>
      <LoadingOverlay visible={isLoading} />
    </Stack>
  );
}
