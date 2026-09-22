import { useIntl } from 'react-intl';

import {
  Empty,
  SegmentControl,
  Spinner,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnPortfolioInvestment,
  IEarnRewardsPortfolioResponse,
  IEarnRewardsPortfolioStage,
} from '@onekeyhq/shared/types/staking';

import { RewardsClaimableList } from './RewardsClaimableList';
import { RewardsLedgerList } from './RewardsLedgerList';

export const REWARDS_STAGES: IEarnRewardsPortfolioStage[] = [
  'claimable',
  'pending',
  'distributed',
];

export function RewardsTab({
  stage,
  onStageChange,
  rewards,
  isLoading,
  isLoadingMore = false,
  investments,
  onManage,
}: {
  stage: IEarnRewardsPortfolioStage;
  onStageChange: (stage: IEarnRewardsPortfolioStage) => void;
  rewards: IEarnRewardsPortfolioResponse | undefined;
  isLoading: boolean;
  /** a further ledger page is on its way; shown as a footer spinner */
  isLoadingMore?: boolean;
  investments: IEarnPortfolioInvestment[];
  onManage: (investment: IEarnPortfolioInvestment) => void;
}) {
  const intl = useIntl();
  const labels: Record<IEarnRewardsPortfolioStage, string> = {
    claimable: intl.formatMessage({ id: ETranslations.earn_claimable }),
    pending: intl.formatMessage({ id: ETranslations.global_pending }),
    // "Distributed": referral shares the exact status word; a dedicated earn
    // key is on the OK-61377 i18n list.
    distributed: intl.formatMessage({ id: ETranslations.referral_distributed }),
  };
  const groups = rewards?.stage === stage ? rewards.groups : [];

  let content: React.ReactNode;
  if (stage === 'claimable') {
    content = (
      <RewardsClaimableList
        investments={investments}
        ledgerGroups={groups}
        onManage={onManage}
      />
    );
  } else if (isLoading && !rewards) {
    content = (
      <Stack ai="center" py="$8">
        <Spinner size="large" />
      </Stack>
    );
  } else if (groups.length === 0) {
    content = (
      <Empty
        icon="GiftOutline"
        title={intl.formatMessage({
          id: ETranslations.earn_no_assets_deposited,
        })}
      />
    );
  } else {
    content = <RewardsLedgerList groups={groups} />;
  }

  return (
    <YStack gap="$2">
      <Stack px="$5" py="$2">
        <SegmentControl
          value={stage}
          options={REWARDS_STAGES.map((key) => ({
            value: key,
            label: labels[key],
          }))}
          onChange={(value) =>
            onStageChange(value as IEarnRewardsPortfolioStage)
          }
        />
      </Stack>
      {content}
      {isLoadingMore ? (
        <Stack ai="center" py="$4">
          <Spinner size="small" />
        </Stack>
      ) : null}
    </YStack>
  );
}
