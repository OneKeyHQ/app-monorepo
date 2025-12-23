import { memo } from 'react';

import { YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '@onekeyhq/kit/src/views/Staking/components/PageFrame';
import { OverviewSkeleton } from '@onekeyhq/kit/src/views/Staking/components/StakingSkeleton';

import { BorrowFAQSection } from './BorrowFAQSection';
import { ChartSection } from './ChartSection';
import { DailyCapsSection } from './DailyCapsSection';
import { ProductSection } from './ProductSection';
import { ReserveProtocolHeader } from './ReserveProtocolHeader';

interface IDetailsPartProps {
  accountId: string;
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  symbol: string;
  logoURI?: string;
  onShare?: () => void;
}

const DetailsPartComponent = ({
  accountId,
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  symbol,
  logoURI,
  onShare,
}: IDetailsPartProps) => {
  const {
    result: details,
    isLoading,
    run: refreshData,
  } = usePromiseResult(
    async () => {
      if (!accountId) return undefined;
      return backgroundApiProxy.serviceStaking.getBorrowReserveDetails({
        networkId,
        provider,
        marketAddress,
        reserveAddress,
        accountId,
      });
    },
    [networkId, provider, marketAddress, reserveAddress, accountId],
    { watchLoading: true, revalidateOnFocus: true },
  );

  return (
    <YStack flex={6} gap="$5" px="$5">
      <PageFrame
        LoadingSkeleton={OverviewSkeleton}
        loading={isLoadingState({ result: details, isLoading })}
        error={isErrorState({ result: details, isLoading })}
        onRefresh={refreshData}
      >
        {details ? (
          <YStack gap="$8">
            <YStack>
              <ReserveProtocolHeader
                symbol={symbol}
                logoURI={logoURI}
                onShare={onShare}
                oraclePrice={details.oraclePrice}
                reserveSize={details.reserveSize}
                availableLiquidity={details.liquidity}
                utilizationRatio={details.utilizationRatio}
                platformBonus={details.platformBonus}
              />
              <ChartSection
                networkId={networkId}
                provider={provider}
                marketAddress={marketAddress}
                reserveAddress={reserveAddress}
                details={details}
                utilizationRatio={details.utilizationRatio}
              />
            </YStack>
            <DailyCapsSection details={details} />
            <ProductSection details={details} />
            <BorrowFAQSection
              networkId={networkId}
              provider={provider}
              marketAddress={marketAddress}
              reserveAddress={reserveAddress}
            />
          </YStack>
        ) : null}
      </PageFrame>
    </YStack>
  );
};

export const DetailsPart = memo(DetailsPartComponent);
