import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteUserConfig } from '@onekeyhq/shared/src/referralCode/type';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { ReferralInfoButton } from './ReferralInfoButton';

export function LevelPolicyNotice({
  policy,
  floorUntil,
  inlineDescription = false,
}: {
  policy: NonNullable<IInviteUserConfig['levelPolicy']>;
  floorUntil?: string;
  inlineDescription?: boolean;
}) {
  const intl = useIntl();
  if (policy === 'normal') {
    return null;
  }
  const title = intl.formatMessage({
    id:
      policy === 'floor'
        ? ETranslations.referral_level_protected__title
        : ETranslations.referral_level_fixed__title,
  });
  const description = intl.formatMessage({
    id:
      policy === 'floor'
        ? ETranslations.referral_level_protected__desc
        : ETranslations.referral_level_fixed__desc,
  });
  return (
    <YStack gap={inlineDescription ? '$1' : undefined}>
      <XStack ai="center" gap="$1" flexWrap="wrap">
        <SizableText
          size="$bodyMdMedium"
          color={inlineDescription ? '$text' : '$textSubdued'}
        >
          {title}
        </SizableText>
        {inlineDescription ? null : (
          <ReferralInfoButton title={title} description={description} />
        )}
      </XStack>
      {inlineDescription ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {description}
        </SizableText>
      ) : null}
      {policy === 'floor' && floorUntil ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage(
            { id: ETranslations.referral_level_protection_until__desc },
            {
              date: formatDate(floorUntil, { hideSeconds: true }),
            },
          )}
        </SizableText>
      ) : null}
    </YStack>
  );
}
