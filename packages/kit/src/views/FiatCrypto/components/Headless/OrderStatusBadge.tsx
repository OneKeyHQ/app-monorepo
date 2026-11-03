import { useIntl } from 'react-intl';

import { Badge } from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EHeadlessBuyOrderStatus } from '@onekeyhq/shared/types/fiatCrypto';

const STATUS_META: Record<
  EHeadlessBuyOrderStatus,
  { badgeType: IBadgeType; labelId: ETranslations }
> = {
  [EHeadlessBuyOrderStatus.Processing]: {
    badgeType: 'info',
    labelId: ETranslations.global_processing,
  },
  [EHeadlessBuyOrderStatus.Delivered]: {
    badgeType: 'success',
    labelId: ETranslations.buy_order_status_delivered__title,
  },
  [EHeadlessBuyOrderStatus.Failed]: {
    badgeType: 'critical',
    labelId: ETranslations.global_failed,
  },
  [EHeadlessBuyOrderStatus.Refunded]: {
    badgeType: 'success',
    labelId: ETranslations.trade_status_refunded,
  },
};

export function getHeadlessBuyOrderStatusLabelId(
  status: EHeadlessBuyOrderStatus,
): ETranslations {
  return STATUS_META[status].labelId;
}

export function OrderStatusBadge({
  status,
  badgeSize = 'sm',
}: {
  status: EHeadlessBuyOrderStatus;
  badgeSize?: 'sm' | 'lg';
}) {
  const intl = useIntl();
  const meta = STATUS_META[status];
  return (
    <Badge badgeType={meta.badgeType} badgeSize={badgeSize}>
      {intl.formatMessage({ id: meta.labelId })}
    </Badge>
  );
}
