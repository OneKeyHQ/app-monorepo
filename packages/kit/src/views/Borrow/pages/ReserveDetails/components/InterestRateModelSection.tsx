import { useMemo, useState } from 'react';

import { SegmentControl, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { InterestRateModelChart } from './InterestRateModelChart';
import { DetailsSectionContainer } from './DetailsSectionContainer';

type ITimePeriod = 'week' | 'month' | 'quarter' | 'year';

interface IInterestRateModelSectionProps {
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  utilizationRatio: string;
}

export function InterestRateModelSection({
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  utilizationRatio,
}: IInterestRateModelSectionProps) {
  const [timePeriod, setTimePeriod] = useState<ITimePeriod>('week');

  const { result: curveData, isLoading } = usePromiseResult(
    async () => {
      const data =
        await backgroundApiProxy.serviceStaking.getBorrowInterestRateCurve({
          networkId,
          provider,
          marketAddress,
          reserveAddress,
          days: timePeriod,
        });

      return data;
    },
    [networkId, provider, marketAddress, reserveAddress, timePeriod],
    { watchLoading: true, undefinedResultIfReRun: true },
  );

  const timePeriodOptions = useMemo(
    () => [
      { label: '1W', value: 'week' as ITimePeriod },
      { label: '1M', value: 'month' as ITimePeriod },
      { label: '3M', value: 'quarter' as ITimePeriod },
      { label: '1Y', value: 'year' as ITimePeriod },
    ],
    [],
  );

  return (
    <DetailsSectionContainer title="Interest rate model">
      <YStack pt="$4">
        <XStack jc="flex-end" mb="$3">
          <SegmentControl
            value={timePeriod}
            options={timePeriodOptions}
            onChange={(value) => setTimePeriod(value as ITimePeriod)}
          />
        </XStack>
        <InterestRateModelChart
          borrowCurve={curveData?.borrowCurve ?? []}
          supplyCurve={curveData?.supplyCurve ?? []}
          isLoading={isLoading}
        />
      </YStack>
    </DetailsSectionContainer>
  );
}
