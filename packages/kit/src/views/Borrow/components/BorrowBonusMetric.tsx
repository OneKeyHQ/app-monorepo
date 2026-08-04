import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getBorrowEarnAccountId } from '../borrowEarnAccount';
import { useBorrowContext } from '../BorrowProvider';
import { useBorrowPlaceholderAmountText } from '../hooks/useBorrowPlaceholderAmountText';

import { BorrowBonusTooltip } from './BorrowBonusTooltip';
import { OverviewMetric } from './OverviewMetric';

import type { IOverviewMetricProps } from './OverviewMetric';

/** Platform bonus as one cell of the overview strip. */
export function BorrowBonusMetric({
  widthMode,
}: {
  widthMode?: IOverviewMetricProps['widthMode'];
}) {
  const intl = useIntl();
  const placeholderAmountText = useBorrowPlaceholderAmountText();
  const { reserves, market, earnAccount } = useBorrowContext();

  const earnAccountId = getBorrowEarnAccountId(earnAccount.data);
  const platformBonus = reserves.data?.overview?.platformBonus;

  return (
    <OverviewMetric
      title={
        platformBonus?.data?.title ?? {
          text: intl.formatMessage({ id: ETranslations.defi_platform_bonus }),
        }
      }
      text={platformBonus?.totalReceived.description ?? placeholderAmountText}
      widthMode={widthMode}
      tooltip={
        <BorrowBonusTooltip
          data={platformBonus}
          accountId={earnAccountId}
          networkId={market?.networkId}
          provider={market?.provider}
          marketAddress={market?.marketAddress}
        />
      }
    />
  );
}
