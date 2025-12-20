import { useIntl } from 'react-intl';

import { Badge, Icon, Image, SizableText, XStack } from '@onekeyhq/components';
import { useNavigateToReferralLevel } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferralLevel/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export interface ILevelBadgeProps {
  levelIcon?: string;
  levelLabel: string;
}

export function LevelBadge({ levelIcon, levelLabel }: ILevelBadgeProps) {
  const intl = useIntl();
  const handleViewLevelDetail = useNavigateToReferralLevel();

  return (
    <XStack gap="$2" ai="center">
      <SizableText size="$headingLg" color="$text">
        {intl.formatMessage({ id: ETranslations.referral_current_level })}
      </SizableText>
      <XStack
        gap="$2"
        ai="center"
        cursor="pointer"
        onPress={handleViewLevelDetail}
        hoverStyle={{
          opacity: 0.8,
        }}
        pressStyle={{
          opacity: 0.6,
        }}
      >
        <Badge badgeType="default" badgeSize="lg" gap="$1">
          {levelIcon ? <Image w="$4.5" h="$4.5" src={levelIcon} /> : null}
          <Badge.Text>{levelLabel}</Badge.Text>
        </Badge>
        <Icon size="$4" color="$iconSubdued" name="ChevronRightOutline" />
      </XStack>
    </XStack>
  );
}
