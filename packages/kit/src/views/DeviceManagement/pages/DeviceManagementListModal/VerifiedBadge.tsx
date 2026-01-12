import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function VerifiedBadge({ isVerified }: { isVerified: boolean }) {
  const intl = useIntl();
  const verificationStatus = useMemo(
    () => ({
      success: {
        icon: 'BadgeVerifiedSolid' as const,
        color: '$iconSuccess' as const,
        textId: ETranslations.global_verified,
      },
      critical: {
        icon: 'ErrorSolid' as const,
        color: '$iconCritical' as const,
        textId: ETranslations.global_unverified,
      },
    }),
    [],
  );

  const status = isVerified
    ? verificationStatus.success
    : verificationStatus.critical;

  return (
    <XStack ai="center" gap="$1.5">
      <Icon name={status.icon} color={status.color} size="$4" />
      <SizableText size="$bodySmMedium" color={status.color}>
        {intl.formatMessage({ id: status.textId })}
      </SizableText>
    </XStack>
  );
}
