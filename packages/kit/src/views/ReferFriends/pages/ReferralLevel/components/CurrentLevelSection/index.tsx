import { useIntl } from 'react-intl';

import {
  Badge,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ICurrentLevelSectionProps {
  currentLevel: number;
  levelIcon: string;
  levelLabel: string;
}

export function CurrentLevelSection({
  levelIcon,
  levelLabel,
}: ICurrentLevelSectionProps) {
  const intl = useIntl();

  return (
    <XStack gap="$3" p="$4" borderRadius="$3" bg="$bgSubdued">
      <Stack w="$14" h="$14" ai="center" jc="center">
        <Image w="$14" h="$14" src={levelIcon} />
      </Stack>

      <YStack gap="$1">
        <XStack gap="$2.5" ai="center">
          <SizableText size="$headingXl" color="$text">
            {levelLabel}
          </SizableText>
          <Badge badgeSize="lg" alignSelf="flex-start">
            {intl.formatMessage({ id: ETranslations.global_current })}
          </Badge>
        </XStack>

        {/* Description */}
        <SizableText size="$bodyMd" color="$textDisabled">
          {intl.formatMessage({
            id: ETranslations.referral_referral_level_desc1,
          })}
        </SizableText>
        <SizableText size="$bodyMd" color="$textDisabled">
          {intl.formatMessage({
            id: ETranslations.referral_referral_level_desc2,
          })}
        </SizableText>
      </YStack>
    </XStack>
  );
}
