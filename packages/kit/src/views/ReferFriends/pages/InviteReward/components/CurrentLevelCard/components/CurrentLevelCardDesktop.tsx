import { useIntl } from 'react-intl';

import {
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { useCurrentLevelCard } from '../hooks/useCurrentLevelCard';

import { LevelBadge } from './LevelBadge';

import type { ICurrentLevelCardProps } from '../types';

export function CurrentLevelCardDesktop(props: ICurrentLevelCardProps) {
  const { levelIcon, levelLabel, commissionRates } = useCurrentLevelCard(props);

  return (
    <YStack px="$5" pt="$6" pb="$5" $platform-native={{ pb: '$8' }}>
      <XStack
        borderRadius="$3"
        borderWidth="$px"
        borderColor="$borderSubdued"
        bg="$bgSubdued"
        p="$5"
        ai="center"
        jc="space-between"
      >
        {/* Left side - Level info and rates */}
        <YStack flex={1} gap="$4">
          {/* Header with Current level */}
          <LevelBadge levelIcon={levelIcon} levelLabel={levelLabel} />

          {/* Commission rates */}
          <YStack gap="$2">
            <SizableText size="$bodyMdMedium" color="$text">
              Rate - You/Invitee
            </SizableText>

            {/* Rates grid */}
            <XStack gap="$8">
              {/* Hardware sales */}
              <YStack gap="$1">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {commissionRates.hardwareSales.label}
                </SizableText>
                <XStack gap="$1" ai="center">
                  <SizableText size="$bodyMdMedium" color="$text">
                    {commissionRates.hardwareSales.you}%
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    /
                  </SizableText>
                  <SizableText size="$bodyMdMedium" color="$text">
                    {commissionRates.hardwareSales.invitee}%
                  </SizableText>
                </XStack>
              </YStack>

              {/* DeFi performance fee */}
              <YStack gap="$1">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {commissionRates.defi.label}
                </SizableText>
                <XStack gap="$1" ai="center">
                  <SizableText size="$bodyMdMedium" color="$text">
                    {commissionRates.defi.you}%
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    /
                  </SizableText>
                  <SizableText size="$bodyMdMedium" color="$text">
                    {commissionRates.defi.invitee}%
                  </SizableText>
                </XStack>
              </YStack>
            </XStack>
          </YStack>
        </YStack>

        {/* Right side - Level icon */}
        {levelIcon ? (
          <Stack w="$24" h="$24" ai="center" jc="center" ml="$5">
            <Image w="$24" h="$24" src={levelIcon} />
          </Stack>
        ) : null}
      </XStack>
    </YStack>
  );
}
