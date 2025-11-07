import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  Image,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNavigateToReferralLevel } from '../../../../ReferralLevel/hooks/useNavigateToReferralLevel';

export interface ILevelBadgeProps {
  levelIcon?: string;
  levelLabel: string;
}

export function LevelBadge({ levelIcon, levelLabel }: ILevelBadgeProps) {
  const intl = useIntl();
  const handleViewLevelDetail = useNavigateToReferralLevel();

  return (
    <YStack gap="$2">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.referral_current_level })}
      </SizableText>
      <XStack
        gap="$1"
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
        <Badge badgeType="default" badgeSize="lg">
          {levelIcon ? <Image w="$4.5" h="$4.5" src={levelIcon} /> : null}
          <Badge.Text>{levelLabel}</Badge.Text>
        </Badge>
        <Icon size="$6" color="$iconSubdued" name="ChevronRightOutline" />
      </XStack>
    </YStack>
  );
}
