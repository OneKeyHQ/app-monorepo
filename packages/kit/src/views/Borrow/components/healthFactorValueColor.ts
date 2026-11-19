import type { ColorTokens } from '@onekeyhq/components';
import type { IBorrowHealthFactorRiskDetail } from '@onekeyhq/shared/types/staking';

export type IHealthFactorDetail =
  IBorrowHealthFactorRiskDetail['data']['healthFactorDetail'];

export function resolveHealthFactorValueColor(
  detail?: IHealthFactorDetail,
): ColorTokens {
  if (detail?.valueColor) {
    return detail.valueColor;
  }
  const badgeType = detail?.status?.badge;
  if (badgeType === 'success') {
    return '$textSuccess';
  }
  if (badgeType === 'critical') {
    return '$textCritical';
  }
  return '$textCaution';
}
