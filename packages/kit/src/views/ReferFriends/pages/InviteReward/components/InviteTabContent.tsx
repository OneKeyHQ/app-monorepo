import { Divider, XStack, YStack, useMedia } from '@onekeyhq/components';
import { useNavigateToInviteCodes } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteCodes/hooks/useNavigateToInviteCodes';
import type {
  IInviteLevelDetail,
  IInviteSummary,
} from '@onekeyhq/shared/src/referralCode/type';

import { INVITE_COPY } from '../inviteCopy';

import { InviteBindRow } from './InviteBindRow';
import { InviteCompactHero } from './InviteCompactHero';
import { InviteEarningsCard } from './InviteEarningsCard';
import {
  InviteCompactCard,
  InviteLinkHero,
  InviteOverviewCaption,
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
  isHeroAnimationPaused,
}: {
  summaryInfo: IInviteSummary;
  fetchSummaryInfo: () => unknown;
  levelDetail: IInviteLevelDetail | undefined;
  isHeroAnimationPaused?: boolean;
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
        // Compact layouts open on inviting: the hero (illustration, what
        // each side gets, the level) over the code card and the bind entry.
        // The money follows under its own caption, with the referral list
        // beside it, a scroll away. Captions sit 8px over their card, cards
        // 16px apart inside a group, 24px between groups. Sharing itself
        // sits in the page footer.
        <YStack px="$pagePadding" gap="$6">
          <YStack gap="$4">
            <InviteCompactHero
              valueSummary={valueSummary}
              rebateConfig={summaryInfo.rebateConfig}
              rebateLevels={summaryInfo.rebateLevels}
              levelDetail={levelDetail}
              isAnimationPaused={isHeroAnimationPaused}
            />
            <InviteCompactCard
              inviteUrl={summaryInfo.inviteUrl}
              inviteCode={summaryInfo.inviteCode}
              cardStyle={cardStyle}
              onManageCodes={() => {
                navigateToInviteCodes(summaryInfo.inviteUrl);
              }}
            />
            <InviteBindRow />
          </YStack>
          <YStack gap="$2">
            <InviteOverviewCaption label={INVITE_COPY.earningsTitle} />
            <YStack gap="$4">
              <InviteEarningsCard
                summaryInfo={summaryInfo}
                fetchSummaryInfo={fetchSummaryInfo}
              />
              <InviteRewardRows summaryInfo={summaryInfo} />
            </YStack>
          </YStack>
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
