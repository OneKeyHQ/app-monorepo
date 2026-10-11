import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { InviteCodeStepImage } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferAFriend/components/InviteCodeStepImage';
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
  ...levelProps
}: ICurrentLevelCardProps & {
  valueSummary: IInviteValueSummaryResult;
  levelDetail: IInviteLevelDetail | undefined;
}) {
  const intl = useIntl();

  return (
    <YStack ai="center" gap="$3">
      {/* The intro's referral illustration at page width: its frames span
          the whole canvas, so a narrower box leaves half of it empty. It
          shows still, on the frame with both hands in view. Its background
          matches the canvas, so it bleeds past the page padding unseen. */}
      <InviteCodeStepImage step={2} preloadOtherStep={false} still />
      <YStack ai="center" gap="$2">
        <SizableText size="$heading2xl" textAlign="center">
          {intl.formatMessage({ id: ETranslations.referral_home__title })}
        </SizableText>
        <RateLineTrigger
          valueSummary={valueSummary}
          testID={ReferFriendsTestIDs.inviteHeroRate}
          centered
        />
        {/* Far enough below the rate line that their touch areas (the
            line's padding, the pill's slop) do not meet. */}
        <XStack pt="$3">
          <InviteLevelPill {...levelProps} levelDetail={levelDetail} />
        </XStack>
      </YStack>
    </YStack>
  );
}
