import type { IBadgeType } from '@onekeyhq/components';
import { Badge, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapRewardStatus } from '@onekeyhq/shared/src/referralCode/type';

import type { IntlShape } from 'react-intl';

const STATUS_BADGE_TYPE: Record<ISwapRewardStatus, IBadgeType> = {
  PENDING: 'warning',
  AVAILABLE: 'info',
  ARCHIVE: 'success',
};

const BADGE_ICON_COLOR: Record<IBadgeType, string> = {
  success: '$iconSuccess',
  warning: '$iconCaution',
  info: '$iconInfo',
  critical: '$iconCritical',
  default: '$iconSubdued',
};

export function getSwapRewardStatusLabel({
  intl,
  status,
}: {
  intl: IntlShape;
  status: ISwapRewardStatus;
}) {
  const translationId = {
    PENDING: ETranslations.referral_pending,
    AVAILABLE: ETranslations.referral_undistributed,
    ARCHIVE: ETranslations.referral_distributed,
  }[status];
  // status comes from the server: an unknown value must degrade to raw text,
  // never reach formatMessage with an undefined id (which throws).
  return translationId ? intl.formatMessage({ id: translationId }) : status;
}

export function SwapRewardStatusBadge({
  intl,
  status,
}: {
  intl: IntlShape;
  status: ISwapRewardStatus;
}) {
  const badgeType = STATUS_BADGE_TYPE[status] || 'default';

  return (
    <Badge badgeType={badgeType} badgeSize="sm">
      <Stack
        w={6}
        h={6}
        borderRadius="$full"
        bg={BADGE_ICON_COLOR[badgeType] || '$iconSubdued'}
        mr="$1.5"
      />
      <Badge.Text>
        {getSwapRewardStatusLabel({
          intl,
          status,
        })}
      </Badge.Text>
    </Badge>
  );
}
