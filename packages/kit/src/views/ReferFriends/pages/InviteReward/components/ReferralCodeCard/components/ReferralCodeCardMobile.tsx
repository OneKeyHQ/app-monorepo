import {
  Button,
  ButtonFrame,
  Divider,
  Icon,
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
    <YStack bg="$bgSubdued" borderRadius="$3" p="$4" gap="$4">
      {/* Referral code row */}
      <XStack jc="space-between" ai="center" gap="$6">
        <YStack flex={1} gap="$0">
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {intl.referralCode}
          </SizableText>
          <SizableText size="$headingLg" color="$text">
            {inviteCode}
          </SizableText>
        </YStack>
        <Button variant="primary" size="medium" onPress={handleCopy}>
          {intl.copy}
        </Button>
      </XStack>

      {/* Divider */}
      <Divider />

      {/* Referral Link row */}
      <ButtonFrame
        flexDirection="row"
        gap="$2"
        ai="center"
        jc="space-between"
        borderWidth={0}
        onPress={copyLink}
        borderRadius="$2"
        p="$2"
        mx="$-2"
        userSelect="none"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        bg="$transparent"
      >
        <SizableText flexShrink={0} size="$bodyMd" color="$textSubdued">
          {intl.referralLink}
        </SizableText>
        <SizableText
          size="$bodyMdMedium"
          color="$text"
          flex={1}
          textAlign="right"
          numberOfLines={1}
        >
          {inviteCodeUrl}
        </SizableText>
        <Icon
          name="Copy3Outline"
          size="$6"
          color="$iconSubdued"
          flexShrink={0}
        />
      </ButtonFrame>
    </YStack>
  );
}
