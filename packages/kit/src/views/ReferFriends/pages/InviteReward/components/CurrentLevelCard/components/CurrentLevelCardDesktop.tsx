import { useIntl } from 'react-intl';

import {
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useCurrentLevelCard } from '../hooks/useCurrentLevelCard';

import { LevelBadge } from './LevelBadge';

import type { ICurrentLevelCardProps } from '../types';

export function CurrentLevelCardDesktop(props: ICurrentLevelCardProps) {
  const intl = useIntl();
  const { levelIcon, levelLabel, commissionRates } = useCurrentLevelCard(props);

  return (
    <YStack px="$5" pb="$5" $platform-native={{ pb: '$8' }}>
      <XStack
        borderRadius="$3"
        borderWidth="$px"
        borderColor="$borderSubdued"
        p="$5"
        ai="center"
        jc="space-between"
      >
        {/* Left side - Level info and rates */}
        <YStack flex={1} gap="$4">
          {/* Header with Current level */}
          <LevelBadge levelIcon={levelIcon} levelLabel={levelLabel} />

          {/* Commission rates */}
          <YStack gap="$3">
            <SizableText size="$bodyMdMedium" color="$textSubdued" pt="$2">
              {intl.formatMessage({ id: ETranslations.referral_rate })}
            </SizableText>

            {/* Rates grid */}
            <XStack gap="$8">
              {commissionRates.map(({ subject, rate }) => (
                <YStack key={subject} gap="$0.5">
                  <XStack gap="$1" ai="center">
                    <SizableText size="$bodyMdMedium" color="$text">
                      {rate.you}%
                    </SizableText>
                    <SizableText size="$bodyMd" color="$neutral7">
                      /
                    </SizableText>
                    <SizableText size="$bodyMdMedium" color="$text">
                      {rate.invitee}%
                    </SizableText>
                  </XStack>

                  <SizableText size="$bodyMd" color="$textSubdued">
                    {rate.label}
                  </SizableText>
                </YStack>
              ))}
            </XStack>
          </YStack>
        </YStack>

        {/* Right side - Level icon */}
        {levelIcon ? (
          <Stack w={88} h={88} ai="center" jc="center" ml="$5" pt="$3">
            <Image w={88} h={88} src={levelIcon} />
          </Stack>
        ) : null}
      </XStack>
    </YStack>
  );
}
