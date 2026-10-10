import { useIntl } from 'react-intl';

import {
  Empty,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnPortfolioPosition } from '@onekeyhq/shared/types/earn/portfolioPositions';
import type {
  IEarnRewardsPortfolioResponse,
  IEarnRewardsPortfolioStage,
} from '@onekeyhq/shared/types/staking';

import { useGroupExpansion } from './GroupRow';
import { RewardsClaimableList } from './RewardsClaimableList';
import { RewardsLedgerList } from './RewardsLedgerList';

import type { IEarnPositionCardHandlers } from './EarnPositionCard';
import type { IEarnProtocolView } from './earnPositionModel';

export const REWARDS_STAGES: IEarnRewardsPortfolioStage[] = [
  'claimable',
  'pending',
  'distributed',
];

const EMPTY_TITLE_BY_STAGE: Record<IEarnRewardsPortfolioStage, ETranslations> =
  {
    claimable: ETranslations.earn_portfolio_claimable_rewards_empty__title,
    pending: ETranslations.earn_portfolio_pending_rewards_empty__title,
    distributed: ETranslations.earn_portfolio_distributed_rewards_empty__title,
  };

/** The stage chips (figma 29180-109152): the chosen one on a soft pill. */
function StagePills({
  value,
  labels,
  onChange,
}: {
  value: IEarnRewardsPortfolioStage;
  labels: Record<IEarnRewardsPortfolioStage, string>;
  onChange: (stage: IEarnRewardsPortfolioStage) => void;
}) {
  return (
    <XStack px="$5" pt="$3" gap="$1" testID="earn-my-portfolio-stages">
      {REWARDS_STAGES.map((stage) => {
        const selected = stage === value;
        return (
          <Stack
            key={stage}
            px="$3"
            py="$1.5"
            borderRadius="$full"
            bg={selected ? '$bgStrong' : 'transparent'}
            cursor="pointer"
            userSelect="none"
            onPress={() => onChange(stage)}
            testID={`earn-my-portfolio-stage-${stage}`}
          >
            <SizableText
              size="$bodyMdMedium"
              color={selected ? '$text' : '$textSubdued'}
              numberOfLines={1}
            >
              {labels[stage]}
            </SizableText>
          </Stack>
        );
      })}
    </XStack>
  );
}

export function RewardsTab({
  stage,
  onStageChange,
  rewards,
  isLoading,
  isLoadingMore = false,
  claimableProtocols,
  positions,
  networkFilter,
  onManage,
}: {
  stage: IEarnRewardsPortfolioStage;
  onStageChange: (stage: IEarnRewardsPortfolioStage) => void;
  rewards: IEarnRewardsPortfolioResponse | undefined;
  isLoading: boolean;
  /** a further ledger page is on its way; shown as a footer spinner */
  isLoadingMore?: boolean;
  /** the positions' claimable rewards, already cut down to their Rewards sections */
  claimableProtocols: IEarnProtocolView[];
  /** every position the page holds; names networks and vaults for the ledger rows */
  positions: IEarnPortfolioPosition[];
  /** the page's network chip; sits under the stage pills on this tab */
  networkFilter: React.ReactNode;
} & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const expansion = useGroupExpansion();
  const labels: Record<IEarnRewardsPortfolioStage, string> = {
    claimable: intl.formatMessage({ id: ETranslations.earn_claimable }),
    pending: intl.formatMessage({ id: ETranslations.global_pending }),
    // "Distributed": referral shares the exact status word; a dedicated earn
    // key is on the OK-61377 i18n list.
    distributed: intl.formatMessage({ id: ETranslations.referral_distributed }),
  };
  // The response in hand may still be the previous stage's while the new one
  // loads; showing it as empty flashed the empty state on every switch. The
  // hook's loading flag lands a render after the stage changes, so a response
  // of another stage is itself the signal that the new one is on its way.
  const isStageLoaded = Boolean(rewards && rewards.stage === stage);
  const groups = rewards && rewards.stage === stage ? rewards.groups : [];
  const isStageLoading = !isStageLoaded && (isLoading || Boolean(rewards));
  const emptyTitle = intl.formatMessage({ id: EMPTY_TITLE_BY_STAGE[stage] });

  let content: React.ReactNode;
  if (stage === 'claimable') {
    content = (
      <RewardsClaimableList
        protocols={claimableProtocols}
        positions={positions}
        ledgerGroups={groups}
        isLoading={isStageLoading}
        emptyTitle={emptyTitle}
        onManage={onManage}
      />
    );
  } else if (isStageLoading) {
    content = (
      <Stack ai="center" py="$8">
        <Spinner size="large" />
      </Stack>
    );
  } else if (groups.length === 0) {
    content = <Empty icon="GiftOutline" title={emptyTitle} />;
  } else {
    content = <RewardsLedgerList groups={groups} expansion={expansion} />;
  }

  return (
    <YStack gap="$4" pb="$2">
      <YStack gap="$3">
        <StagePills value={stage} labels={labels} onChange={onStageChange} />
        <Stack px="$5" ai="flex-start">
          {networkFilter}
        </Stack>
      </YStack>
      {content}
      {isLoadingMore ? (
        <Stack ai="center" py="$4">
          <Spinner size="small" />
        </Stack>
      ) : null}
    </YStack>
  );
}
