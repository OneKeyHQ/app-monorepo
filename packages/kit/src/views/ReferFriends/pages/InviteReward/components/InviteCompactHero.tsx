import type { Ref } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { InviteCodeStepImage } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferAFriend/components/InviteCodeStepImage';
import type { IInviteCodeStepImageControl } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferAFriend/components/InviteCodeStepImage';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';

import { ReferFriendsTestIDs } from '../../../testIDs';

import { InviteLevelPill } from './InviteLevelPill';
import { RateLineTrigger } from './InviteValueLine';

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
  const intl = useIntl();

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
          {intl.formatMessage({ id: ETranslations.referral_home__title })}
        </SizableText>
        <RateLineTrigger
          valueSummary={valueSummary}
          testID={ReferFriendsTestIDs.inviteHeroRate}
          centered
        />
        <XStack pt="$1">
          <InviteLevelPill {...levelProps} levelDetail={levelDetail} />
        </XStack>
      </YStack>
    </YStack>
  );
}
