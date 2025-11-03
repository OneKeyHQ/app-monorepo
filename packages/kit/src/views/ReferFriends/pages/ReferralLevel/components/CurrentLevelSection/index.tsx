import { useIntl } from 'react-intl';

import {
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
    <YStack
      gap="$3"
      p="$4"
      borderRadius="$3"
      borderWidth="$0.5"
      borderColor="$borderSubdued"
      bg="$bgSubdued"
    >
      {/* Header with level icon and name */}
      <XStack gap="$3" ai="center">
        <Stack w="$10" h="$10" ai="center" jc="center">
          <Image w="$10" h="$10" src={levelIcon} />
        </Stack>
        <YStack flex={1} gap="$1">
          <SizableText size="$headingLg" color="$text">
            {levelLabel}
          </SizableText>
          <Stack
            bg="$bgInfo"
            px="$2"
            py="$0.5"
            borderRadius="$1"
            alignSelf="flex-start"
          >
            <SizableText size="$bodySm" color="$textInfo">
              {intl.formatMessage({ id: ETranslations.global_current })}
            </SizableText>
          </Stack>
        </YStack>
      </XStack>

      {/* Description */}
      <YStack gap="$2">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.referral_referral_level_desc1,
          })}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.referral_referral_level_desc2,
          })}
        </SizableText>
      </YStack>
    </YStack>
  );
}
