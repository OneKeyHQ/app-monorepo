import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Divider, YStack, useMedia } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '@onekeyhq/kit/src/views/Staking/components/PageFrame';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  LOCALE_SEPARATORS,
  formatLocalizedNumberString,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

import { BorrowFAQSection } from './BorrowFAQSection';
import { BorrowReserveDetailsSkeleton } from './BorrowReserveDetailsSkeleton';
import { ChartSection } from './ChartSection';
import { DailyCapsSection } from './DailyCapsSection';
import { ReserveDetailsTabs } from './ReserveDetailsTabs';
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

function formatOraclePrice({
  oraclePrice,
  currencySymbol,
}: {
  oraclePrice: string | undefined;
  currencySymbol: string;
}) {
  if (!oraclePrice) {
    return undefined;
  }

  const localeSeparators =
    LOCALE_SEPARATORS[appLocale.intl.locale] ?? LOCALE_SEPARATORS.en;
  const normalizedPrice = oraclePrice
    .split(localeSeparators.grouping)
    .join('')
    .replace(localeSeparators.decimal, '.')
    .replace(/\s/gu, '');
  const price = new BigNumber(normalizedPrice);
  if (!price.isFinite()) {
    return oraclePrice;
  }

  return `${currencySymbol}${formatLocalizedNumberString(price.toFixed(2))}`;
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
  const { gtMd } = useMedia();
  const currencyInfo = useCurrency();
  const formattedOraclePrice = formatOraclePrice({
    oraclePrice: details?.oraclePrice,
    currencySymbol: currencyInfo.symbol,
  });

  const mobileContainerProps = useMemo(
    () => ({
      allowHeaderOverscroll: true,
      renderHeader: () => (
        <YStack px="$5" pt="$6" bg="$bgApp" pointerEvents="box-none">
          <ReserveProtocolHeader
            symbol={symbol}
            logoURI={logoURI}
            oraclePrice={formattedOraclePrice}
            reserveSize={details?.reserveSize}
            availableLiquidity={details?.liquidity}
            utilizationRatio={details?.utilizationRatio}
            platformBonus={details?.platformBonus}
            managers={details?.managers}
          />
        </YStack>
      ),
    }),
    [symbol, logoURI, details, formattedOraclePrice],
  );

  if (!gtMd) {
    return (
      <PageFrame
        LoadingSkeleton={BorrowReserveDetailsSkeleton}
        loading={isLoadingState({ result: details, isLoading })}
        error={isErrorState({ result: details, isLoading })}
        onRefresh={onRefresh}
      >
        {details ? (
          <ReserveDetailsTabs
            networkId={networkId}
            provider={provider}
            marketAddress={marketAddress}
            reserveAddress={reserveAddress}
            details={details}
            containerProps={mobileContainerProps}
          />
        ) : null}
      </PageFrame>
    );
  }

  return (
    <YStack flex={6} gap="$5" px="$5">
      <PageFrame
        LoadingSkeleton={BorrowReserveDetailsSkeleton}
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
                oraclePrice={formattedOraclePrice}
                reserveSize={details.reserveSize}
                availableLiquidity={details.liquidity}
                utilizationRatio={details.utilizationRatio}
                platformBonus={details.platformBonus}
                managers={details.managers}
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
