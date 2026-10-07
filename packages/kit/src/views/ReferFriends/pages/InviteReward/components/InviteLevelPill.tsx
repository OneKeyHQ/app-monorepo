import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { useNavigateToReferralLevel } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferralLevel/hooks/useNavigateToReferralLevel';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';

import { ReferFriendsTestIDs } from '../../../testIDs';

import { useCurrentLevelCardFromDetail } from './CurrentLevelCard/hooks/useCurrentLevelCard';

import type { ICurrentLevelCardProps } from './CurrentLevelCard/types';

export function InviteLevelPill({
  levelDetail,
  ...props
}: ICurrentLevelCardProps & {
  levelDetail: IInviteLevelDetail | undefined;
}) {
  const { levelLabel } = useCurrentLevelCardFromDetail(props, levelDetail);
  const navigateToReferralLevel = useNavigateToReferralLevel();

  return (
    <XStack
      testID={ReferFriendsTestIDs.inviteLevelPill}
      ai="center"
      gap="$1"
      px="$2"
      py="$1"
      borderRadius="$full"
      bg="$bgSubdued"
      flexShrink={1}
      cursor="pointer"
      role="button"
      onPress={() => {
        void navigateToReferralLevel();
      }}
    >
      {props.rebateConfig.emoji ? (
        <SizableText size="$bodyMd">{props.rebateConfig.emoji}</SizableText>
      ) : null}
      <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
        {levelLabel}
      </SizableText>
      <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
    </XStack>
  );
}
