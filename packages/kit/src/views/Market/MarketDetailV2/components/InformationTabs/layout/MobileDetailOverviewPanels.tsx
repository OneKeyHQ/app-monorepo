// cspell:ignore Financials
import type { ReactNode } from 'react';

import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';

import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { StockFinancialsContent } from '../../StockFinancials/StockFinancials';
import { TokenActivityOverview } from '../../TokenActivityOverview/TokenActivityOverview';
import { TokenOverview } from '../../TokenOverview/TokenOverview';
import { TokenSupplementaryInfo } from '../../TokenSupplementaryInfo/TokenSupplementaryInfo';
import { TopCoinsOverviewContent } from '../../TopCoinsOverview/TopCoinsOverviewContent';
import { StockMobileOverview } from '../StockMobileOverview';

import { MarketDetailScrollView } from './MarketDetailScroll';

import type { useStockFinancials } from '../../StockFinancials/useStockFinancials';

function OverviewScroll({
  scrollEnabled,
  children,
}: {
  scrollEnabled: boolean;
  children: ReactNode;
}) {
  return (
    <MarketDetailScrollView scrollEnabled={scrollEnabled}>
      {children}
    </MarketDetailScrollView>
  );
}

export function MobileTrendingOverviewPanel({
  scrollEnabled,
}: {
  scrollEnabled: boolean;
}) {
  const { networkId } = useTokenDetail();
  const hideActivity = networkUtils.isBTCMainnet(networkId);

  return (
    <OverviewScroll scrollEnabled={scrollEnabled}>
      {hideActivity ? (
        <TokenOverview />
      ) : (
        <>
          {/* Starts 32pt below the tabs, matching the other overviews. */}
          <TokenActivityOverview
            desktopRedesign
            summaryLayout="stacked"
            pt="$8"
          />
          <TokenSupplementaryInfo variant="overview" columns={2} />
        </>
      )}
    </OverviewScroll>
  );
}

export function MobileTopCoinsOverviewPanel({
  scrollEnabled,
  assetDetail,
  isAssetDetailLoading,
}: {
  scrollEnabled: boolean;
  assetDetail?: IMarketAssetDetailData;
  isAssetDetailLoading?: boolean;
}) {
  return (
    <OverviewScroll scrollEnabled={scrollEnabled}>
      <TopCoinsOverviewContent
        assetDetail={assetDetail}
        isAssetDetailLoading={isAssetDetailLoading}
        columns={2}
      />
    </OverviewScroll>
  );
}

export function MobileStockOverviewPanel({
  scrollEnabled,
}: {
  scrollEnabled: boolean;
}) {
  return (
    <OverviewScroll scrollEnabled={scrollEnabled}>
      <StockMobileOverview />
    </OverviewScroll>
  );
}

export function MobileStockFinancialsPanel({
  scrollEnabled,
  stockId,
  financials,
}: {
  scrollEnabled: boolean;
  stockId: string;
  financials: ReturnType<typeof useStockFinancials>;
}) {
  return (
    <OverviewScroll scrollEnabled={scrollEnabled}>
      <StockFinancialsContent
        stockId={stockId}
        financials={financials}
        showTitle={false}
      />
    </OverviewScroll>
  );
}
