import type { Ref } from 'react';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { InviteCodeStepImage } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferAFriend/components/InviteCodeStepImage';
import type { IInviteCodeStepImageControl } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferAFriend/components/InviteCodeStepImage';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { INVITE_COPY } from '../inviteCopy';

import { InviteLevelPill } from './InviteLevelPill';
import { RatePopover } from './InviteValueLine';

import type { ICurrentLevelCardProps } from './CurrentLevelCard/types';
import type { IInviteValueSummaryResult } from './InviteValueLine';

// Compact layouts open on inviting alone: the intro's illustration, the
// headline, what each side gets, and the level that sets it. The
// money sits further down the page.
export function InviteCompactHero({
  valueSummary,
  levelDetail,
  animationControlRef,
  ...levelProps
}: ICurrentLevelCardProps & {
  valueSummary: IInviteValueSummaryResult;
  levelDetail: IInviteLevelDetail | undefined;
  // The page holds the illustration still while it cannot be seen.
  animationControlRef?: Ref<IInviteCodeStepImageControl>;
}) {
  const { summary } = valueSummary;
  const upTo = summary && !summary.isUniform ? `${INVITE_COPY.upTo} ` : '';

  return (
    <YStack ai="center" gap="$3">
      {/* The intro's referral loop at page width: its frames swap one hand
          for another across the whole canvas, so a narrower box or a frozen
          last frame leaves half of it empty. The illustration's background
          matches the canvas, so it bleeds past the page padding unseen. */}
      <InviteCodeStepImage
        step={2}
        controlRef={animationControlRef}
        preloadOtherStep={false}
      />
      <YStack ai="center" gap="$2">
        <SizableText size="$heading2xl" textAlign="center">
          {INVITE_COPY.heroTitle}
        </SizableText>
        {summary ? (
          <RatePopover
            valueSummary={valueSummary}
            trigger={
              <XStack
                testID={ReferFriendsTestIDs.inviteHeroRate}
                ai="center"
                jc="center"
                flexWrap="wrap"
                gap="$1"
              >
                <SizableText size="$bodyMd" color="$textSubdued">
                  {INVITE_COPY.heroYouEarn}
                </SizableText>
                <SizableText size="$bodyMdMedium" color="$textSuccess">
                  {`${upTo}${summary.rate}`}
                </SizableText>
                {summary.friendRate ? (
                  <>
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {`· ${INVITE_COPY.heroFriendsSave}`}
                    </SizableText>
                    <SizableText size="$bodyMdMedium" color="$textSuccess">
                      {`${upTo}${summary.friendRate}`}
                    </SizableText>
                  </>
                ) : null}
                <Icon name="InfoCircleOutline" size="$4" color="$iconSubdued" />
              </XStack>
            }
          />
        ) : null}
        <XStack pt="$1">
          <InviteLevelPill {...levelProps} levelDetail={levelDetail} />
        </XStack>
      </YStack>
    </YStack>
  );
}
