import { useIntl } from 'react-intl';

import { IconButton, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ReferralListButton } from '../../ReferralListButton';
import { useReferralCodeCard } from '../hooks/useReferralCodeCard';

import type { IReferralCodeCardProps } from '../types';

interface IReferralInputFieldProps {
  label: string;
  value: string;
  onCopy: () => void;
}

function ReferralInputField({
  label,
  value,
  onCopy,
}: IReferralInputFieldProps) {
  return (
    <XStack
      bg="$bgStrong"
      borderRadius="$3"
      px="$3.5"
      py="$2.5"
      ai="center"
      jc="space-between"
      w="100%"
    >
      {/* Left content area */}
      <SizableText size="$bodyLg" color="$textPlaceholder">
        {label}
      </SizableText>

      <XStack ai="center" jc="flex-end" gap="$2.5" width="75%">
        <SizableText
          size="$bodyLgMedium"
          color="$text"
          flexShrink={1}
          numberOfLines={1}
        >
          {value}
        </SizableText>

        {/* Right copy button */}
        <IconButton
          icon="Copy3Outline"
          size="medium"
          variant="tertiary"
          onPress={onCopy}
        />
      </XStack>
    </XStack>
  );
}

export function ReferralCodeCardDesktop({
  inviteUrl,
  inviteCode,
}: IReferralCodeCardProps) {
  const {
    handleCopy,
    copyLink,
    inviteCodeUrl,
    intl: intlStrings,
  } = useReferralCodeCard({ inviteUrl, inviteCode });
  const intl = useIntl();

  return (
    <YStack
      bg="$bg"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$4"
      px="$5"
      py="$0"
    >
      {/* Title area */}
      <XStack jc="space-between" ai="center" gap="$6" py="$5">
        <SizableText size="$headingMd" color="$text">
          {intl.formatMessage({ id: ETranslations.referral_invite_via })}
        </SizableText>
        <ReferralListButton />
      </XStack>

      {/* Input fields container */}
      <YStack gap="$3" pb="$5">
        <ReferralInputField
          label={intlStrings.referralCode}
          value={inviteCode}
          onCopy={handleCopy}
        />
        <ReferralInputField
          label={intlStrings.referralLink}
          value={inviteCodeUrl}
          onCopy={copyLink}
        />
      </YStack>
    </YStack>
  );
}
