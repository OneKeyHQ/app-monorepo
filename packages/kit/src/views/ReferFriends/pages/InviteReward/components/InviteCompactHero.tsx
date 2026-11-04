import { useIntl } from 'react-intl';

import {
  Image,
  SizableText,
  XStack,
  YStack,
  usePageWidth,
} from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  getInviteCodeStepImageHeight,
  getInviteCodeStepImageWidth,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferAFriend/components/InviteCodeStepImage';
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
  const isDark = useThemeVariant() === 'dark';
  const pageWidth = usePageWidth();

  return (
    <YStack ai="center" gap="$3">
      {/* A still of the intro's referral animation (step 2, frame 324: its
          settled frame, both hands in view; re-export it if that art
          changes), so the page loads no Lottie. Sized like the
          animation, at page width: its art spans the whole canvas. The
          background is transparent, so it bleeds past the page padding
          unseen. */}
      <Image
        testID={ReferFriendsTestIDs.inviteHeroImage}
        w={getInviteCodeStepImageWidth(pageWidth)}
        h={getInviteCodeStepImageHeight(pageWidth)}
        alignSelf="center"
        resizeMode="contain"
        source={
          isDark
            ? require('@onekeyhq/kit/assets/referral_invite_hero_dark.png')
            : require('@onekeyhq/kit/assets/referral_invite_hero.png')
        }
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
        {/* Far enough below the rate line that their touch areas (the
            line's padding, the pill's slop) do not meet. */}
        <XStack pt="$3">
          <InviteLevelPill {...levelProps} levelDetail={levelDetail} />
        </XStack>
      </YStack>
    </YStack>
  );
}
