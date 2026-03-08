import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DetailsSectionContainer } from './DetailsSectionContainer';
import { InterestRateModelChart } from './InterestRateModelChart';

interface IInterestRateModelSectionProps {
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  utilizationRatio?: string;
}

export function InterestRateModelSection({
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  utilizationRatio,
}: IInterestRateModelSectionProps) {
  const intl = useIntl();
  const { result: curveData, isLoading } = usePromiseResult(
    async () => {
      const data =
        await backgroundApiProxy.serviceStaking.getBorrowInterestRateCurve({
          networkId,
          provider,
          marketAddress,
          reserveAddress,
        });

      return data;
    },
    [networkId, provider, marketAddress, reserveAddress],
    { watchLoading: true, undefinedResultIfReRun: true },
  );

  return (
    <DetailsSectionContainer
      title={intl.formatMessage({ id: ETranslations.defi_interest_rate_model })}
    >
      <InterestRateModelChart
        borrowCurve={curveData?.borrowCurve ?? []}
        supplyCurve={curveData?.supplyCurve ?? []}
        utilizationRatio={utilizationRatio}
        isLoading={isLoading}
      />
    </DetailsSectionContainer>
  );
}
