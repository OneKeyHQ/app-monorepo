import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useCurrentLevelCard } from '../hooks/useCurrentLevelCard';

import { LevelBadge } from './LevelBadge';

import type { ICurrentLevelCardProps } from '../types';

export function CurrentLevelCardMobile(props: ICurrentLevelCardProps) {
  const intl = useIntl();
  const { levelIcon, levelLabel, commissionRates } = useCurrentLevelCard(props);

  return (
    <YStack px="$5" pb="$5" w="100%">
      <YStack
        borderRadius="$3"
        borderWidth="$px"
        borderColor="$borderSubdued"
        bg="$bgSubdued"
        p="$4"
        gap="$4"
      >
        {/* Header with Current level label and level name */}
        <LevelBadge levelIcon={levelIcon} levelLabel={levelLabel} />

        {/* Commission rates section */}
        <YStack gap="$2">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.referral_rate })}
          </SizableText>

          {commissionRates.map(({ subject, rate }) => (
            <XStack
              key={subject}
              jc="space-between"
              ai="center"
              bg="$bgStrong"
              py="$1"
              px="$2"
              borderRadius="$2"
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                {rate.label}
              </SizableText>
              <XStack gap="$1" ai="center">
                <SizableText size="$bodyMdMedium" color="$text">
                  {rate.you}%
                </SizableText>
                <SizableText size="$bodyMd" color="$textSubdued">
                  /
                </SizableText>
                <SizableText size="$bodyMdMedium" color="$text">
                  {rate.invitee}%
                </SizableText>
              </XStack>
            </XStack>
          ))}
        </YStack>
      </YStack>
    </YStack>
  );
}
