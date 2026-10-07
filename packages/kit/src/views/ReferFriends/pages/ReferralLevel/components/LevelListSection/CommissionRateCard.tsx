import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack, useMedia } from '@onekeyhq/components';
import { INVITE_CARD_BORDER_COLOR } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle';
import {
  formatCommissionRateText,
  formatInviteeDiscountText,
} from '@onekeyhq/kit/src/views/ReferFriends/utils';
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
        <SizableText size="$bodyMd" color="$text">
          {label}
        </SizableText>

        <SizableText size="$bodyMdMedium" color="$text">
          {formatCommissionRateText({
            rebate: rate.rebate,
            discount: rate.discount,
          })}
        </SizableText>
      </XStack>
    );
  }

  return (
    <YStack
      gap="$1.5"
      flex={1}
      borderRadius="$3"
      borderWidth={1}
      borderColor={INVITE_CARD_BORDER_COLOR}
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
          {formatInviteeDiscountText(rate.discount)}
        </SizableText>
      </XStack>
    </YStack>
  );
}
