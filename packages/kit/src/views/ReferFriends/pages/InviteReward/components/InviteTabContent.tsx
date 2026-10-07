import { Divider, XStack, YStack, useMedia } from '@onekeyhq/components';
import { useNavigateToInviteCodes } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteCodes/hooks/useNavigateToInviteCodes';
import { ResponsiveTwoColumnLayout } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/shared';
import type {
  IInviteLevelDetail,
  IInviteSummary,
} from '@onekeyhq/shared/src/referralCode/type';

import { InviteBindRow } from './InviteBindRow';
import { InviteEarningsCard } from './InviteEarningsCard';
import { InviteLinkHero } from './InviteLinkHero';
import { InviteRewardRows } from './InviteRewardRows';
import { useInviteValueSummary } from './InviteValueLine';
import { SuspensionAlert } from './SuspensionAlert';
import {
  INVITE_CARD_BORDER_COLOR,
  useInviteCardStyle,
} from './useInviteCardStyle';

export function InviteTabContent({
  summaryInfo,
  fetchSummaryInfo,
  levelDetail,
}: {
  summaryInfo: IInviteSummary;
  fetchSummaryInfo: () => unknown;
  levelDetail: IInviteLevelDetail | undefined;
}) {
  const { md } = useMedia();
  const cardStyle = useInviteCardStyle();
  const valueSummary = useInviteValueSummary({
    rebateConfig: summaryInfo.rebateConfig,
    rebateLevels: summaryInfo.rebateLevels,
    levelDetail,
  });
  const navigateToInviteCodes = useNavigateToInviteCodes();

  const inviteHero = (
    <InviteLinkHero
      inviteUrl={summaryInfo.inviteUrl}
      inviteCode={summaryInfo.inviteCode}
      valueSummary={valueSummary}
      onManageCodes={() => {
        navigateToInviteCodes(summaryInfo.inviteUrl);
      }}
    />
  );

  return (
    <YStack pb="$6">
      <SuspensionAlert
        suspensionNotice={summaryInfo.suspensionNotice}
        suspensionContactLabel={summaryInfo.suspensionContactLabel}
      />

      {md ? (
        <ResponsiveTwoColumnLayout
          leftColumn={
            <YStack gap="$3">
              {inviteHero}
              <InviteBindRow />
            </YStack>
          }
          rightColumn={
            <InviteEarningsCard
              summaryInfo={summaryInfo}
              fetchSummaryInfo={fetchSummaryInfo}
            />
          }
        />
      ) : (
        // Desktop leads with earnings; the invite card sits beside it.
        <XStack px="$pagePadding" gap="$4" ai="stretch">
          <XStack flex={1} flexBasis={0} minWidth={0}>
            <InviteEarningsCard
              summaryInfo={summaryInfo}
              fetchSummaryInfo={fetchSummaryInfo}
            />
          </XStack>
          {/* Padding stays inside the flex item; on web a zero basis splits
              only the space left after padding, so a padded item would end up
              wider than its sibling. */}
          <XStack flex={1} flexBasis={0} minWidth={0}>
            <YStack flex={1} gap="$4" p="$5" {...cardStyle}>
              {inviteHero}
              <Divider borderColor={INVITE_CARD_BORDER_COLOR} />
              <InviteBindRow />
            </YStack>
          </XStack>
        </XStack>
      )}

      <InviteRewardRows summaryInfo={summaryInfo} />
    </YStack>
  );
}
