import { memo, useCallback } from 'react';
import type { Ref } from 'react';

import { SizableText, XStack, YStack, useMedia } from '@onekeyhq/components';
import { useNavigateToInviteCodes } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteCodes/hooks/useNavigateToInviteCodes';
import type { IInviteCodeStepImageControl } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferAFriend/components/InviteCodeStepImage';
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
  ReferralListLink,
} from './InviteLinkHero';
import { InviteRewardRows } from './InviteRewardRows';
import { useInviteValueSummary } from './InviteValueLine';
import { SuspensionAlert } from './SuspensionAlert';
import { useInviteHomeCardStyle } from './useInviteCardStyle';

// Compact layouts: the caption over the earnings card, with the referral
// list (the people the codes brought in) beside it, like Payout history on
// the card itself.
function InviteEarningsCaption() {
  return (
    <XStack ai="center" jc="space-between" gap="$3">
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {INVITE_COPY.earningsTitle}
      </SizableText>
      <ReferralListLink />
    </XStack>
  );
}

export const InviteTabContent = memo(function InviteTabContent({
  summaryInfo,
  fetchSummaryInfo,
  levelDetail,
  heroAnimationControlRef,
}: {
  summaryInfo: IInviteSummary;
  fetchSummaryInfo: () => unknown;
  levelDetail: IInviteLevelDetail | undefined;
  heroAnimationControlRef?: Ref<IInviteCodeStepImageControl>;
}) {
  const { md } = useMedia();
  const cardStyle = useInviteHomeCardStyle();
  const valueSummary = useInviteValueSummary({
    rebateConfig: summaryInfo.rebateConfig,
    rebateLevels: summaryInfo.rebateLevels,
    levelDetail,
  });
  const navigateToInviteCodes = useNavigateToInviteCodes();
  const { inviteUrl } = summaryInfo;
  const handleManageCodes = useCallback(() => {
    navigateToInviteCodes(inviteUrl);
  }, [inviteUrl, navigateToInviteCodes]);

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
              animationControlRef={heroAnimationControlRef}
            />
            {/* The bind line belongs to the code card, so it sits closer to
                it than the cards sit to each other. */}
            <YStack gap="$2.5">
              <InviteCompactCard
                inviteUrl={inviteUrl}
                inviteCode={summaryInfo.inviteCode}
                cardStyle={cardStyle}
                onManageCodes={handleManageCodes}
              />
              <InviteBindRow />
            </YStack>
          </YStack>
          <YStack gap="$2">
            <InviteEarningsCaption />
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
        <>
          {/* Desktop leads with earnings; the invite card sits beside it. */}
          <XStack px="$pagePadding" gap="$5" ai="stretch">
            <XStack flex={1} flexBasis={0} minWidth={0}>
              <InviteEarningsCard
                summaryInfo={summaryInfo}
                fetchSummaryInfo={fetchSummaryInfo}
              />
            </XStack>
            {/* Padding stays inside the flex item; on web a zero basis splits
                only the space left after padding, so a padded item would end
                up wider than its sibling. */}
            <XStack flex={1} flexBasis={0} minWidth={0}>
              <YStack flex={1} gap="$4" p="$5" {...cardStyle}>
                <InviteLinkHero
                  inviteUrl={inviteUrl}
                  inviteCode={summaryInfo.inviteCode}
                  valueSummary={valueSummary}
                  onManageCodes={handleManageCodes}
                />
                <InviteBindRow divided />
              </YStack>
            </XStack>
          </XStack>
          <InviteRewardRows
            summaryInfo={summaryInfo}
            valueSummary={valueSummary}
          />
        </>
      )}
    </YStack>
  );
});
