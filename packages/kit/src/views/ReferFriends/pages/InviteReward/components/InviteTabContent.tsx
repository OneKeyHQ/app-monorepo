import { Divider, XStack, YStack, useMedia } from '@onekeyhq/components';
import { useNavigateToInviteCodes } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteCodes/hooks/useNavigateToInviteCodes';
import type {
  IInviteLevelDetail,
  IInviteSummary,
} from '@onekeyhq/shared/src/referralCode/type';

import { InviteBindRow } from './InviteBindRow';
import { InviteEarningsCard } from './InviteEarningsCard';
import { InviteLevelValue } from './InviteLevelPill';
import {
  InviteCompactCard,
  InviteEntriesCard,
  InviteLinkHero,
} from './InviteLinkHero';
import { InviteRewardRows } from './InviteRewardRows';
import { useInviteValueSummary } from './InviteValueLine';
import { SuspensionAlert } from './SuspensionAlert';
import {
  INVITE_CARD_BORDER_COLOR,
  useInviteHomeCardStyle,
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
  const cardStyle = useInviteHomeCardStyle();
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
        // Compact layouts read top-down in groups: sharing (the invite card
        // with the entries behind it, codes and the people they brought in),
        // money (the earnings card and its per-product breakdown), then the
        // invitee's bind entry (only until linked). Spacing groups them: 16px
        // inside a group, 24px between groups. Sharing itself sits in the
        // page footer.
        <YStack px="$pagePadding" pt="$3" gap="$6">
          <YStack gap="$4">
            <InviteCompactCard
              inviteUrl={summaryInfo.inviteUrl}
              inviteCode={summaryInfo.inviteCode}
              valueSummary={valueSummary}
              cardStyle={cardStyle}
              levelValue={
                <InviteLevelValue
                  rebateConfig={summaryInfo.rebateConfig}
                  rebateLevels={summaryInfo.rebateLevels}
                  levelDetail={levelDetail}
                />
              }
            />
            <InviteEntriesCard
              cardStyle={cardStyle}
              onManageCodes={() => {
                navigateToInviteCodes(summaryInfo.inviteUrl);
              }}
            />
          </YStack>
          <YStack gap="$4">
            <InviteEarningsCard
              summaryInfo={summaryInfo}
              fetchSummaryInfo={fetchSummaryInfo}
            />
            <InviteRewardRows summaryInfo={summaryInfo} />
          </YStack>
          <InviteBindRow variant="card" />
        </YStack>
      ) : (
        // Desktop leads with earnings; the invite card sits beside it.
        <XStack px="$pagePadding" gap="$5" ai="stretch">
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

      {md ? null : <InviteRewardRows summaryInfo={summaryInfo} />}
    </YStack>
  );
}
