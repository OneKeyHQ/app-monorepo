import { useIntl } from 'react-intl';

import { Badge, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ReferralInfoButton } from './ReferralInfoButton';

export function PartnerBenefitsBadge({
  showInfo = false,
}: {
  showInfo?: boolean;
}) {
  const intl = useIntl();
  return (
    <XStack ai="center" gap="$1" flexShrink={0}>
      <Badge
        badgeType="default"
        badgeSize="sm"
        borderRadius="$full"
        flexShrink={0}
      >
        {intl.formatMessage({
          id: ETranslations.referral_partner_benefits__title,
        })}
      </Badge>
      {showInfo ? (
        <ReferralInfoButton
          title={intl.formatMessage({
            id: ETranslations.referral_partner_benefits__title,
          })}
          description={intl.formatMessage({
            id: ETranslations.referral_partner_benefits__desc,
          })}
        />
      ) : null}
    </XStack>
  );
}
