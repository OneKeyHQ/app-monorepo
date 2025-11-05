import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';

import { useCurrentLevelCard } from '../hooks/useCurrentLevelCard';

import { LevelBadge } from './LevelBadge';

import type { ICurrentLevelCardProps } from '../types';

export function CurrentLevelCardMobile(props: ICurrentLevelCardProps) {
  const intl = useIntl();
  const { levelIcon, levelLabel, commissionRates } = useCurrentLevelCard(props);

  return (
    <YStack px="$5" pb="$5">
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
        <YStack gap="$3">
          <SizableText size="$bodyMdMedium" color="$text">
            Rate - You/Invitee
          </SizableText>

          {/* Hardware sales rate */}
          <XStack jc="space-between" ai="center">
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
          </XStack>

          {/* DeFi performance fee rate */}
          <XStack jc="space-between" ai="center">
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
          </XStack>
        </YStack>
      </YStack>
    </YStack>
  );
}
