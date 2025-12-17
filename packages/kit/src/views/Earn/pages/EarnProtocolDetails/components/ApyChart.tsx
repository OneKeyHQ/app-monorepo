import { memo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ApyChartBase } from '@onekeyhq/kit/src/views/Staking/components/ApyChartBase';

interface IApyChartProps {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
}

const ApyChartComponent = ({
  networkId,
  symbol,
  provider,
  vault,
}: IApyChartProps) => {
  const { result: apyHistory, isLoading } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceStaking.getApyHistory({
        networkId,
        symbol,
        provider,
        vault,
      }),
    [networkId, symbol, provider, vault],
    { watchLoading: true },
  );

  return <ApyChartBase data={apyHistory} isLoading={isLoading} />;
};

export const ApyChart = memo(ApyChartComponent);
