import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Badge } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnText } from '@onekeyhq/shared/types/staking';

import { BorrowTestIDs } from '../testIDs';

import {
  BorrowHealthFactorTooltip,
  resolveHealthFactorValueColor,
} from './BorrowHealthFactorTooltip';
import { OverviewMetric } from './OverviewMetric';

import type { IHealthFactorDetail } from './BorrowHealthFactorTooltip';
import type { IOverviewMetricProps } from './OverviewMetric';

type IBorrowHealthFactorSummaryProps = {
  detail?: IHealthFactorDetail;
  /** Server-formatted health factor text shown when no risk detail exists
   * (e.g. nothing borrowed yet). */
  fallbackText?: IEarnText;
  isLoading?: boolean;
  widthMode?: IOverviewMetricProps['widthMode'];
};

/**
 * Health factor as one cell of the overview metric strip: the number carries
 * the risk color, the badge carries the wording. The risk meter and the
 * long-form explanations live behind the info tooltip.
 */
export function BorrowHealthFactorSummary({
  detail,
  fallbackText,
  isLoading,
  widthMode,
}: IBorrowHealthFactorSummaryProps) {
  const intl = useIntl();
  const valueColor = useMemo(
    () => resolveHealthFactorValueColor(detail),
    [detail],
  );

  const valueText: IEarnText = detail
    ? { text: detail.value, color: valueColor }
    : (fallbackText ?? { text: '-', color: '$textSubdued' });

  return (
    <OverviewMetric
      testID={BorrowTestIDs.overviewHealthFactor}
      title={{
        text: intl.formatMessage({ id: ETranslations.defi_health_factor }),
      }}
      text={valueText}
      isLoading={isLoading}
      widthMode={widthMode}
      tooltip={detail ? <BorrowHealthFactorTooltip detail={detail} /> : null}
      action={
        detail?.status ? (
          <Badge badgeType={detail.status.badge} flexShrink={0}>
            {detail.status.tag}
          </Badge>
        ) : null
      }
    />
  );
}
