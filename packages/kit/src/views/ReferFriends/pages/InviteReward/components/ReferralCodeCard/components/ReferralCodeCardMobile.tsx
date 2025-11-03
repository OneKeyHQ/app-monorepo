import {
  Button,
  IconButton,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { useReferralCodeCard } from '../hooks/useReferralCodeCard';

import type { IReferralCodeCardProps } from '../types';

export function ReferralCodeCardMobile({
  inviteUrl,
  inviteCode,
}: IReferralCodeCardProps) {
  const { handleCopy, copyLink, inviteCodeUrl, intl } = useReferralCodeCard({
    inviteUrl,
    inviteCode,
  });

  return (
    <YStack px="$5" py="$5" gap="$5">
      {/* Referral code row */}
      <XStack jc="space-between" ai="center">
        <YStack flex={1} gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.referralCode}
          </SizableText>
          <SizableText size="$heading2xl">{inviteCode}</SizableText>
        </YStack>
        <Button variant="primary" size="medium" onPress={handleCopy}>
          {intl.copy}
        </Button>
      </XStack>

      {/* Referral Link row */}
      <XStack jc="space-between" ai="center">
        <YStack flex={1} gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.referralLink}
          </SizableText>
          <SizableText size="$bodyMd" numberOfLines={1}>
            {inviteCodeUrl}
          </SizableText>
        </YStack>
        <IconButton
          icon="Copy3Outline"
          variant="tertiary"
          size="medium"
          iconColor="$icon"
          onPress={copyLink}
        />
      </XStack>
    </YStack>
  );
}
