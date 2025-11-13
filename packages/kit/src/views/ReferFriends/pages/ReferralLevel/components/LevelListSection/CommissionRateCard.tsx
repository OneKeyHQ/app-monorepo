import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { SizableText, XStack, YStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteLevelCommissionRate } from '@onekeyhq/shared/src/referralCode/type';

export function CommissionRateCard({
  label,
  rate,
}: {
  label: string;
  rate: IInviteLevelCommissionRate;
}) {
  const intl = useIntl();

  const media = useMedia();

  if (media.md) {
    return (
      <XStack
        borderRadius="$2"
        bg="$bgStrong"
        py="$1"
        px="$2"
        jc="space-between"
        ai="center"
      >
        <SizableText size="$headingMd" color="$text">
          {label}
        </SizableText>

        <SizableText size="$bodyMdMedium" color="$text">
          {rate.rebate}% / {rate.discount}%
        </SizableText>
      </XStack>
    );
  }

  return (
    <YStack
      gap="$1.5"
      flex={1}
      borderRadius="$3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$neutral3"
      px="$4"
      py="$3"
    >
      <SizableText size="$headingSm" color="$text">
        {label}
      </SizableText>

      <XStack
        borderRadius="$2"
        bg="$bgStrong"
        py="$1"
        px="$2"
        jc="space-between"
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.referral_upgrade_you,
          })}
        </SizableText>

        <SizableText size="$bodyMdMedium" color="$text">
          {rate.rebate}%
        </SizableText>
      </XStack>

      <XStack
        borderRadius="$2"
        bg="$bgStrong"
        py="$1"
        px="$2"
        jc="space-between"
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.referral_upgrade_user,
          })}
        </SizableText>

        <SizableText size="$bodyMdMedium" color="$text">
          {rate.discount}%
        </SizableText>
      </XStack>
    </YStack>
  );
}
