import { memo } from 'react';

import { Divider, YStack } from '@onekeyhq/components';
import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '@onekeyhq/kit/src/views/Staking/components/PageFrame';
import { OverviewSkeleton } from '@onekeyhq/kit/src/views/Staking/components/StakingSkeleton';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

import { BorrowFAQSection } from './BorrowFAQSection';
import { ChartSection } from './ChartSection';
import { DailyCapsSection } from './DailyCapsSection';
import { ReserveProtocolHeader } from './ReserveProtocolHeader';
import { RiskSection } from './RiskSection';

interface IDetailsPartProps {
  details: IBorrowReserveDetail | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  symbol: string;
  logoURI?: string;
  onShare?: () => void;
}

const DetailsPartComponent = ({
  details,
  isLoading,
  onRefresh,
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  symbol,
  logoURI,
  onShare,
}: IDetailsPartProps) => {
  return (
    <YStack flex={6} gap="$5" px="$5">
      <PageFrame
        LoadingSkeleton={OverviewSkeleton}
        loading={isLoadingState({ result: details, isLoading })}
        error={isErrorState({ result: details, isLoading })}
        onRefresh={onRefresh}
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
              <Divider mb="$8" />
              <ChartSection
                networkId={networkId}
                provider={provider}
                marketAddress={marketAddress}
                reserveAddress={reserveAddress}
                details={details}
              />
            </YStack>
            <DailyCapsSection details={details} />
            <RiskSection risk={details.risk} />
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
